import connectMongoDB from "../db.mongodb.server";

/**
 * GET /api/hello
 * A simple hello API endpoint that connects to MongoDB and returns status information.
 */
export async function loader() {
  try {
    console.log("🚀 Hello API called! Connecting to MongoDB...");
    const conn = await connectMongoDB();
    
    // Connection readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const isConnected = conn.connection.readyState === 1;

    return Response.json({
      message: "Hello from the Shopify App MongoDB API!",
      timestamp: new Date().toISOString(),
      database: {
        type: "MongoDB",
        connected: isConnected,
        host: conn.connection.host,
        name: conn.connection.name,
      }
    });
  } catch (error) {
    console.error("❌ Error in Hello API:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to connect to MongoDB",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
