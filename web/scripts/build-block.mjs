import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const pluginBlockDir = path.resolve(webRoot, '..', 'plugin', 'ecommerce-plugin', 'ui', 'block');

async function buildBlock() {
  await fs.mkdir(pluginBlockDir, { recursive: true });

  const entryFile = path.join(webRoot, 'src', 'storefront', 'blockEntry.tsx');
  const outFile = path.join(pluginBlockDir, 'index.js');
  const cssSource = path.join(webRoot, 'src', 'storefront', 'styles.css');
  const cssOut = path.join(pluginBlockDir, 'styles.css');

  const cssContent = await fs.readFile(cssSource, 'utf8');

  await esbuild.build({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    define: {
      'process.env.NODE_ENV': '"production"',
      '__STOREFRONT_CSS__': JSON.stringify(cssContent),
    },
  });

  await fs.copyFile(cssSource, cssOut);

  const builtJs = await fs.readFile(outFile, 'utf8');
  if (/\bimport\s+.*from\s+['"]/.test(builtJs)) {
    throw new Error('Built block bundle contains unresolved bare ESM import statements.');
  }
  if (!builtJs.includes('__NEXTCMS_PLUGINS__') || !builtJs.includes('ecommerce-plugin')) {
    throw new Error('Built block bundle is missing OpenExt __NEXTCMS_PLUGINS__ registration.');
  }

  console.log(`Built storefront block bundle: ${outFile} (${builtJs.length} bytes)`);
  console.log(`Copied storefront block styles: ${cssOut}`);
}

buildBlock().catch((err) => {
  console.error('Failed to build storefront block bundle:', err);
  process.exit(1);
});
