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
  issuedAmount: Number,
  currency: String,
  exchangeRate: Number,
  status: String,
  emailStatus: String,
  emailFailReason: String,
  redeemedAmount: Number,
  programType: String,
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

const appSettingsSchema = new mongoose.Schema({
  shop: { type: String, required: true, unique: true },
  onboardingCompleted: { type: Boolean, default: false }
}, { timestamps: true });

export const AppSettingsModel = mongoose.models.AppSettings || mongoose.model("AppSettings", appSettingsSchema);

export async function getAppSettings(shop) {
  if (!shop) return null;
  await connectMongoDB();
  let settings = await AppSettingsModel.findOne({ shop });
  if (!settings) {
    settings = await AppSettingsModel.create({ shop, onboardingCompleted: false });
  }
  return settings;
}

export async function updateAppSettings(shop, updates) {
  if (!shop) return null;
  await connectMongoDB();
  return await AppSettingsModel.findOneAndUpdate(
    { shop },
    { $set: updates },
    { new: true, upsert: true }
  );
}

// Dynamic model retrieval/compilation per shop (collection name corresponds to the shop's domain)
export function getShopModel(shop) {
  if (!shop) return null;
  return mongoose.models[shop] || mongoose.model(shop, shopSchema, shop);
}

// Alias for getShopModel to support both import conventions in route and processor files
export const getCustomerModel = getShopModel;

export async function migrateShopData(shop) {
  if (!shop) return;
  try {
    const ShopModel = getShopModel(shop);
    if (!ShopModel) return;

    const rawCollection = ShopModel.collection;
    const docs = await rawCollection.find({}).toArray();
    for (const doc of docs) {
      let changed = false;
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          // Rename amount to issuedAmount
          if ('amount' in ev) {
            ev.issuedAmount = ev.amount;
            delete ev.amount;
            changed = true;
          }
          // Rename type to programType
          if ('type' in ev) {
            ev.programType = ev.type;
            delete ev.type;
            changed = true;
          }
        }
      }
      if (changed) {
        await rawCollection.updateOne({ _id: doc._id }, { $set: { events: doc.events } });
      }
    }

    // Now run the "Custom Program" to "Cashback" migration on programType
    await ShopModel.updateMany(
      { "events.programType": "Custom Program" },
      { $set: { "events.$[elem].programType": "Cashback" } },
      { arrayFilters: [{ "elem.programType": "Custom Program" }] }
    );
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
