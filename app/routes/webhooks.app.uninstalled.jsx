import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import mongoose from "mongoose";

export const action = async ({ request }) => {
  await connectDB();
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    try {
      const dbConnection = mongoose.connection.db;
      if (dbConnection) {
        await dbConnection.collection("shopify_sessions").deleteMany({ shop });
        console.log(`✅ Successfully deleted sessions for shop in uninstalled hook: ${shop}`);
      }
    } catch (err) {
      console.error(`❌ Error deleting sessions in uninstalled hook for ${shop}:`, err.message);
    }
  }

  return new Response();
};
