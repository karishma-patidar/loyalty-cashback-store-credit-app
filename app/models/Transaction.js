import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderName: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, default: "Completed" },
    emailStatus: { type: String, default: "Sent" },
    type: { type: String, default: "Cashback" },
    issuedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Prevent recompilation of model during dev hot reloading
const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);

export default Transaction;
