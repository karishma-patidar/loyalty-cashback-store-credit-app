import dns from "node:dns";
import mongoose from "mongoose";

// Set public DNS to resolve Atlas querySrv SRV lookup issues on Windows or restricted local networks
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (e) {
  console.warn("⚠️ Failed to set Node DNS servers:", e.message);
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in your .env file");
}

let cached = global.mongooseGlobal;

if (!cached) {
  cached = global.mongooseGlobal = { conn: null, promise: null };
}

/**
 * Connect to MongoDB using Mongoose and cache the connection across hot-reloads.
 * Forces the connection to use the database named "orders".
 */
export async function connectMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }
  
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: "orders", // Force connection to the "orders" database
    };

    console.log("🔄 Connecting to MongoDB database 'orders'...");
    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongooseInstance) => {
      console.log("✅ MongoDB database 'orders' connected successfully!");
      try {
        const db = mongooseInstance.connection.db;
        if (db) {
          await db.dropCollection("undefined");
          console.log("🗑️ Successfully dropped 'undefined' collection from MongoDB!");
        }
      } catch (e) {
        // Ignore if collection doesn't exist
      }
      return mongooseInstance;
    }).catch((err) => {
      console.error("❌ Failed to connect to MongoDB:", err);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Schema definition for event entries within a shop transaction group.
 */
const EventSchema = new mongoose.Schema(
  {
    orderId: { type: String },
    orderName: { type: String },
    customerId: { type: String },
    customerName: { type: String },
    amount: { type: Number },
    currency: { type: String },
    status: { type: String, default: "Completed" },
    emailStatus: { type: String, default: "Sent" },
    type: { type: String, default: "Cashback" },
    issuedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: false }
);

/**
 * Schema definition for store-specific transaction collections grouped by date.
 */
const ShopTransactionGroupSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    events: [EventSchema],
  },
  {
    timestamps: true,
    strict: false,
  }
);

export function getShopModel(shop) {
  if (!shop || shop === "undefined") {
    throw new Error("getShopModel called without a valid shop string");
  }
  const collectionName = String(shop).toLowerCase().trim();

  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  return mongoose.model(collectionName, ShopTransactionGroupSchema, collectionName);
}

export async function syncMongoStoreSession(session) {
  if (!session || !session.shop) return;
  await connectMongoDB();
  try {
    // 1. Automatically create the store's corresponding order collection in the 'orders' DB
    const ShopModel = getShopModel(session.shop);
    await ShopModel.createCollection();
    console.log(`✅ MongoDB collection successfully verified/created for store: ${session.shop}`);

    // 2. Sync the valid session document into the 'shopify_sessions' collection across both cluster databases
    const client = mongoose.connection.getClient();
    const mainDb = client.db("loyalty-cashback-store-credit");
    const sessionsColMain = mainDb.collection("shopify_sessions");

    const sessionsDb = client.db("Sessions_data");
    const sessionsColData = sessionsDb.collection("shopify_sessions");

    const sessionDoc = {
      id: session.id,
      shop: session.shop,
      state: session.state || "",
      isOnline: session.isOnline || false,
      scope: session.scope || "",
      expires: session.expires ? new Date(session.expires) : null,
      accessToken: session.accessToken || "",
      refreshToken: session.refreshToken || "",
      refreshTokenExpires: session.refreshTokenExpires ? new Date(session.refreshTokenExpires) : null,
      updatedAt: new Date()
    };

    await sessionsColMain.updateOne(
      { id: session.id },
      { $set: sessionDoc },
      { upsert: true }
    );

    await sessionsColData.updateOne(
      { id: session.id },
      { $set: sessionDoc },
      { upsert: true }
    );
    console.log(`✅ Shopify session document successfully synced to MongoDB Atlas Databases ('Sessions_data' & 'loyalty-cashback-store-credit') for store: ${session.shop}`);
  } catch (err) {
    console.error("❌ Error syncing store collection & session to MongoDB:", err);
  }
}

export const getCustomerModel = getShopModel;

export default connectMongoDB;
