import { authenticate } from "../shopify.server";
import connectDB from "../db.server";
import mongoose from "mongoose";

export const action = async ({ request }) => {
  await connectDB();
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  if (session) {
    try {
      const dbConnection = mongoose.connection.db;
      if (dbConnection) {
        await dbConnection.collection("shopify_sessions").updateOne(
          { id: session.id },
          { $set: { scope: current.toString() } }
        );
        console.log(`✅ Successfully updated session scope for shop: ${shop}`);
      }
    } catch (err) {
      console.error(`❌ Error updating session scope for ${shop}:`, err.message);
    }
  }

  return new Response();
};
