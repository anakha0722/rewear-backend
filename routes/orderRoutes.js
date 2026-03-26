const express = require("express");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product"); // added
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/checkout", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart empty" });
    }

    const items = [];

    for (const item of cart.items) {

      // always fetch latest product from DB
      const product = await Product.findById(item.product._id);

      if (!product) {
        return res.status(400).json({
          message: "Product no longer exists",
        });
      }

      // ❌ Cannot buy bidding items normally
      if (product.biddingEnabled) {
        return res.status(400).json({
          message: "This product is available via bidding only",
        });
      }

      // ❌ Cannot buy sold items
      if (product.isSold || product.quantity <= 0) {
        return res.status(400).json({
          message: `${product.title} is sold out`,
        });
      }

      // ❌ Insufficient stock
      if (item.quantity > product.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.title}`,
        });
      }

      // ✅ Reduce stock safely
      product.quantity -= item.quantity;

      if (product.quantity <= 0) {
        product.quantity = 0;
        product.isSold = true;
      }

      await product.save();

      items.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await Order.create({
      user: req.user._id,
      items,
      totalAmount,
      status: "Awaiting Confirmation",
    });

    // clear cart
    cart.items = [];
    await cart.save();

    res.json({
      message: "Order placed successfully",
      order
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Checkout failed" });
  }
});


// =======================
// GET USER ORDERS
// =======================
router.get("/my-orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate({
  path: "items.product",
  populate: {
    path: "seller",
    select: "name email"
  }
})
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch {
    res.status(500).json({ message: "Failed loading orders" });
  }
});


router.put("/cancel/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product");

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // prevent cancelling twice
    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    // restore product stock
    for (const item of order.items) {

      if (!item.product) continue;

      const product = await Product.findById(item.product._id);

      if (!product) continue;

      product.quantity += item.quantity;

      if (product.quantity > 0) {
        product.isSold = false;
      }

      await product.save();
    }

    order.status = "Cancelled";
    await order.save();

    res.json(order);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Cancel failed" });
  }
});

// =======================
// SELLER ORDERS
// =======================
router.get("/seller-orders", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.user._id;

    const orders = await Order.find()
      .populate({
        path: "items.product",
        match: { seller: sellerId },
      })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const sellerOrders = orders
      .map((order) => {
        const items = order.items.filter(
          (item) => item.product !== null
        );

        if (items.length === 0) return null;

        return {
          ...order.toObject(),
          items,
        };
      })
      .filter(Boolean);

    res.json(sellerOrders);
  } catch (err) {
    res.status(500).json({ message: "Failed loading seller orders" });
  }
});


// =======================
// UPDATE ORDER STATUS
// =======================
router.put("/update-status/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id)
      .populate("items.product");

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    const sellerOwnsItem = order.items.some(
      (item) =>
        item.product &&
        item.product.seller.toString() ===
          req.user._id.toString()
    );

    if (!sellerOwnsItem) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch {
    res.status(500).json({ message: "Status update failed" });
  }
});

// =======================
// SELLER ANALYTICS
// =======================
router.get("/seller-analytics", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.user._id;

    const orders = await Order.find()
      .populate({
        path: "items.product",
        match: { seller: sellerId },
      });

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let totalOrders = 0;

    const productSales = {};

    orders.forEach((order) => {

      const sellerItems = order.items.filter(
        (item) => item.product !== null
      );

      // skip orders that don't contain this seller's items
      if (sellerItems.length === 0) return;

      totalOrders += 1;

      sellerItems.forEach((item) => {

        const revenue = item.price * item.quantity;

        totalRevenue += revenue;
        totalItemsSold += item.quantity;

        const id = item.product._id.toString();

        if (!productSales[id]) {
          productSales[id] = {
            title: item.product.title,
            quantity: 0,
          };
        }

        productSales[id].quantity += item.quantity;

      });

    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({
      totalRevenue,
      totalItemsSold,
      totalOrders,
      topProducts,
    });

  } catch {
    res.status(500).json({ message: "Analytics failed" });
  }
});
// =======================
// CONFIRM ORDER (BUYER)
// =======================
router.put("/confirm/:id", authMiddleware, async (req, res) => {
  try {
    const { fullName, phone, address } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status !== "Awaiting Confirmation") {
      return res.status(400).json({
        message: "Order cannot be confirmed",
      });
    }

    if (!fullName || !phone || !address) {
      return res.status(400).json({
        message: "All shipping details required",
      });
    }

    order.fullName = fullName;
    order.phone = phone;
    order.address = address;
    order.status = "Placed";

    await order.save();

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Confirmation failed" });
  }
});

module.exports = router;