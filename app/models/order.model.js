const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────
// User Schema
// ─────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    user_name: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    status: {
      type: String,
      enum: ["admin", "staff", "viewer"],
      default: "staff",
    },
    department: {
      type: [String],
      default: [],
    },
    column_access: {
      type: [String],
      default: [],
    },
    sharedFilters: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "SavedFilter",
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving (only if modified)
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─────────────────────────────────────────────
// Order Schema
// ─────────────────────────────────────────────
const OrderSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: [true, "Shop domain is required"],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, "Shopify order ID is required"],
      unique: true,
    },
    orderName: {
      type: String,
      required: [true, "Order name is required"],
    },
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      index: true,
    },
    customerName: {
      type: String,
      default: "Guest Customer",
    },
    customerEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    orderTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    cashbackAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    financialStatus: {
      type: String,
      enum: ["PAID", "PENDING", "REFUNDED", "PARTIALLY_REFUNDED", "VOIDED"],
      default: "PAID",
    },
    cashbackStatus: {
      type: String,
      enum: ["Completed", "Pending", "Failed", "Reversed"],
      default: "Completed",
    },
    emailStatus: {
      type: String,
      enum: ["Sent", "Not Sent", "Failed"],
      default: "Not Sent",
    },
    programType: {
      type: String,
      enum: ["Cashback", "Custom Program"],
      default: "Cashback",
    },
    programId: {
      type: String,
      default: null,
    },
    lineItems: [
      {
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
      },
    ],
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for efficient queries
OrderSchema.index({ shop: 1, createdAt: -1 });
OrderSchema.index({ shop: 1, customerId: 1 });

// ─────────────────────────────────────────────
// Export both models
// ─────────────────────────────────────────────
const User = mongoose.model("User", UserSchema);
const Order = mongoose.model("Order", OrderSchema);

module.exports = { User, Order };
