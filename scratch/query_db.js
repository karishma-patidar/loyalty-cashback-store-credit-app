import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGODB_URI, { dbName: "orders" });
  console.log("Connected to MongoDB orders db");

  // Get collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  // Find collections that are shop domains
  const shopCollections = collections.filter(c => c.name.includes(".myshopify.com"));
  
  for (const col of shopCollections) {
    const data = await mongoose.connection.db.collection(col.name).find({}).toArray();
    console.log(`\nCollection: ${col.name} (${data.length} docs)`);
    for (const doc of data) {
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          if (ev.status === "Cancelled") {
            console.log("Found Cancelled Event:", {
              _id: ev._id,
              orderId: ev.orderId,
              orderName: ev.orderName,
              status: ev.status,
              cancellationReason: ev.cancellationReason,
              cancelledAt: ev.cancelledAt,
            });
          }
        }
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
