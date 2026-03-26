const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// =======================
// TEST ROUTE
// =======================
router.get("/test", (req, res) => {
  res.send("AUTH ROUTE WORKS ✅");
});

// =======================
// REGISTER (SIGN UP)
// =======================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "buyer", // default role
    });

    // 5. Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6. Send response
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// =======================
// LOGIN
// =======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5. Send response
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

module.exports = router;
