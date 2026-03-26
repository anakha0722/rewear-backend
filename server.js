const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// =======================
// IMPORTS
// =======================
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const orderRoutes = require("./routes/orderRoutes");
const bidRoutes = require("./routes/bidRoutes");
console.log("authRoutes:", typeof authRoutes);
console.log("productRoutes:", typeof productRoutes);
console.log("cartRoutes:", typeof cartRoutes);
console.log("wishlistRoutes:", typeof wishlistRoutes);
console.log("orderRoutes:", typeof orderRoutes);
// =======================
// APP INIT
// =======================
const app = express();

// =======================
// CONNECT DATABASE
// =======================
connectDB();

// =======================
// GLOBAL MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// STATIC FILE SERVING
// =======================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);
app.use("/api/bids", bidRoutes);
// =======================
// API ROUTES
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);

// =======================
// ROOT TEST ROUTE
// =======================
app.get("/", (req, res) => {
  res.send("🔥 ReWear Backend Running!");
});

// =======================
// GLOBAL ERROR HANDLER
// =======================
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
