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

let cachedLoyalty = global.__mongooseLoyaltyConnection;
if (!cachedLoyalty) {
  cachedLoyalty = global.__mongooseLoyaltyConnection = { conn: null, promise: null };
}

export async function connectLoyaltyDB() {
  if (cachedLoyalty.conn) {
    return cachedLoyalty.conn;
  }

  if (!cachedLoyalty.promise) {
    const opts = {
      dbName: "loyalty-cashback-store-credit",
    };

    cachedLoyalty.promise = mongoose.createConnection(MONGODB_URI, opts).asPromise().then((conn) => {
      console.log("✅ Connected successfully to MongoDB (loyalty-cashback-store-credit)");
      return conn;
    });
  }

  cachedLoyalty.conn = await cachedLoyalty.promise;
  return cachedLoyalty.conn;
}

// Make connectMongoDB also the default export to support different import styles
export default connectMongoDB;

const eventSchema = new mongoose.Schema({
  shop: String,
  orderId: String,
  orderName: String,
  customerId: String,
  customerName: String,
  issuedAmount: Number,
  currency: String,
  exchangeRate: Number,
  status: String,
  emailStatus: String,
  emailFailReason: String,
  redeemedAmount: Number,
  programType: String,
  processAt: Date,
  expiresAt: Date,
  shouldNotify: Boolean,
  programId: String,
  programName: String,
  issuedAt: Date,
  createdAt: { type: Date, default: Date.now },
  cancellationReason: String,
  cancelledAt: Date
});

const storeSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  details: {
    type: Map,
    of: new mongoose.Schema({
      events: [eventSchema]
    }, { _id: false }),
    default: {}
  }
}, { timestamps: true });

const appSettingsSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  onboardingCompleted: { type: Boolean, default: false }
}, { timestamps: true });


export async function getAppSettings(shop) {
  if (!shop) return null;
  const conn = await connectLoyaltyDB();
  const Model = conn.models.AppSettings || conn.model("AppSettings", appSettingsSchema);
  let settings = await Model.findOne({ shop });
  if (!settings) {
    settings = await Model.create({ shop, onboardingCompleted: false });
  }
  return settings;
}

export async function updateAppSettings(shop, updates) {
  if (!shop) return null;
  const conn = await connectLoyaltyDB();
  const Model = conn.models.AppSettings || conn.model("AppSettings", appSettingsSchema);
  return await Model.findOneAndUpdate(
    { shop },
    { $set: updates },
    { new: true, upsert: true }
  );
}

// Schema to store programs mirrored from Shopify Metafields within a single session document
const flowProgramSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  programs: { type: Array, default: [] }
}, { strict: false, timestamps: true });

export function getFlowProgramModel() {
  // Uses the global loyalty db connection since it's shared app data
  const conn = global.__mongooseLoyaltyConnection?.conn;
  if (!conn) {
    console.warn("MongoDB Loyalty Connection not initialized when getting FlowProgramModel.");
    return null;
  }
  return conn.models.FlowProgram || conn.model("FlowProgram", flowProgramSchema, "flow_programs");
}

/**
 * @param {string} [shop]
 */
// eslint-disable-next-line no-unused-vars
export function getStoreModel(shop) {
  return mongoose.models.Store || mongoose.model("Store", storeSchema, "store");
}

// Keep getShopModel / getCustomerModel as fallback alias pointing to getStoreModel
export const getShopModel = getStoreModel;
export const getCustomerModel = getStoreModel;

export async function migrateShopData(shop) {
  if (!shop) return;
  try {
    const StoreModel = getStoreModel();
    let storeDoc = await StoreModel.findOne({ shop });
    
    // Check if old collection exists in the "orders" database
    const conn = mongoose.connection;
    const collections = await conn.db.listCollections({ name: shop }).toArray();
    const oldCollectionExists = collections.length > 0;

    if (!storeDoc && oldCollectionExists) {
      console.log(`[Migration] Migrating old collection data for shop: ${shop}`);
      const oldCollection = conn.db.collection(shop);
      const oldDocs = await oldCollection.find({}).toArray();
      
      const details = new Map();
      for (const doc of oldDocs) {
        if (!doc.date || !Array.isArray(doc.events)) continue;
        
        // Clean event properties (migrate legacy names)
        const cleanedEvents = doc.events.map(ev => {
          const newEv = { ...ev };
          if ('amount' in newEv) {
            newEv.issuedAmount = newEv.amount;
            delete newEv.amount;
          }
          if ('type' in newEv) {
            newEv.programType = newEv.type;
            delete newEv.type;
          }
          return newEv;
        });

        details.set(doc.date, { events: cleanedEvents });
      }

      await StoreModel.create({ shop, details });
      console.log(`[Migration] Successfully migrated shop: ${shop} to unified 'store' collection`);
      
      try {
        await oldCollection.rename(`${shop}_backup`);
        console.log(`[Migration] Renamed old collection ${shop} to ${shop}_backup`);
      } catch (renameErr) {
        console.error(`[Migration Warning] Could not rename old collection ${shop}:`, renameErr);
      }
    }
  } catch (err) {
    console.error(`[Migration Error] Failed to migrate shop data for ${shop}:`, err);
  }
}

export async function syncMongoStoreSession(session) {
  if (!session) return;
  try {
    await shopify.sessionStorage.storeSession(session);
    console.log(`[Session Sync] Successfully synced session for ${session.shop}`);
  } catch (err) {
    console.error(`[Session Sync] Failed to sync session for ${session.shop}:`, err);
  }
}
