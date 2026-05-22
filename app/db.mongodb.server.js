import mongoose from "mongoose";
import shopify from "./shopify.server.js";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in the environment variables");
}

let cached = global.__mongooseMongoDBConnection;
if (!cached) {
  cached = global.__mongooseMongoDBConnection = { conn: null, promise: null };
}

export async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: "orders",
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log("✅ Connected successfully to MongoDB (orders)");
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Make connectMongoDB also the default export to support different import styles
export default connectMongoDB;

const eventSchema = new mongoose.Schema({
  shop: String,
  orderId: String,
  orderName: String,
  customerId: String,
  customerName: String,
  amount: Number,
  currency: String,
  status: String,
  emailStatus: String,
  emailFailReason: String,
  type: String,
  issuedAt: Date,
  processAt: Date,
  expiresAt: Date,
  shouldNotify: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const shopSchema = new mongoose.Schema({
  date: { type: String, required: true },
  events: [eventSchema]
}, { timestamps: true });

// Dynamic model retrieval/compilation per shop (collection name corresponds to the shop's domain)
export function getShopModel(shop) {
  if (!shop) return null;
  return mongoose.models[shop] || mongoose.model(shop, shopSchema, shop);
}

// Alias for getShopModel to support both import conventions in route and processor files
export const getCustomerModel = getShopModel;

export async function syncMongoStoreSession(session) {
  if (!session) return;
  try {
    await shopify.sessionStorage.storeSession(session);
    console.log(`[Session Sync] Successfully synced session for ${session.shop}`);
  } catch (err) {
    console.error(`[Session Sync] Failed to sync session for ${session.shop}:`, err);
  }
}
