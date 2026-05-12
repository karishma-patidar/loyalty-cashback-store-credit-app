const express = require("express");
const router = express.Router();
const User = require("../models/User.model");

// ─────────────────────────────────────────────
// POST /users/register — Create a new user
// ─────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { user_name, email, password, status } = req.body;

    // Validate required fields
    if (!user_name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "user_name, email, and password are required",
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "A user with this email already exists",
      });
    }

    // Create user (password is auto-hashed by the pre-save hook)
    const user = await User.create({
      user_name,
      email,
      password,
      status: status || "staff",
    });

    console.log("✅ User registered:", user.email);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("❌ Registration error:", error.message);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "A user with this email already exists",
      });
    }

    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// POST /users/login — Authenticate a user
// ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Explicitly select password since it's excluded by default
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Compare password using bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    console.log("✅ Login successful:", user.email);

    // toJSON transform removes password automatically
    res.json({
      success: true,
      message: "Login successful",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /users — List all users (admin/dev only)
// ─────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error("❌ Fetch users error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /users/:id — Get a single user by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Fetch user error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /users/:id — Update user fields
// (department, status, column_access)
// ─────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    // Only allow updating specific fields
    const allowedFields = ["department", "status", "column_access", "user_name"];
    const updateFields = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        error: `No valid fields to update. Allowed: ${allowedFields.join(", ")}`,
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log("✅ Updated user:", user.email, "fields:", Object.keys(updateFields));
    res.json({ success: true, message: "User updated", user });
  } catch (error) {
    console.error("❌ Update user error:", error.message);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PUT /users/:id/column-access — Update column access
// ─────────────────────────────────────────────
router.put("/:id/column-access", async (req, res) => {
  try {
    const { column_access } = req.body;

    if (!Array.isArray(column_access)) {
      return res.status(400).json({
        success: false,
        error: "column_access must be an array of strings",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { column_access },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log("✅ Column access updated for:", user.email);
    res.json({ success: true, message: "Column access updated", user });
  } catch (error) {
    console.error("❌ Column access error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// DELETE /users/:id — Delete a user
// ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log("✅ Deleted user:", user.email);
    res.json({ success: true, message: "User deleted", user });
  } catch (error) {
    console.error("❌ Delete user error:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
