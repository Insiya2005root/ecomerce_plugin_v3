const mongoose = require('mongoose');
async function run() {
  const conn = await mongoose.connect('mongodb://127.0.0.1:27017/');
  const adminDb = conn.connection.db.admin();
  const info = await adminDb.listDatabases();
  
  for (const dbInfo of info.databases) {
    const db = conn.connection.client.db(dbInfo.name);
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);
    if (names.includes('ecommerceproducts') || names.includes('ecommercecategories')) {
      console.log(`FOUND IN DB: ${dbInfo.name}`);
      console.log(`Collections: ${names.join(', ')}`);
      
      const count = await db.collection('ecommerceproducts').countDocuments();
      console.log(`Products count: ${count}`);
    }
  }
  process.exit(0);
}
run().catch(console.error);