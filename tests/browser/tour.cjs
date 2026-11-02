// Screenshot tour of every admin page at 1440px, for a visual review.
const fs = require('fs'), path = require('path');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');
const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const out = path.join(__dirname, 'tour'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const api = async (p, b, m = 'POST') => (await fetch(API + p, b ? { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : {})).json();
(async () => {
  const products = (await api('/products?limit=50')).products;
  const p = (n) => products.find((x) => x.name === n);
  const addr = { addressLine1: '1 MG Road', city: 'Surat', state: 'Gujarat', postalCode: '395007', country: 'India' };
  const o1 = await api('/checkout', { customerDetails: { name: 'Ravi Shah', email: 'ravi@example.com', phone: '+91 98250 11111' }, customerAddress: addr, items: [{ productId: p('Sample product 05')._id, quantity: 2 }], couponCode: 'TEN' });
  await api('/checkout', { customerDetails: { name: 'Neha Iyer', email: 'neha@example.com' }, customerAddress: addr, items: [{ productId: p('Sample product 07')._id, quantity: 1 }] });
  await api(`/orders/${o1.orderId}/payment`, { action: 'capture', method: 'UPI' });
  const loc = (await api('/locations', { name: 'Surat warehouse', addressLine1: '12 Ring Road', city: 'Surat', state: 'Gujarat', postalCode: '395002', latitude: 21.17, longitude: 72.83 })).location;
  await api('/taxes/migrate');
  const cls = (await api('/taxes/classes')).classes[0];
  const coll = (await api('/collections')).collections?.[0];
  const cat = (await api('/categories')).categories?.[0];
  const disc = (await api('/discounts')).rules?.[0];
  const pages = [
    ['dashboard', 'index.html'], ['products', 'products/index.html'], ['product-detail', `products/detail/index.html?id=${p('Sample product 05')._id}`],
    ['product-add', 'products/add/index.html'], ['collections', 'collections/index.html'], coll && ['collection-detail', `collections/detail/index.html?id=${coll._id}`],
    ['categories', 'categories/index.html'], cat && ['category-detail', `categories/detail/index.html?id=${cat._id}`],
    ['orders', 'orders/index.html'], ['order-detail', `orders/detail/index.html?id=${o1.orderId}`], ['cart', 'cart/index.html'],
    ['customers', 'customers/index.html'], ['customer-detail', `customers/detail/index.html?email=ravi%40example.com`],
    ['promotions', 'discounts/index.html'], ['promo-coupons', 'discounts/coupons/index.html'], ['promo-add', 'discounts/coupons/add/index.html'],
    disc && ['promo-detail', `discounts/detail/index.html?id=${disc._id}`], ['promo-custom-add', 'discounts/custom/add/index.html'],
    ['settings', 'settings/index.html'], ['settings-general', 'settings/general/index.html'], ['settings-profile', 'settings/profile/index.html'],
    ['settings-tax', 'settings/tax/index.html'], cls && ['settings-tax-detail', `settings/tax/detail/index.html?id=${cls._id}`],
    ['settings-shipping', 'settings/shipping/index.html'], ['settings-locations', 'settings/locations/index.html'], ['settings-location', `settings/locations/detail/index.html?id=${loc._id}`],
  ].filter(Boolean);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`[console] ${m.text()}`));
  let i = 0;
  for (const [name, url] of pages) {
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) problems.push(`[overflow] ${name}`);
    await page.screenshot({ path: path.join(out, `${String(++i).padStart(2, '0')}-${name}.jpg`), type: 'jpeg', quality: 60, fullPage: true });
  }
  // Location panel: type a PIN and pick a city.
  await page.goto(`${BASE}/settings/locations/index.html`, { waitUntil: 'networkidle0' });
  const add = await page.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add location'));
  await add.asElement().click();
  await page.waitForSelector('#loc-pin');
  await page.type('#loc-name', 'Mumbai store');
  await page.type('#loc-pin', '400050');
  try { await page.waitForFunction(() => document.body.innerText.includes('map pin found'), { timeout: 20000 }); } catch { problems.push('[pin] lookup did not finish'); }
  await page.click('#loc-city');
  await page.screenshot({ path: path.join(out, `${String(++i).padStart(2, '0')}-location-panel-pin.jpg`), type: 'jpeg', quality: 70 });
  console.log('state now:', await page.$eval('#loc-state', (e) => e.textContent.trim()), '| city:', await page.$eval('#loc-city', (e) => e.value));
  await page.$eval('#loc-city', (e) => { e.focus(); });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace');
  await page.type('#loc-city', 'ahmed');
  await page.waitForSelector('[role="option"]');
  console.log('city suggestions:', await page.$$eval('[role="option"]', (o) => o.map((x) => x.textContent.trim()).slice(0, 4)));
  await page.screenshot({ path: path.join(out, `${String(++i).padStart(2, '0')}-location-panel-city.jpg`), type: 'jpeg', quality: 70 });
  await browser.close();
  console.log('pages:', pages.length, 'problems:', problems.length); problems.forEach((p) => console.log('  ', p));
})();
