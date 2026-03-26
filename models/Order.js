const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
          default: 1,
        },
        price: Number,
      },
    ],

    totalAmount: Number,

    // 🆕 Shipping Details
    fullName: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "Awaiting Confirmation",
        "Placed",
        "Accepted",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Placed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);