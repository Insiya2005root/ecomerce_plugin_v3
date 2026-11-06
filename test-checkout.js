const http = require('http');

const req = http.request('http://localhost:3000/api/plugins/ecommerce-plugin/products', { method: 'GET' }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.products || parsed.products.length === 0) {
        console.log("No products found! Please add a product first.");
        return;
      }
      
      const product = parsed.products[0];
      const payload = JSON.stringify({
        customerDetails: {
          name: "Test Customer",
          email: "test@example.com",
          address: "123 Test Ave, Testing City"
        },
        items: [
          { productId: product._id, quantity: 1 }
        ]
      });

      const postReq = http.request('http://localhost:3000/api/plugins/ecommerce-plugin/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (postRes) => {
        let postData = '';
        postRes.on('data', chunk => postData += chunk);
        postRes.on('end', () => {
          console.log("Checkout Response:", postData);
        });
      });
      
      postReq.write(payload);
      postReq.end();

    } catch(e) {
      console.log("Error:", e.message);
    }
  });
});
req.end();