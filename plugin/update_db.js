const mongoose = require('mongoose');
const fs = require('fs');
mongoose.connect('mongodb://127.0.0.1:27017/users').then(async () => {
  const db = mongoose.connection.db;
  const zipPath = "C:\\Users\\InsiyaMerchant\\Projects\\ecommerce-plugin-dev\\plugin\\ecommerce-plugin.zip";
  const zipBuffer = fs.readFileSync(zipPath);
  await db.collection('plugins').updateOne(
    { pluginId: 'ecommerce-plugin' },
    { $set: { source: zipBuffer } }
  );
  console.log("Database updated successfully");
  process.exit(0);
}).catch(e => {
  console.error("DB Error:", e);
  process.exit(1);
});
