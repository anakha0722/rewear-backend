const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "accepted", "rejected"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ✅ Prevent same user bidding multiple times on same product
bidSchema.index({ product: 1, bidder: 1 }, { unique: true });

module.exports = mongoose.model("Bid", bidSchema);