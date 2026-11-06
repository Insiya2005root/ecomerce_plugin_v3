// Browser walkthrough: Cart (live pricing, variants, coupon, stock) → Place order → Order page actions → Orders list.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const API = 'http://localhost:4317/api/plugins/ecommerce-plugin';
const shots = path.join(__dirname, 'shots3');
fs.rmSync(shots, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });

const problems = [];
let step = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 10000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
const waitNoText = (page, t, timeout = 10000) => page.waitForFunction((s) => !document.body.innerText.includes(s), { timeout }, t);
const apiGet = async (p) => (await fetch(`${API}${p}`)).json();

async function clickByText(page, selector, label) {
  const h = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null && !el.disabled),
    { timeout: 10000 }, selector, label
  );
  await h.asElement().click();
}
const drawerSettled = (page) => page.waitForFunction(() => {
  const d = document.querySelector('[role="dialog"]:has(form)');
  return d && d.getBoundingClientRect().right <= window.innerWidth && getComputedStyle(d).translate === 'none';
}, { timeout: 8000 });
const drawerClosed = (page) => page.waitForFunction(() => !document.querySelector('[role="dialog"]:has(form)'), { timeout: 8000 });
const summaryTotal = (page) => page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Place order ·'));
  return btn ? btn.textContent.split('·')[1].trim() : null;
});
const settled = (page) => page.waitForFunction(() => !document.body.innerText.includes('Recalculating') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Place order ·')), { timeout: 10000 });
async function typeInto(page, sel, value) {
  await page.click(sel);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (value) await page.type(sel, value);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // The admin scrolls inside #plugin-root under a sticky save bar: center targets before clicking (centerBeforeClick).
  const rawClick = page.click.bind(page);
  page.click = async (sel, opts) => {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    return rawClick(sel, opts);
  };
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

  try {
    console.log('\n--> Cart');
    await page.goto(`${BASE}/cart/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Your cart is empty');
    await page.type('#cart-product-search', 'Linen');
    await clickByText(page, '[role="option"] span', 'Linen Shirt');
    await settled(page);
    const txt = await bodyText(page);
    assert.ok(txt.includes('Linen Shirt - M White'), 'first in-stock variant chosen');
    ok('search adds a product; the first in-stock variant is picked');

    await page.click('button[aria-label="Increase quantity"]');
    for (let i = 0; i < 3; i++) await page.click('button[aria-label="Increase quantity"]');
    await waitText(page, 'Only 4 in stock');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Place order'))?.disabled);
    await shot(page, 'cart-stock-warning');
    ok('stock warning per variant (5 > 4) blocks placing the order');
    await page.click('button[aria-label="Decrease quantity"]');
    await page.click('button[aria-label="Decrease quantity"]');
    await page.click('button[aria-label="Decrease quantity"]');
    await waitNoText(page, 'Only 4 in stock');

    await page.type('#cart-product-search', 'Sample product 05');
    await clickByText(page, '[role="option"] span', 'Sample product 05');
    await settled(page);
    const before = await summaryTotal(page);
    await page.type('#coupon', 'TEN');
    await clickByText(page, 'button', 'Apply');
    await waitText(page, 'Ten percent off');
    await settled(page);
    const after = await summaryTotal(page);
    assert.notStrictEqual(before, after, 'coupon changes the total');
    ok(`coupon TEN applies live (${before} → ${after})`);

    await clickByText(page, 'button', `Place order · ${after}`);
    await waitText(page, 'Customer name is required.');
    await page.type('#name', 'Asha Patel');
    await page.type('#email', 'asha@example.com');
    await page.type('#phone', '+91 98765 43210');
    await page.type('#ship-line1', '12 Ring Road');
    await settled(page);
    await shot(page, 'cart-ready');
    const cartTotal = await summaryTotal(page);
    await page.reload({ waitUntil: 'networkidle0' });
    await settled(page);
    assert.strictEqual(await summaryTotal(page), cartTotal, 'cart persisted across reload');
    ok('validation on place; cart and customer survive a page refresh');

    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'button', `Place order · ${cartTotal}`)]);
    await waitText(page, 'Order placed');
    assert.ok(page.url().includes('ecommerce-orders?view=detail'), page.url());
    const detail = await bodyText(page);
    assert.ok(detail.includes(cartTotal), `order total ${cartTotal} matches the cart`);
    assert.ok(detail.includes('Ten percent off') && detail.includes('Admin cart') && detail.includes('Asha Patel'));
    await shot(page, 'order-detail');
    ok(`placing the order lands on the order page with the same total (${cartTotal}) and discount`);

    console.log('\n--> Order actions');
    await clickByText(page, 'button', 'Mark as paid');
    await drawerSettled(page);
    await page.type('#payment-reference', 'UTR-1');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Mark as paid');
    await waitText(page, 'Payment recorded'); await drawerClosed(page);
    await clickByText(page, 'button', 'Mark as fulfilled');
    await waitText(page, 'Mark as shipped');
    await clickByText(page, 'button', 'Mark as shipped');
    await drawerSettled(page);
    await page.type('#ship-carrier', 'Delhivery');
    await page.type('#ship-tracking', 'DL998');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Mark as shipped');
    await drawerClosed(page);
    await clickByText(page, 'button', 'Mark as delivered');
    await waitText(page, 'Marked as delivered');
    await page.type('#order-note', 'Left with the security guard');
    await clickByText(page, 'button', 'Add note');
    await waitText(page, 'Note added');
    await clickByText(page, 'button', 'Refund');
    await drawerSettled(page);
    await typeInto(page, '#refund-amount', '50');
    await page.type('#refund-reason', 'Late delivery');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Record refund');
    await waitText(page, 'Refund recorded'); await drawerClosed(page);
    const after2 = await bodyText(page);
    for (const s of ['Partially refunded', 'Delivered', 'DL998', 'Left with the security guard', 'Refunded ₹50.00 — Late delivery', 'UPI']) assert.ok(after2.includes(s), `shows ${s}`);
    await shot(page, 'order-after-actions');
    ok('mark paid → fulfilled → shipped (tracking) → delivered → note → partial refund; all on the timeline');

    console.log('\n--> Cancel');
    const linen = (await apiGet('/products?search=Linen')).products[0];
    const stockBefore = linen.variants.find((v) => v.size === 'M').stock;
    await page.goto(`${BASE}/cart/index.html`, { waitUntil: 'networkidle0' });
    await page.type('#cart-product-search', 'Linen');
    await clickByText(page, '[role="option"] span', 'Linen Shirt');
    await settled(page);
    const t2 = await summaryTotal(page);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).then(() => page.waitForNetworkIdle({ idleTime: 300 })), clickByText(page, 'button', `Place order · ${t2}`)]);
    await waitText(page, 'Order placed');
    const afterOrder = (await apiGet(`/products/${linen._id}`)).product.variants.find((v) => v.size === 'M').stock;
    assert.strictEqual(afterOrder, stockBefore - 1, 'variant stock reduced');
    await page.click('button[aria-label="Order actions"]');
    await clickByText(page, '[role="menuitem"]', 'Cancel order');
    await clickByText(page, '[role="dialog"] button', 'Cancel order');
    await waitText(page, 'This order was cancelled');
    const restocked = (await apiGet(`/products/${linen._id}`)).product.variants.find((v) => v.size === 'M').stock;
    assert.strictEqual(restocked, stockBefore, 'stock returned');
    await shot(page, 'order-cancelled');
    ok('second order reduces variant stock; cancelling returns it');

    console.log('\n--> Orders list');
    await page.goto(`${BASE}/orders/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'of 2 orders');
    await shot(page, 'orders-list');
    await page.click('#filter-payment');
    await clickByText(page, '[role="option"]', 'Partially refunded');
    await waitText(page, '1–1 of 1 orders');
    await clickByText(page, 'button', 'Clear filters');
    await waitText(page, 'of 2 orders');
    await page.click('input[type="checkbox"]');
    await waitText(page, '1–1 of 1 orders');
    assert.ok((await bodyText(page)).includes('Cancelled'));
    ok('orders list: payment filter, cancelled filter, badges');

    await page.setViewport({ width: 400, height: 860 });
    await page.goto(`${BASE}/cart/index.html`, { waitUntil: 'networkidle0' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `cart overflows by ${overflow}px`);
    await shot(page, 'cart-mobile');
    ok('cart fits a 400px screen');
  } catch (err) {
    await shot(page, 'FAILURE').catch(() => {});
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  } finally {
    console.log(`\nBrowser console errors/warnings: ${problems.length}`);
    problems.slice(0, 15).forEach((m) => console.log('  ' + m.slice(0, 300)));
    await browser.close();
  }
})();
