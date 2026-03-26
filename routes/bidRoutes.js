const express = require("express");
const Bid = require("../models/Bid");
const Product = require("../models/Product");
const Order = require("../models/Order");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ======================
// GET BIDS FOR PRODUCT
// ======================
router.get("/:productId", async (req, res) => {
  try {
    const bids = await Bid.find({
      product: req.params.productId,
    })
      .populate("bidder", "name")
      .sort({ amount: -1 });

    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bids" });
  }
});

// ======================
// PLACE BID
// ======================
router.post("/place", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.body;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid bid amount",
      });
    }

    const product = await Product.findById(productId);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.isSold || product.quantity <= 0)
      return res.status(400).json({
        message: "Product already sold",
      });

    if (!product.biddingEnabled)
      return res.status(400).json({
        message: "Bidding not enabled for this product",
      });

    if (product.seller.toString() === req.user._id.toString())
      return res.status(400).json({
        message: "You cannot bid on your own product",
      });

    const highestBid = await Bid.findOne({ product: productId })
      .sort({ amount: -1 });

    const minimumAmount = highestBid
      ? highestBid.amount + 1
      : product.price + 1;

    if (amount < minimumAmount) {
      return res.status(400).json({
        message: `Bid must be at least ₹${minimumAmount}`,
      });
    }

    const bid = await Bid.findOneAndUpdate(
      { product: productId, bidder: req.user._id },
      { amount, status: "active" },
      { new: true, upsert: true }
    );

    product.highestBid = amount;
    await product.save();

    res.json({
      message: "Bid placed successfully",
      bid,
      highestBid: amount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bid failed" });
  }
});

// ======================
// SELLER ACCEPTS BID
// ======================
router.post("/accept/:productId", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    // ❌ Only seller can accept
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ❌ Cannot accept if already sold
    if (product.isSold) {
      return res.status(400).json({
        message: "Product already sold",
      });
    }

    const highestBid = await Bid.findOne({
      product: product._id,
    })
      .sort({ amount: -1 })
      .populate("bidder");

    if (!highestBid)
      return res.status(400).json({ message: "No bids yet" });

    // ✅ Mark highest bid accepted
    highestBid.status = "accepted";
    await highestBid.save();

    // ✅ Reject others
    await Bid.updateMany(
      { product: product._id, _id: { $ne: highestBid._id } },
      { status: "rejected" }
    );

    // ✅ Create order
    const order = await Order.create({
      user: highestBid.bidder._id,
      items: [
        {
          product: product._id,
          quantity: 1,
          price: highestBid.amount,
        },
      ],
      totalAmount: highestBid.amount,
      status: "Awaiting Confirmation",
    });

    // ✅ Mark product sold
    product.isSold = true;
    product.selectedBidder = highestBid.bidder._id;
    product.quantity = 0;

    await product.save();

    res.json({
      message: "Bid accepted successfully",
      order,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Accept failed" });
  }
});

module.exports = router;