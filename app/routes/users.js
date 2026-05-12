import connectDB from "../db.server";
import { User } from "../models/order.model";

// ─────────────────────────────────────────────
// LOADER — Handles GET requests (/users)
// ─────────────────────────────────────────────
export async function loader({ request }) {
  await connectDB();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    // 1. GET /users?id=... — Fetch single user
    if (id) {
      const user = await User.findById(id);
      if (!user) {
        return Response.json({ success: false, error: "User not found" }, { status: 404 });
      }
      return Response.json({ success: true, user });
    }

    // 2. GET /users — List all users
    const users = await User.find().sort({ createdAt: -1 });
    return Response.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error("❌ GET users error:", error.message);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// ACTION — Handles POST, PUT, PATCH, DELETE requests
// ─────────────────────────────────────────────
export async function action({ request }) {
  await connectDB();

  // CORS support
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = await request.json();
    const { actionType } = body;

    // 1. REGISTER USER
    if (actionType === "register" || request.method === "POST" && !actionType) {
      const { user_name, email, password, status } = body;

      if (!user_name || !email || !password) {
        return Response.json({ success: false, error: "user_name, email, and password are required" }, { status: 400 });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return Response.json({ success: false, error: "A user with this email already exists" }, { status: 409 });
      }

      const user = await User.create({
        user_name,
        email,
        password,
        status: status || "staff",
      });

      console.log("✅ User registered:", user.email);
      return Response.json({ success: true, message: "User created successfully", user }, { status: 201 });
    }

    // 2. LOGIN USER
    if (actionType === "login") {
      const { email, password } = body;

      if (!email || !password) {
        return Response.json({ success: false, error: "Email and password are required" }, { status: 400 });
      }

      const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
      if (!user) {
        return Response.json({ success: false, error: "Invalid email or password" }, { status: 401 });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return Response.json({ success: false, error: "Invalid email or password" }, { status: 401 });
      }

      console.log("✅ Login successful:", user.email);
      return Response.json({ success: true, message: "Login successful", user: user.toJSON() });
    }

    // 3. UPDATE USER (status, department, etc.)
    if (actionType === "update" || request.method === "PATCH") {
      const { id } = body;
      if (!id) {
        return Response.json({ success: false, error: "User ID is required" }, { status: 400 });
      }

      const allowedFields = ["department", "status", "column_access", "user_name"];
      const updateFields = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateFields[field] = body[field];
        }
      }

      const user = await User.findByIdAndUpdate(id, updateFields, {
        new: true,
        runValidators: true,
      });

      if (!user) {
        return Response.json({ success: false, error: "User not found" }, { status: 404 });
      }

      console.log("✅ Updated user:", user.email);
      return Response.json({ success: true, message: "User updated", user });
    }

    // 4. UPDATE COLUMN ACCESS
    if (actionType === "column-access" || request.method === "PUT") {
      const { id, column_access } = body;

      if (!id) {
        return Response.json({ success: false, error: "User ID is required" }, { status: 400 });
      }

      if (!Array.isArray(column_access)) {
        return Response.json({ success: false, error: "column_access must be an array of strings" }, { status: 400 });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { column_access },
        { new: true, runValidators: true }
      );

      if (!user) {
        return Response.json({ success: false, error: "User not found" }, { status: 404 });
      }

      console.log("✅ Column access updated for:", user.email);
      return Response.json({ success: true, message: "Column access updated", user });
    }

    // 5. DELETE USER
    if (actionType === "delete" || request.method === "DELETE") {
      const { id } = body;
      if (!id) {
        return Response.json({ success: false, error: "User ID is required" }, { status: 400 });
      }

      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return Response.json({ success: false, error: "User not found" }, { status: 404 });
      }

      console.log("✅ Deleted user:", user.email);
      return Response.json({ success: true, message: "User deleted", user });
    }

    return Response.json({ success: false, error: "Invalid action or method" }, { status: 400 });
  } catch (error) {
    console.error("❌ Action users error:", error.message);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// Default export — Empty UI since this is a pure API route
// ─────────────────────────────────────────────
export default function UsersApiRoute() {
  return null;
}
