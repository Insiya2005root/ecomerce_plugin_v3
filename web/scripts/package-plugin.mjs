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
const outDir = path.join(webRoot, 'out');
const adminUiDir = path.join(pluginDir, 'ui', 'admin');

async function copyDirFiltered(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirFiltered(srcPath, destPath);
    } else if (entry.isFile()) {
      // Skip Next.js RSC .txt payload files to keep file count well under OpenExt 1000-file limit
      if (entry.name.endsWith('.txt')) continue;
      await fs.copyFile(srcPath, destPath);
    }
  }
}

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
  // 1. Clean and sync ui/admin from web/out
  await fs.rm(adminUiDir, { recursive: true, force: true });
  await copyDirFiltered(outDir, adminUiDir);

  // 2. Remove any stray node_modules in pluginDir
  await fs.rm(path.join(pluginDir, 'node_modules'), { recursive: true, force: true });

  // 3. Verify critical compiled files exist
  const requiredFiles = [
    'manifest.json',
    'ui/admin/index.html',
    'ui/admin/storefront/index.html',
    'ui/admin/storefront/shop/index.html',
    'ui/admin/storefront/product/index.html',
    'ui/admin/storefront/cart/index.html',
    'ui/admin/storefront/checkout/index.html',
    'ui/admin/products/add/index.html',
    'ui/admin/products/edit/index.html',
    'ui/block/index.js',
    'ui/block/styles.css',
    'api/index.js',
    'api/models/StorefrontPage.js',
    'api/services/StorefrontBlueprintService.js',
    'api/routes/storefront.js',
  ];

  for (const reqFile of requiredFiles) {
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
