const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://aarti:aarti123@cluster0.jymlw6c.mongodb.net/loyalty-cashback-store-credit?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected successfully to server");

    const db = client.db("Flow_Store_Credit_Analytics");
    const collections = await db.listCollections().toArray();
    console.log("Collections:");
    console.log(collections.map(c => c.name));

    for (const col of collections) {
      if (col.name.includes("myshopify.com")) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`Collection ${col.name} has ${count} documents.`);
        if (count > 0) {
          const sample = await db.collection(col.name).findOne({});
          console.log(`Sample document from ${col.name}:`, JSON.stringify(sample, null, 2));
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
