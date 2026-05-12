// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();

// const userRoutes = require("./app/routes/users");

// const app = express();
// const PORT = process.env.PORT || 5000;

// // ─────────────────────────────────────────────
// // Middleware
// // ─────────────────────────────────────────────
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ─────────────────────────────────────────────
// // MongoDB Connection
// // ─────────────────────────────────────────────
// const connectDB = async () => {
//   const mongoURI = process.env.MONGODB_URI;

//   if (!mongoURI) {
//     console.error("❌ MONGODB_URI is not defined in .env");
//     process.exit(1);
//   }

//   try {
//     await mongoose.connect(mongoURI);
//     console.log("✅ MongoDB connected successfully");
//   } catch (err) {
//     console.error("❌ MongoDB connection error:", err.message);
//     process.exit(1);
//   }
// };

// // ─────────────────────────────────────────────
// // Routes
// // ─────────────────────────────────────────────
// app.use("/api/user", userRoutes);

// // Health check
// app.get("/api/health", (_req, res) => {
//   res.json({ status: "ok", timestamp: new Date().toISOString() });
// });

// // ─────────────────────────────────────────────
// // Start Server
// // ─────────────────────────────────────────────
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`🚀 Server running on http://localhost:${PORT}`);
//   });
// });
