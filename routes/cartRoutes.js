const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const auth = require("../middleware/authMiddleware");

// GET user cart
router.get("/", auth, async (req, res) => {
  let cart = await Cart.findOne({ user: req.user.id })
    .populate("items.product");

  if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });

  res.json(cart);
});

router.post("/add", auth, async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.isSold || product.quantity <= 0)
      return res.status(400).json({ message: "Item is sold out" });

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId
    );

    if (itemIndex > -1) {
      let newQty = cart.items[itemIndex].quantity + 1;

      if (newQty > product.quantity) {
        return res.status(400).json({
          message: `Only ${product.quantity} item(s) available`,
        });
      }

      cart.items[itemIndex].quantity = newQty;

    } else {
      cart.items.push({
        product: productId,
        quantity: 1,
      });
    }

    await cart.save();

    const updatedCart = await Cart.findOne({ user: req.user.id })
      .populate("items.product");

    res.json({
      message: "Added to cart",
      cart: updatedCart,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Cart update failed" });
  }
});

// REMOVE item
router.post("/remove", auth, async (req, res) => {
  const { productId } = req.body;

  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  cart.items = cart.items.filter(
    (i) => i.product.toString() !== productId
  );

  await cart.save();

  const populatedCart = await Cart.findOne({ user: req.user.id })
    .populate("items.product");

  res.json({
    message: "Removed from cart",
    cart: populatedCart
  });
});

router.post("/merge", auth, async (req, res) => {
  try {
    const { items } = req.body;
 // keep this for now

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    for (const item of items) {
      const productId = item.product?._id;

      if (!productId) continue;

      const existing = cart.items.find(
        (i) => i.product.toString() === productId
      );

      if (existing) {
  const newQty = existing.quantity + item.quantity;

  const product = await Product.findById(productId);

  if (product) {
    existing.quantity = Math.min(newQty, product.quantity);
  } else {
    existing.quantity = newQty;
  }
}
      else {
        cart.items.push({
          product: productId,
          quantity: item.quantity,
        });
      }
    }

    await cart.save();

    res.json({ message: "Cart merged" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Merge failed" });
  }
});

module.exports = router;