import mongoose from "mongoose";

const OrderDetailsSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, "Order ID is required"],
      unique: true,
    },
    orderName: {
      type: String,
      required: [true, "Order name is required"],
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
      required: true,
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
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // No separate _id for each nested order to keep it lightweight
);

const CustomerOrdersSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: [true, "Shop domain is required"],
      index: true,
    },
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      unique: true, // One document per customer
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
    orders: [OrderDetailsSchema], // Nested array of customer's orders
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

// Indexes for super-fast retrieval
CustomerOrdersSchema.index({ shop: 1, customerId: 1 });

const CustomerOrders = mongoose.models.CustomerOrders || mongoose.model("CustomerOrders", CustomerOrdersSchema);

export { CustomerOrders };
export default CustomerOrders;
