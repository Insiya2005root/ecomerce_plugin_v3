const http = require('http');
const url = `http://router.project-osrm.org/route/v1/driving/72.8311,21.1702;72.8777,19.0760?overview=false`;

http.get(url, { headers: { 'User-Agent': 'NodeJS/ecommerce-plugin' } }, (resp) => {
  let body = '';
  resp.on('data', (chunk) => body += chunk);
  resp.on('end', () => {
    try {
      console.log("Success:", JSON.parse(body));
    } catch (err) {
      console.log("Error parsing:", err);
    }
  });
}).on('error', (e) => console.log(e));
