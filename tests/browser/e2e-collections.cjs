// Browser walkthrough: navigation bar removal, Products Export/Import, Collections, Categories.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('C:/Users/InsiyaMerchant/projects/ecommerce-plugin-dev/web/node_modules/puppeteer');

const BASE = 'http://localhost:4317/plugins/ecommerce-plugin/ui/admin';
const shots = path.join(__dirname, 'shots2');
const downloads = path.join(__dirname, 'downloads');
fs.rmSync(shots, { recursive: true, force: true });
fs.rmSync(downloads, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
fs.mkdirSync(downloads, { recursive: true });

const consoleProblems = [];
let step = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
const main = (page) => page.$eval('main', (m) => m.innerText);
const waitText = (page, t, timeout = 8000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);

async function clickByText(page, selector, label) {
  const handle = await page.waitForFunction(
    (sel, l) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === l && el.offsetParent !== null),
    { timeout: 8000 },
    selector,
    label
  );
  await handle.asElement().click();
}
async function drawerSettled(page) {
  await page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]:has(form)');
    return d && d.getBoundingClientRect().right <= window.innerWidth && getComputedStyle(d).transform === 'none';
  }, { timeout: 8000 });
}
const drawerClosed = (page) => page.waitForFunction(() => !document.querySelector('[role="dialog"]:has(form)'), { timeout: 8000 });
async function openMenu(page, ariaLabel, item) {
  // A menu that is still closing swallows the next click; wait until none is open.
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 8000 });
  await page.click(`button[aria-label="${ariaLabel}"]`);
  await clickByText(page, '[role="menuitem"]', item);
}
async function chooseOption(page, triggerId, label) {
  await page.click(`#${triggerId}`);
  await clickByText(page, '[role="option"]', label);
}
async function typeInto(page, selector, value) {
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(selector, value);
}
async function waitForDownload(dir, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const done = fs.readdirSync(dir).filter((f) => !f.endsWith('.crdownload'));
    if (done.length) return path.join(dir, done[0]);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('download did not complete');
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && consoleProblems.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => consoleProblems.push(`[pageerror] ${e.message}`));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

  try {
    console.log('\n--> Navigation + Products header');
    await page.goto(`${BASE}/products/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'of 23 results');
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert.ok(!bodyText.includes('Cart Simulator'), 'plugin button bar removed (navigation is in the OpenExt sidebar)');
    const headerButtons = await page.$$eval('main button, main a', (els) => els.map((e) => e.textContent.trim()).filter((t) => ['Export', 'Import', 'Create'].includes(t)));
    assert.deepStrictEqual(headerButtons.slice(0, 3), ['Export', 'Import', 'Create']);
    await shot(page, 'products-header');
    ok('button bar gone; header shows Export / Import / Create');

    await chooseOption(page, 'filter-collection', 'Summer 2026');
    await waitText(page, '1–3 of 3 results');
    ok('collection filter on the product list');
    await chooseOption(page, 'filter-collection', 'All collections');
    await waitText(page, 'of 23 results');

    console.log('\n--> Export');
    await clickByText(page, 'button', 'Export');
    const file = await waitForDownload(downloads);
    const csv = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const lines = csv.trim().split(/\r?\n/);
    assert.strictEqual(lines[0].split(',')[0], 'Name');
    assert.strictEqual(lines.length, 24, 'header + 23 products');
    assert.ok(csv.includes('Apparel > Shirts') && csv.includes('Summer 2026'), 'category path and collection title exported');
    await waitText(page, '23 products exported.');
    ok(`export downloaded ${path.basename(file)} with 23 products, categories and collections by name`);

    console.log('\n--> Import');
    const importCsv = [
      'Name,SKU,Price,Category,Collection,Status,Stock',
      'Imported Lamp,IMP-LAMP,1499,Home,Summer 2026,Published,7',
      'Imported Scarf,,349,Apparel > Shirts,,Draft,2',
      'Sample product 02 Renamed,SKU-T002,,,,,99',
      'Broken,,abc,Nowhere,,,',
    ].join('\n');
    const importFile = path.join(downloads, 'import-test.csv');
    fs.writeFileSync(importFile, importCsv);
    await clickByText(page, 'button', 'Import');
    await drawerSettled(page);
    await shot(page, 'import-choose');
    const input = await page.$('[role="dialog"]:has(form) input[type="file"]');
    await input.uploadFile(importFile);
    await waitText(page, 'With errors');
    const summary = await page.$$eval('[role="dialog"]:has(form) .grid > div p:first-child', (ps) => ps.map((p) => p.textContent.trim()));
    assert.deepStrictEqual(summary, ['2', '1', '1'], `preview summary ${summary}`);
    assert.ok((await page.evaluate(() => document.body.innerText)).includes('Category "Nowhere" was not found.'));
    await shot(page, 'import-preview');
    await clickByText(page, 'button', 'Import 3 products');
    await waitText(page, 'Skipped');
    await shot(page, 'import-done');
    await clickByText(page, 'button', 'Done');
    await drawerClosed(page);
    await waitText(page, 'of 25 results');
    ok('import: dry-run preview (2 new, 1 update, 1 error) → imported → list shows 25');

    console.log('\n--> Collections');
    await page.goto(`${BASE}/collections/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Summer 2026');
    assert.ok((await main(page)).includes('4'), 'Summer 2026 now has 4 products (3 seeded + imported lamp)');
    await shot(page, 'collections-list');
    await clickByText(page, 'button', 'Create');
    await drawerSettled(page);
    await page.type('#collection-title', 'Best Sellers');
    await shot(page, 'collection-create');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, '[role="dialog"]:has(form) button', 'Create')]);
    await waitText(page, 'Collection created');
    assert.ok((await main(page)).includes('/best-sellers'), 'handle derived from title');
    ok('create collection in a drawer → lands on its detail page');

    await clickByText(page, 'button', 'Add products');
    await drawerSettled(page);
    await waitText(page, 'Sample product 05');
    assert.ok((await page.evaluate(() => document.body.innerText)).includes('In “Summer 2026”'), 'picker shows current collection');
    const labels = await page.$$('[role="dialog"]:has(form) label');
    await labels[0].click();
    await labels[1].click();
    await shot(page, 'collection-add-products');
    await clickByText(page, 'button', 'Add 2 products');
    await waitText(page, 'Added 2 products');
    await drawerClosed(page);
    await page.waitForFunction(() => document.querySelectorAll('main ul li a').length >= 2);
    ok('add products picker: search list, current collection shown, adds 2');

    await page.click('main ul li button[aria-label^="Actions for"]');
    await clickByText(page, '[role="menuitem"]', 'Remove from collection');
    await waitText(page, 'Removed from collection');
    await page.waitForFunction(() => document.querySelectorAll('main ul li a').length === 1);
    ok('remove a product from the collection');

    console.log('   · open edit menu; menus in DOM:', await page.$$eval('[role="menu"]', (m) => m.map((x) => x.outerHTML.slice(0, 120))));
    await openMenu(page, 'Collection actions', 'Edit');
    console.log('   · menu clicked');
    await drawerSettled(page);
    console.log('   · settled');
    await typeInto(page, '#collection-title', 'Best Sellers 2026');
    console.log('   · typed');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Save');
    console.log('   · save clicked');
    await waitText(page, 'Collection saved');
    console.log('   · toast');
    await drawerClosed(page);
    await shot(page, 'collection-detail');
    ok('edit collection title in a drawer');

    console.log('\n--> Product ↔ collection');
    await page.goto(`${BASE}/products/index.html?q=Sample%20product%2005`, { waitUntil: 'networkidle0' });
    await waitText(page, '1–1 of 1 results');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('tbody tr td:nth-child(3)')]);
    await waitText(page, 'Organization');
    await openMenu(page, 'Organization actions', 'Edit organization');
    await drawerSettled(page);
    await chooseOption(page, 'collectionId', 'Summer 2026');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Save');
    await waitText(page, 'Changes saved');
    await drawerClosed(page);
    const org = await main(page);
    assert.ok(org.includes('Summer 2026') && org.includes('Apparel › Shirts'));
    await shot(page, 'product-organization');
    ok('product drawer sets collection; detail links to collection and category');

    console.log('\n--> Categories');
    await page.goto(`${BASE}/categories/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Shirts');
    const indent = await page.$$eval('tbody tr td:first-child > div', (divs) =>
      divs.map((d) => ({ text: d.innerText.replace('└', '').trim(), pad: d.style.paddingLeft }))
    );
    assert.deepStrictEqual(indent.find((r) => r.text === 'Shirts').pad, '20px', 'Shirts indented under Apparel');
    await shot(page, 'categories-tree');
    ok('categories show as an indented tree with counts');

    await clickByText(page, 'button', 'Create');
    await drawerSettled(page);
    await page.type('#category-name', 'Kitchen & Dining');
    assert.strictEqual(await page.$eval('#category-slug', (i) => i.value), 'kitchen-dining', 'handle follows name');
    await chooseOption(page, 'category-parent', 'Home');
    await clickByText(page, '[role="dialog"]:has(form) button', 'Create');
    await waitText(page, 'Category created');
    await drawerClosed(page);
    await waitText(page, 'Kitchen & Dining');
    ok('create category with a parent from the drawer');

    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickByText(page, 'tbody a', 'Apparel')]);
    await waitText(page, 'Subcategories');
    await openMenu(page, 'Category actions', 'Edit');
    await drawerSettled(page);
    await page.click('#category-parent');
    const parentChoices = await page.$$eval('[role="option"]', (os) => os.map((o) => o.textContent.trim()));
    assert.ok(!parentChoices.some((t) => t.startsWith('Apparel')), 'cannot pick itself or its own subcategories as parent');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await drawerClosed(page);
    await shot(page, 'category-detail');
    ok('category detail: products, parent, subcategories; parent picker excludes its own subtree');

    await openMenu(page, 'Category actions', 'Delete');
    await clickByText(page, '[role="dialog"] button', 'Delete');
    await waitText(page, 'Could not delete category');
    ok('deleting a category that is in use shows the backend reason');

    await page.goto(`${BASE}/categories/edit/index.html?id=nope`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname.includes('/categories/detail/'));
    ok('old categories/edit URL redirects to the new detail page');

    await page.setViewport({ width: 400, height: 860 });
    await page.goto(`${BASE}/collections/index.html`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Summer 2026');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
    await shot(page, 'collections-mobile');
    ok('collections page fits a 400px screen');
  } catch (err) {
    await shot(page, 'FAILURE').catch(() => {});
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  } finally {
    console.log(`\nBrowser console errors/warnings: ${consoleProblems.length}`);
    consoleProblems.slice(0, 20).forEach((m) => console.log('  ' + m.slice(0, 300)));
    await browser.close();
  }
})();
