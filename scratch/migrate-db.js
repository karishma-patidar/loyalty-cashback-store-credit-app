import dns from "node:dns";
// Force Google DNS to resolve mongodb+srv:// SRV records
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in your .env file.");
  process.exit(1);
}

async function migrate() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    const srcDb = client.db("orders");
    const destDb = client.db("loyalty-cashback-store-credit");

    console.log("Fetching collections from 'orders' database...");
    const collections = await srcDb.listCollections().toArray();

    for (const colInfo of collections) {
      const colName = colInfo.name;
      
      // Skip system collections if any
      if (colName.startsWith("system.")) continue;

      console.log(`Migrating collection '${colName}'...`);
      const srcCol = srcDb.collection(colName);
      const destCol = destDb.collection(colName);

      const docs = await srcCol.find({}).toArray();
      if (docs.length === 0) {
        console.log(`ℹ️ Collection '${colName}' is empty. Skipping.`);
        continue;
      }

      console.log(`Found ${docs.length} documents in '${colName}'. Copying...`);
      
      // Clear target collection first to avoid duplicates
      await destCol.deleteMany({});
      await destCol.insertMany(docs);
      console.log(`✅ Successfully copied ${docs.length} documents to 'loyalty-cashback-store-credit.${colName}'.`);
    }

    console.log("\n🎉 Database migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during database migration:", error);
  } finally {
    await client.close();
  }
}

migrate();
