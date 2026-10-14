const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect('mongodb://127.0.0.1:27017/OpenNextCMS'); 
  
  const db = mongoose.connection;
  const collection = db.collection('ecommerceorders');
  
  await collection.deleteMany({}); // clear first to avoid duplicates
  
  await collection.insertMany([
    {
      tenantId: 'default_tenant',
      orderNumber: 'ORD-982341',
      customerDetails: { name: 'Alice Smith', email: 'alice@example.com', address: '456 Tech Lane, Silicon Valley' },
      items: [{ name: 'Wireless Headphones', price: 99.99, quantity: 1 }],
      pricing: { subtotal: 99.99, tax: 9.99, shipping: 0, totalAmount: 109.98 },
      status: 'Shipped',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      tenantId: 'default_tenant',
      orderNumber: 'ORD-104928',
      customerDetails: { name: 'Bob Jones', email: 'bob@jones.com', address: '789 Startup Blvd, Austin TX' },
      items: [{ name: 'Mechanical Keyboard', price: 129.50, quantity: 2 }],
      pricing: { subtotal: 259.00, tax: 25.90, shipping: 0, totalAmount: 284.90 },
      status: 'Processing',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  
  console.log('Seeded OpenNextCMS database!');
  process.exit(0);
}
seed().catch(console.error);