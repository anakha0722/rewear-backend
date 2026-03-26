const express = require("express");
const multer = require("multer");
const path = require("path");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const axios = require("axios");

const router = express.Router();


// =======================
// MULTER CONFIG
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});


// =======================
// UPLOAD PRODUCT
// =======================
router.post(
  "/upload",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        price,
        size,
        gender,
        category,
        quantity,
        biddingEnabled,
      } = req.body;

      if (!title || !price || !size || !gender || !category) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const product = await Product.create({
        title,
        description,
        price,
        size,
        gender,
        category,
        quantity: quantity ? Number(quantity) : 1,
        biddingEnabled: biddingEnabled === "true",
        isSold: false,
        images: req.file ? [req.file.filename] : [],
        seller: req.user._id,
      });

      res.status(201).json(product);
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

// =======================
// GET ALL PRODUCTS
// =======================
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.status(500).json({ message: "Failed to fetch products" });
  }
});


// =======================
// GET SELLER PRODUCTS
// =======================
router.get("/my-products", authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(products);
  } catch {
    res.status(500).json({ message: "Failed to fetch seller products" });
  }
});


// =======================
// PRODUCT RECOMMENDATIONS
// =======================
router.get("/recommend/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const recommendations = await Product.find({
      _id: { $ne: product._id },
      gender: product.gender,
      category: { $ne: product.category },
      isSold: false,
      quantity: { $gt: 0 } // ✅ ensure stock exists
    })
      .limit(4)
      .sort({ createdAt: -1 });

    res.json(recommendations);
  } catch {
    res.status(500).json({ message: "Recommendation failed" });
  }
});


// =======================
// AI STYLIST (HUGGINGFACE AI + PRODUCT SUGGESTIONS)
// =======================
router.post("/stylist", async (req, res) => {
  try {

    let messages = req.body.messages;

    // support old format
    if (!messages && req.body.message) {
      messages = [{ role: "user", content: req.body.message }];
    }

    if (!messages || !Array.isArray(messages)) {
      return res.json({
        text: "Hey bestie 👗 tell me what outfit vibe you're going for!",
        products: []
      });
    }

    // ✅ limit history sent to model (prevents large payloads)
    messages = messages.slice(-6);

    const systemPrompt = `
You are a friendly Gen Z fashion stylist for an online platform called ReWear.

Rules:
- Keep responses SHORT (4–6 lines max)
- Give outfit suggestions clearly
- Always include: topwear, bottomwear, footwear, accessories
- Speak casually like a stylist friend
- Ask ONE follow-up question at the end
`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // ===== CALL HUGGINGFACE =====
    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: formattedMessages,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000 // ✅ prevents hanging requests
      }
    );

    const text =
      response.data.choices?.[0]?.message?.content ||
      "Sorry bestie, my fashion brain glitched 😭 try again.";

// ==============================
// PRODUCT RECOMMENDATION LOGIC
// ==============================

const allText = messages
  .map((m) => m.content.toLowerCase())
  .join(" ");

let category = "";

// map user intent → actual DB categories
if (allText.includes("dress")) category = "dress";
else if (allText.includes("jeans") || allText.includes("pants") || allText.includes("skirt")) category = "bottomwear";
else if (allText.includes("shirt") || allText.includes("tshirt") || allText.includes("t-shirt") || allText.includes("top")) category = "topwear";
else if (allText.includes("hoodie") || allText.includes("jacket")) category = "topwear";

let products = [];

if (category) {
  products = await Product.find({
    category: { $regex: category, $options: "i" },
    isSold: false,
    quantity: { $gt: 0 }
  }).limit(4);
}

// fallback
if (!products.length) {
  products = await Product.find({
    isSold: false,
    quantity: { $gt: 0 }
  }).limit(2);
}

// ✅ VERY IMPORTANT
res.json({
  text,
  products
});
} catch (err) {

  console.error("HF error:", err.response?.data || err.message);

  res.json({
    text: "Oops my stylist brain lagged for a sec 😭 try again!",
    products: []
  });

}
});

// =======================
// UPDATE PRODUCT
// =======================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const {
      title,
      price,
      size,
      gender,
      description,
      category,
    } = req.body;

    product.title = title ?? product.title;
    product.price = price ?? product.price;
    product.size = size ?? product.size;
    product.gender = gender ?? product.gender;
    product.description = description ?? product.description;
    product.category = category ?? product.category;

    await product.save();
    res.json(product);
  } catch {
    res.status(500).json({ message: "Update failed" });
  }
});


// =======================
// DELETE PRODUCT
// =======================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});


// =======================
// GET PRODUCT BY ID
// =======================
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
  .populate("seller", "name email");

    if (!product)
      return res.status(404).json({ message: "Not found" });

    res.json(product);
  } catch {
    res.status(500).json({ message: "Error loading product" });
  }
});

module.exports = router;