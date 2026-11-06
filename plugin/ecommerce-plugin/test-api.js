const http = require('http');

const data = JSON.stringify({
  lat1: "21.1702",
  lon1: "72.8311",
  lat2: "19.0760",
  lon2: "72.8777",
  ratePerKm: 1
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/plugins/ecommerce-plugin/shipping/calculate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});

req.on('error', console.error);
req.write(data);
req.end();
