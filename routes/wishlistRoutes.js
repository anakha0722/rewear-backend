const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const auth = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user.id })
    .populate("items.product");

  if (!wishlist)
    wishlist = await Wishlist.create({ user: req.user.id, items: [] });

  res.json(wishlist);
});

router.post("/add", auth, async (req, res) => {
  const { productId } = req.body;

  let wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist)
    wishlist = await Wishlist.create({ user: req.user.id, items: [] });

  const exists = wishlist.items.find(
    (i) => i.product.toString() === productId
  );

  if (exists) {
    return res.json({
      message: "Item already in wishlist",
      wishlist
    });
  }

  wishlist.items.push({ product: productId });

  await wishlist.save();

  const updated = await Wishlist.findOne({ user: req.user.id })
    .populate("items.product");

  res.json({
    message: "Added to wishlist",
    wishlist: updated
  });
});

router.post("/remove", auth, async (req, res) => {
  const { productId } = req.body;

  const wishlist = await Wishlist.findOne({ user: req.user.id });

  wishlist.items = wishlist.items.filter(
    (i) => i.product.toString() !== productId
  );

  await wishlist.save();

  const updated = await Wishlist.findOne({ user: req.user.id })
    .populate("items.product");

  res.json({
    message: "Removed from wishlist",
    wishlist: updated
  });
});

module.exports = router;