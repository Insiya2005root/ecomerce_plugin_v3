// Local stand-in for the OpenExt host: serves the static Admin export and the compiled plugin API (throwaway DB).
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const repo = 'C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev';
process.env.NODE_PATH = 'C:/Users/InsiyaMerchant/projects/nextcmsmains/node_modules';
Module._initPaths();
const mongoose = require('mongoose');

const OUT = path.join(repo, 'web', 'out');
const ADMIN_PREFIX = '/plugins/ecommerce-plugin/ui/admin';
const API_PREFIX = '/api/plugins/ecommerce-plugin';
const DB = 'ecommerce_plugin_ui_test';
const PORT = Number(process.env.PORT || 4317);

const routes = [];
const app = { middlewares: [async () => {}], use() {} };
for (const m of ['get', 'post', 'put', 'delete', 'patch']) app[m] = (p, h) => routes.push({ m: m.toUpperCase(), p, h });
const cms = {
  database: { user: async () => {} },
  models: { register: (n, s) => mongoose.models[n] || mongoose.model(n, s) },
  logger: { info() {}, warn() {}, error() {} },
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };

async function seed() {
  const db = mongoose.connection.db;
  await db.dropDatabase();
  const Category = mongoose.models.Category;
  const Product = mongoose.models.Product;
  const TaxClass = mongoose.models.EcommerceTaxClass;
  const apparel = await Category.create({ name: 'Apparel', tenantId: 'default_tenant' });
  const shirts = await Category.create({ name: 'Shirts', parentId: apparel._id, tenantId: 'default_tenant' });
  const home = await Category.create({ name: 'Home', tenantId: 'default_tenant' });
  if (TaxClass) await TaxClass.create({ name: 'GST 12%', code: 'GST12', status: 'Active', tenantId: 'default_tenant' });
  const swatch = (c) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${c}"/></svg>`).toString('base64')}`;
  const rows = [];
  for (let i = 1; i <= 23; i++) {
    rows.push({
      name: i === 1 ? 'Linen Shirt' : `Sample product ${String(i).padStart(2, '0')}`,
      price: 200 + i * 37,
      discountPercentage: i % 5 === 0 ? 10 : 0,
      discountPrice: i % 7 === 0 ? 150 + i * 30 : undefined,
      costPrice: i % 3 === 0 ? 120 + i * 10 : undefined,
      stock: i % 4 === 0 ? 0 : i * 3,
      sku: `SKU-T${String(i).padStart(3, '0')}`,
      categoryId: i % 2 ? shirts._id : home._id,
      status: i % 6 === 0 ? 'Draft' : i % 9 === 0 ? 'Archived' : 'Published',
      images: i % 8 === 0 ? [] : [swatch(['#c7d2fe', '#fecaca', '#bbf7d0', '#fde68a'][i % 4])],
      tags: i === 1 ? ['summer', 'linen'] : [],
      variants: i === 1 ? [{ size: 'M', color: 'White', stock: 4, sku: 'LIN-M' }, { size: 'L', color: 'White', stock: 0, priceOverride: 1300 }] : [],
      tenantId: 'default_tenant',
    });
  }
  const Collection = mongoose.models.EcommerceCollection;
  const summer = await Collection.create({ title: 'Summer 2026', tenantId: 'default_tenant' });
  rows.forEach((r, idx) => {
    if (idx < 3) r.collectionId = summer._id;
  });
  const DiscountRule = require(path.join(repo, 'plugin/ecommerce-plugin/api/models/DiscountRule.js')).getModel();
  await DiscountRule.create({ name: 'Ten percent off', code: 'TEN', type: 'percentage', value: 10, status: 'Active', tenantId: 'default_tenant' });
  for (const r of rows) {
    const doc = await Product.create(r);
    if (r.discountPercentage) await Product.collection.updateOne({ _id: doc._id }, { $set: { discountPercentage: r.discountPercentage } });
  }
}

async function handleApi(req, res, url) {
  const pathname = url.pathname.slice(API_PREFIX.length) || '/';
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  for (const r of routes) {
    if (r.m !== req.method) continue;
    const names = [];
    const re = new RegExp('^' + r.p.replace(/:([^/]+)/g, (_, n) => (names.push(n), '([^/]+)')) + '$');
    const m = pathname.match(re);
    if (!m) continue;
    const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    let status = 200;
    let payload;
    const fake = {
      status(c) { status = c; return fake; },
      json(p) { payload = p; return fake; },
      send(p) { payload = p; return fake; },
      set() { return fake; },
      setHeader() {},
    };
    if (process.env.FAIL_LIST === '1' && req.method === 'GET' && pathname === '/products') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Database unavailable (simulated)' }));
    }
    await r.h({ method: req.method, path: pathname, params, query: Object.fromEntries(url.searchParams), body, headers: req.headers, user: { id: 'admin' } }, fake);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(payload ?? {}));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'not found' }));
}

function handleStatic(res, url) {
  let rel = decodeURIComponent(url.pathname.slice(ADMIN_PREFIX.length)) || '/';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(OUT, rel);
  if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: DB });
  await require(path.join(repo, 'plugin/ecommerce-plugin/api/index.js')).register({ app, cms });
  await seed();
  http
    .createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname.startsWith(API_PREFIX)) return handleApi(req, res, url).catch((e) => { res.writeHead(500); res.end(String(e)); });
      if (url.pathname.startsWith(ADMIN_PREFIX)) return handleStatic(res, url);
      res.writeHead(404);
      res.end();
    })
    .listen(PORT, () => console.log(`HARNESS READY http://localhost:${PORT}${ADMIN_PREFIX}/products/index.html`));
})();
