// Local stand-in for the OpenExt host (Mount API, no iframe): a runtime page with #plugin-root that imports
// ui/admin/mount.js like OpenExt does, the plugin files, and the compiled plugin API (throwaway DB).
// Old iframe-style URLs (/plugins/ecommerce-plugin/ui/admin/<page>/index.html) redirect to the runtime URL.
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const repo = 'C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev';
process.env.NODE_PATH = 'C:/Users/InsiyaMerchant/projects/nextcmsmains/node_modules';
Module._initPaths();
const mongoose = require('mongoose');

const PLUGIN_DIR = path.join(repo, 'plugin', 'ecommerce-plugin');
const PLUGIN_PREFIX = '/plugins/ecommerce-plugin';
const ADMIN_PREFIX = '/plugins/ecommerce-plugin/ui/admin';
const RUNTIME_PREFIX = '/dashboard/plugins/runtime/ecommerce-plugin';
const MANIFEST = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
const API_PREFIX = '/api/plugins/ecommerce-plugin';
const DB = 'ecommerce_plugin_ui_test';
// OpenExt keeps Pages in their own database; the plugin writes its storefront pages there.
const PAGES_DB = 'ecommerce_plugin_ui_test_pages';
let pagesConn = null;
const PORT = Number(process.env.PORT || 4317);

const routes = [];
const app = { middlewares: [async () => {}], use() {} };
for (const m of ['get', 'post', 'put', 'delete', 'patch']) app[m] = (p, h) => routes.push({ m: m.toUpperCase(), p, h });
const cms = {
  database: { user: async () => {}, page: async () => pagesConn },
  models: { register: (n, s) => mongoose.models[n] || mongoose.model(n, s) },
  logger: { info() {}, warn() {}, error() {} },
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };

// The site Header and Footer pages, as a merchant would set them up in OpenExt Pages: the header holds
// the plugin's cart button and search blocks.
const pluginBlock = (uniqueId, blockType, settings = {}) => ({ uniqueId, type: 'ecommerce-plugin', content: JSON.stringify({ blockType, settings }), style: { width: '100%' } });
async function seedSiteChrome() {
  const pages = pagesConn.collection('pages');
  const base = { isPublished: true, isGlobal: true, isHome: false, locale: 'en', modifications: [], createdAt: new Date(), updatedAt: new Date() };
  await pages.insertMany([
    {
      ...base,
      pageName: 'Main Header',
      slug: 'header-main-header',
      pageType: 'header',
      component: [
        { uniqueId: 'site-brand', type: 'text', content: 'Demo Store' },
        pluginBlock('site-search', 'ecommerce.product-search'),
        pluginBlock('site-cart', 'ecommerce.cart-button'),
      ],
    },
    { ...base, pageName: 'Main Footer', slug: 'footer-main-footer', pageType: 'footer', component: [{ uniqueId: 'site-footer-text', type: 'text', content: '© Demo Store · Contact us' }] },
  ]);
}

async function seed() {
  const db = mongoose.connection.db;
  await db.dropDatabase();
  await pagesConn.db.dropDatabase();
  await seedSiteChrome();
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
    // Calls from the public storefront pages are anonymous shoppers: no user, and the plugin's own auth
    // middleware decides (as in OpenExt), so only its public routes answer.
    const referer = (() => { try { return new URL(req.headers.referer || '').pathname; } catch { return ''; } })();
    const anonymous = STOREFRONT_PATHS.includes(referer) || req.headers['x-shopper'] === '1';
    const reqObj = { method: req.method, path: pathname, params, query: Object.fromEntries(url.searchParams), body, headers: req.headers, user: anonymous ? null : { id: 'admin' } };
    if (anonymous) await app.middlewares[0](reqObj, fake, () => r.h(reqObj, fake));
    else await r.h(reqObj, fake);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(payload ?? {}));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'not found' }));
}

function handlePluginFile(res, url) {
  const rel = decodeURIComponent(url.pathname.slice(PLUGIN_PREFIX.length));
  const file = path.join(PLUGIN_DIR, rel);
  if (!file.startsWith(PLUGIN_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// Old static-export page paths → (adminNav id, view), so the walkthroughs can keep their goto() lines.
const SECTION_OF = {
  '': 'ecommerce-dashboard', products: 'ecommerce-products', collections: 'ecommerce-collections', categories: 'ecommerce-categories',
  inventory: 'ecommerce-inventory', 'inventory/reservations': 'ecommerce-inventory-reservations', orders: 'ecommerce-orders',
  cart: 'ecommerce-cart', customers: 'ecommerce-customers', discounts: 'ecommerce-discounts',
  'discounts/all': 'ecommerce-discounts-automatic', 'discounts/coupons': 'ecommerce-discounts-coupons',
  'discounts/campaigns': 'ecommerce-discounts-campaigns', 'discounts/custom': 'ecommerce-discounts-custom',
  settings: 'ecommerce-settings', 'settings/general': 'ecommerce-settings-general', 'settings/profile': 'ecommerce-settings-profile',
  'settings/tax': 'ecommerce-settings-tax', 'settings/shipping': 'ecommerce-settings-shipping', 'settings/locations': 'ecommerce-settings-locations',
};
function legacyRedirect(res, url) {
  const parts = url.pathname.slice(ADMIN_PREFIX.length).replace(/index\.html$/, '').split('/').filter(Boolean);
  let view = '';
  if (['add', 'detail', 'edit'].includes(parts.at(-1)) || (parts.join('/') === 'inventory/stock')) view = parts.pop();
  const navId = SECTION_OF[parts.join('/')];
  if (!navId) return false;
  const qs = new URLSearchParams(url.search);
  const query = view ? `view=${view}${qs.toString() ? `&${qs}` : ''}` : qs.toString();
  res.writeHead(302, { Location: `${RUNTIME_PREFIX}/${navId}${query ? `?${query}` : ''}` });
  res.end();
  return true;
}

// Mimics an OpenExt public page (src/app/[slug]/page.tsx → SiteChromeLayout): the site Header page, the
// page's own blocks, then the Footer page, all from OpenExt Pages. Plugin blocks load manifest.styles and
// blockEntry as ExternalPluginBlock does and mount through
// window.__NEXTCMS_PLUGINS__['ecommerce-plugin'].mount(el, { block, isEditing }) with the stored block.
// OpenExt's own blocks (text, hero, feature list) render as plain stand-ins with the same text.
// Visitors are anonymous shoppers.
const STOREFRONT_PATHS = ['/shop', '/product', '/cart', '/checkout', '/track-order'];
function storefrontPage(pageType) {
  const styles = (MANIFEST.styles || []).map((s) => `${PLUGIN_PREFIX}/${s}`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Store · ${pageType}</title>
${styles.map((h) => `<link rel="stylesheet" href="${h}">`).join('\n')}
<style>
  /* OpenExt public site global CSS (unlayered), as on a real page */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.6; background: #fff; color: #1f2937; }
  input, button { transition: all 0.3s ease; }
  h1 { font-size: 1.875rem; font-weight: 700; } h2 { font-size: 1.5rem; font-weight: 600; }
  .w-full { width: 100%; }
  #site-header { display: flex; align-items: center; gap: 16px; padding: 8px 24px; border-bottom: 1px solid #e5e7eb; }
  #site-header > .w-full { width: auto; flex: 1; min-width: 0; }
  .native { padding: 32px 24px; text-align: center; }
  .native-features { display: flex; gap: 24px; justify-content: center; }
</style></head><body>
<header id="site-header" class="rendered-page"></header>
<main id="page"></main>
<footer id="site-footer" class="rendered-page"></footer>
<script src="${PLUGIN_PREFIX}/${MANIFEST.blockEntry}"></script>
<script>
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function nativeHtml(block) {
    let c = {};
    try { c = typeof block.content === 'string' && block.content.startsWith('{') ? JSON.parse(block.content) : {}; } catch {}
    if (block.type === 'text') return '<div class="native" data-native="text">' + esc(block.content) + '</div>';
    if (block.type === 'hero-centered' || block.type === 'hero-main') {
      return '<section class="native" data-native="' + block.type + '"><img alt="" src="' + esc(c.image) + '" style="width:120px;margin:0 auto 12px"><h1>' + esc(c.title) + '</h1><p>' + esc(c.description) + '</p></section>';
    }
    if (block.type === 'feature-trio') {
      return '<section class="native" data-native="feature-trio"><h2>' + esc(c.mainTitle) + '</h2><div class="native-features">' +
        (c.features || []).map((f) => '<div><h3>' + esc(f.title) + '</h3><p>' + esc(f.description) + '</p><a href="' + esc(f.url || '#') + '">' + esc(f.linkText) + '</a></div>').join('') + '</div></section>';
    }
    return '<div class="native" data-native="' + esc(block.type) + '"></div>';
  }
  function renderInto(container, blocks) {
    for (const block of blocks || []) {
      const wrap = document.createElement('div');
      wrap.className = 'w-full';
      container.appendChild(wrap);
      if (block.type !== 'ecommerce-plugin') { wrap.innerHTML = nativeHtml(block); continue; }
      const el = document.createElement('div');
      el.dataset.pluginBlock = block.uniqueId;
      wrap.appendChild(el);
      window.__NEXTCMS_PLUGINS__['ecommerce-plugin'].mount(el, { block, isEditing: false });
    }
  }
  (async () => {
    const res = await fetch('/__cms/page?slug=${pageType}');
    const body = await res.json();
    renderInto(document.getElementById('site-header'), body.headerBlocks);
    renderInto(document.getElementById('page'), body.page ? body.page.component : []);
    renderInto(document.getElementById('site-footer'), body.footerBlocks);
  })();
</script></body></html>`;
}

// Mimics OpenExt's /dashboard/plugins/runtime/[pluginId]/[[...slug]] page: sidebar from adminNav, a keyed
// div#plugin-root per page (absolute, scrolling, white, padded), manifest.styles injected under
// @scope (#plugin-root), mount(el, ctx) via dynamic import, the previous page unmounted after the new mount,
// and window.next.router for soft navigation. A few deliberately hostile host rules check style isolation.
function runtimePage() {
  const nav = MANIFEST.adminNav.map(({ id, label }) => ({ id, label }));
  const styles = (MANIFEST.styles || []).map((s) => `${PLUGIN_PREFIX}/${s}`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OpenExt runtime (local)</title>
<style>
  body { margin: 0; font: 14px system-ui, sans-serif; color: #111; }
  .shell { display: flex; height: 100vh; }
  aside { width: 210px; flex-shrink: 0; border-right: 1px solid #ddd; overflow: auto; padding: 8px; background: #fafafa; }
  aside a { display: block; padding: 4px 8px; border-radius: 4px; color: #333; text-decoration: none; font-size: 13px; }
  aside a.on { background: #e5e5e5; font-weight: 600; }
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  header { height: 40px; flex-shrink: 0; border-bottom: 1px solid #ddd; display: flex; align-items: center; gap: 12px; padding: 0 12px; }
  #stage { position: relative; flex: 1; min-height: 0; }
  #stage > div { position: absolute; inset: 0; overflow: auto; background: #fff; padding: 16px; }
  html.dark body { background: #111; color: #eee; } html.dark aside { background: #1a1a1a; }
  /* OpenExt's own global rules (src/styles/globals.css + Tailwind v3 preflight), unlayered: must not win inside the plugin */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.6; }
  input, button { transition: all 0.3s ease; }
  h1 { font-size: 1.875rem; font-weight: 700; } h2 { font-size: 1.5rem; font-weight: 600; }
  button, [type="button"], [type="reset"], [type="submit"] { -webkit-appearance: button; background-color: transparent; background-image: none; }
</style></head><body>
<div class="shell"><aside id="host-nav"></aside><div class="main">
  <header><strong>OpenExt (local runtime)</strong><button id="host-theme" type="button">Toggle dark</button></header>
  <div id="stage"></div></div></div>
<script type="module">
  const NAV = ${JSON.stringify(nav)};
  const STYLES = ${JSON.stringify(styles)};
  const BASE = ${JSON.stringify(RUNTIME_PREFIX)};
  for (const href of STYLES) {
    const css = await (await fetch(href)).text();
    const s = document.createElement('style');
    s.textContent = '@scope (#plugin-root) {\\n' + css + '\\n}';
    document.head.appendChild(s);
  }
  const mod = await import('${ADMIN_PREFIX}/mount.js');
  let current = null;
  const navIdFromUrl = () => decodeURIComponent(location.pathname.slice(BASE.length + 1).split('/')[0] || '') || NAV[0].id;
  async function render() {
    const navId = navIdFromUrl();
    if (current && current.navId === navId) return;
    const old = current;
    old?.el.remove();
    const el = document.createElement('div');
    el.id = 'plugin-root';
    el.dataset.pageId = navId;
    document.getElementById('stage').appendChild(el);
    const handle = await mod.mount(el, { pluginId: 'ecommerce-plugin', pageId: navId, features: '*', assetBase: '/plugins/ecommerce-plugin/', apiBase: '/api/plugins/ecommerce-plugin/' });
    if (old) await (old.handle?.unmount ? old.handle.unmount() : mod.unmount?.());
    current = { navId, el, handle };
    document.querySelectorAll('#host-nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === navId));
    window.__hostMounts = (window.__hostMounts || 0) + 1;
  }
  window.next = { router: {
    push(h) { history.pushState({ __NA: true }, '', h); render(); },
    replace(h) { history.replaceState({ __NA: true }, '', h); render(); },
  } };
  const navEl = document.getElementById('host-nav');
  for (const item of NAV) {
    const a = document.createElement('a');
    a.href = BASE + '/' + item.id; a.textContent = item.label; a.dataset.id = item.id;
    a.addEventListener('click', (e) => { e.preventDefault(); window.next.router.push(a.getAttribute('href')); });
    navEl.appendChild(a);
  }
  document.getElementById('host-theme').addEventListener('click', () => document.documentElement.classList.toggle('dark'));
  window.addEventListener('popstate', () => render());
  render();
</script></body></html>`;
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

// What OpenExt's getPageData gives a public page: the page's blocks plus the site Header and Footer;
// PUT stands in for saving the page in OpenExt's page builder.
async function handleCmsPage(req, res, url) {
  const pages = pagesConn.collection('pages');
  const slug = url.searchParams.get('slug');
  if (req.method === 'PUT') {
    const { component } = await readJson(req);
    // Upsert, so a test can also add a new page (e.g. an order-status page made in the page builder).
    await pages.updateOne({ slug, pageType: 'page' }, { $set: { component, isPublished: true, updatedAt: new Date() } }, { upsert: true });
  }
  const page = await pages.findOne({ slug, pageType: 'page' });
  const header = await pages.findOne({ pageType: 'header', isPublished: true });
  const footer = await pages.findOne({ pageType: 'footer', isPublished: true });
  res.writeHead(page ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ page, headerBlocks: header?.component || [], footerBlocks: footer?.component || [] }));
}

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017', { dbName: DB });
  pagesConn = await mongoose.createConnection('mongodb://127.0.0.1:27017', { dbName: PAGES_DB }).asPromise();
  await require(path.join(repo, 'plugin/ecommerce-plugin/api/index.js')).register({ app, cms });
  await seed();
  // Products seeded straight into the DB get inventory records, as at plugin start-up in OpenExt.
  await require(path.join(repo, 'plugin/ecommerce-plugin/api/services/InventoryService.js')).InventoryService.syncAll();
  // The seed wiped the databases: create the storefront pages again, as on a fresh install.
  await require(path.join(repo, 'plugin/ecommerce-plugin/api/services/StorefrontBlueprintService.js')).StorefrontBlueprintService.ensureProvisionedForTenant('default_tenant');
  http
    .createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname.startsWith(API_PREFIX)) return handleApi(req, res, url).catch((e) => { res.writeHead(500); res.end(String(e)); });
      if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
      if (url.pathname === '/__cms/page') return handleCmsPage(req, res, url).catch((e) => { res.writeHead(500); res.end(String(e)); });
      if (STOREFRONT_PATHS.includes(url.pathname)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(storefrontPage(url.pathname.slice(1)));
      }
      if (url.pathname.startsWith(RUNTIME_PREFIX)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(runtimePage());
      }
      if (url.pathname.startsWith(ADMIN_PREFIX) && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')) && legacyRedirect(res, url)) return;
      if (url.pathname.startsWith(PLUGIN_PREFIX)) return handlePluginFile(res, url);
      res.writeHead(404);
      res.end();
    })
    .listen(PORT, () => console.log(`HARNESS READY http://localhost:${PORT}${RUNTIME_PREFIX}/ecommerce-products`));
})();
