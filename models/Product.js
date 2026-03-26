const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
    },

    size: {
      type: String,
      required: true,
    },

    gender: {
      type: String,
      required: true,
      enum: ["women", "men", "unisex"],
    },

    category: {
      type: String,
      required: true,
    },

    images: {
      type: [String],
      default: [],
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ ADD THIS FIELD
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },

    // ===============================
    // BIDDING SYSTEM
    // ===============================

    biddingEnabled: {
      type: Boolean,
      default: false,
    },

    highestBid: {
      type: Number,
      default: 0,
    },

    selectedBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ===============================

    isSold: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);