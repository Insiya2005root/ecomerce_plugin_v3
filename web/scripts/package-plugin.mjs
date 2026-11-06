import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSZip = require('C:\\Users\\InsiyaMerchant\\Projects\\nextcmsmains\\node_modules\\jszip');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const pluginDir = path.join(repoRoot, 'plugin', 'ecommerce-plugin');
const adminUiDir = path.join(pluginDir, 'ui', 'admin');

async function collectFiles(dir, baseDir = dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      // Never include node_modules, src, or .git in the runtime ZIP
      if (entry.name === 'node_modules' || entry.name === 'src' || entry.name === '.git') {
        continue;
      }
      results.push(...(await collectFiles(fullPath, baseDir)));
    } else if (entry.isFile()) {
      // Only include runtime files: manifest.json, package.json, ui/**, api/**
      if (
        relPath === 'manifest.json' ||
        relPath === 'package.json' ||
        relPath.startsWith('ui/') ||
        relPath.startsWith('api/')
      ) {
        if (relPath.endsWith('.txt')) continue;
        results.push({ fullPath, relPath });
      }
    }
  }
  return results;
}

async function packagePlugin() {
  // 1. ui/admin is produced by scripts/build-admin.mjs (OpenExt Mount API: mount.js + chunks + admin.css)
  await fs.stat(path.join(adminUiDir, 'mount.js')).catch(() => {
    throw new Error('ui/admin/mount.js is missing: run npm run build first');
  });

  // 2. Remove any stray node_modules in pluginDir
  await fs.rm(path.join(pluginDir, 'node_modules'), { recursive: true, force: true });

  // 3. Verify critical compiled files exist
  const requiredFiles = [
    'manifest.json',
    'ui/admin/mount.js',
    'ui/admin/admin.css',
    'ui/block/index.js',
    'ui/block/styles.css',
    'api/index.js',
    'api/models/StorefrontPage.js',
    'api/services/StorefrontBlueprintService.js',
    'api/routes/storefront.js',
    'api/routes/products.js',
    'api/routes/collections.js',
    'api/models/Collection.js',
    'api/services/CartService.js',
    'api/services/OrderService.js',
    'api/routes/orders.js',
    'api/routes/checkout.js',
    'api/routes/dashboard.js',
    'api/routes/discounts.js',
    'api/services/DiscountEngine.js',
    'api/services/CustomDiscountEvaluator.js',
    'api/services/StoreSettings.js',
    'api/routes/customers.js',
    'api/routes/settings.js',
    'api/routes/taxes.js',
    'api/routes/locations.js',
    'api/models/AdminProfile.js',
    'api/models/Inventory.js',
    'api/routes/inventory.js',
    'api/services/InventoryService.js',
    'api/services/GeoLookup.js',
  ];

  // Same checks OpenExt runs on upload: system plugins need adminMount, and every adminNav entry must be a
  // mount module that exists in the package.
  const manifest = JSON.parse(await fs.readFile(path.join(pluginDir, 'manifest.json'), 'utf8'));
  if (!manifest.adminMount || !/\.m?js$/.test(manifest.adminMount)) throw new Error('manifest.adminMount must point at a .js mount module');
  for (const item of manifest.adminNav ?? []) {
    if (!/\.m?js$/.test(item.entry || '')) throw new Error(`adminNav "${item.label}" entry must be a mount module, got "${item.entry}"`);
    requiredFiles.push(item.entry);
  }
  for (const s of manifest.styles ?? []) requiredFiles.push(s);
  const mountSource = await fs.readFile(path.join(pluginDir, manifest.adminMount), 'utf8');
  if (!/export\s*\{[^}]*\bmount\b/.test(mountSource)) throw new Error('adminMount module does not export mount()');

  for (const reqFile of new Set(requiredFiles)) {
    const target = path.join(pluginDir, reqFile);
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`Required runtime file missing or empty: ${reqFile}`);
    }
  }

  // 4. Build ZIP with root ecommerce-plugin/
  const files = await collectFiles(pluginDir);
  if (files.length >= 1000) {
    throw new Error(`File count (${files.length}) exceeds OpenExt 1,000-file limit!`);
  }

  const zip = new JSZip();
  for (const file of files) {
    const content = await fs.readFile(file.fullPath);
    zip.file(file.relPath, content);
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipPaths = [
    path.join(repoRoot, 'ecommerce-plugin.zip'),
    path.join(repoRoot, 'plugin', 'ecommerce-plugin.zip'),
  ];

  for (const zp of zipPaths) {
    await fs.writeFile(zp, zipBuffer);
  }

  // 5. Inspect generated ZIP
  const checkZip = await JSZip.loadAsync(zipBuffer);
  const zipEntries = Object.keys(checkZip.files).filter((k) => !checkZip.files[k].dir);
  const hasNested = zipEntries.some((k) => k.startsWith('ecommerce-plugin/'));
  if (hasNested) {
    throw new Error('Nested ecommerce-plugin/ folder detected in ZIP!');
  }

  console.log(`Packaged ZIP successfully: ${zipPaths[0]}`);
  console.log(`Also updated: ${zipPaths[1]}`);
  console.log(`Total files in ZIP: ${zipEntries.length}`);
  console.log('Verified entries present at ZIP root:');
  for (const reqFile of requiredFiles) {
    const key = reqFile;
    console.log(`  [OK] ${key} (${checkZip.files[key]._data.uncompressedSize} bytes)`);
  }
}

packagePlugin().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
