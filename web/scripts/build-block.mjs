// Builds the storefront block bundle for OpenExt's page builder and public pages:
//   ui/block/index.js    IIFE that registers window.__NEXTCMS_PLUGINS__['ecommerce-plugin'] (mount/unmount/getSettingsSchema)
//   ui/block/styles.css  Tailwind + shadcn styles, scoped to `.ecom-sf` so they cannot restyle the OpenExt site
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const pluginBlockDir = path.resolve(webRoot, '..', 'plugin', 'ecommerce-plugin', 'ui', 'block');
const SCOPE = '.ecom-sf';

/** Flattens @layer blocks into plain rules in layer order, so OpenExt's unlayered CSS can't outrank them. */
function flattenLayers(root) {
  const order = [];
  const blocks = new Map();
  const unlayered = [];
  root.each((node) => {
    if (node.type === 'atrule' && node.name === 'layer') {
      const names = node.params.split(',').map((n) => n.trim()).filter(Boolean);
      if (!node.nodes) {
        for (const n of names) if (!order.includes(n)) order.push(n);
        return;
      }
      const name = names[0];
      if (!order.includes(name)) order.push(name);
      if (!blocks.has(name)) blocks.set(name, []);
      blocks.get(name).push(...node.nodes.map((c) => c.clone()));
      return;
    }
    unlayered.push(node.clone());
  });
  const out = postcss.root();
  for (const name of order) for (const n of blocks.get(name) ?? []) out.append(n);
  for (const n of unlayered) out.append(n);
  out.walkAtRules('layer', (at) => {
    if (at.nodes) at.replaceWith(at.nodes);
    else at.remove();
  });
  return out;
}

/**
 * Prefixes a top-level selector with the storefront scope. Document-level selectors (:root, html, body,
 * :host) become the scope itself; the `.dark` token block applies under OpenExt's `html.dark`.
 */
function scopeSelector(sel) {
  const s = sel.trim();
  if (s === '.dark') return `.dark ${SCOPE}`;
  const doc = s.match(/^(:root|:host|html|body)(?=$|[\s.:[>+~,(])/);
  if (doc) return `${SCOPE}${s.slice(doc[0].length)}`;
  return `${SCOPE} ${s}`;
}

async function buildCss() {
  const from = path.join(webRoot, 'src', 'storefront', 'storefront.css');
  const source = await fs.readFile(from, 'utf8');
  const result = await postcss([tailwind({ base: webRoot, optimize: false })]).process(source, { from });
  const flat = flattenLayers(postcss.parse(result.css));
  flat.walkRules((rule) => {
    const parent = rule.parent;
    if (parent?.type === 'rule') return; // nested rules follow their (already scoped) parent
    if (parent?.type === 'atrule' && /keyframes$/.test(parent.name)) return;
    rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
  });
  // The storefront sits inside the merchant's site: keep its font, and let our ink colour follow the theme.
  flat.append(postcss.parse(`${SCOPE}{font-family:inherit;color:var(--foreground)}`).nodes);
  const minified = await esbuild.transform(flat.toString(), { loader: 'css', minify: true, legalComments: 'none' });
  return minified.code;
}

async function buildBlock() {
  await fs.mkdir(pluginBlockDir, { recursive: true });
  const entryFile = path.join(webRoot, 'src', 'storefront', 'blockEntry.tsx');
  const outFile = path.join(pluginBlockDir, 'index.js');
  const cssOut = path.join(pluginBlockDir, 'styles.css');

  const cssContent = await buildCss();

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
    tsconfig: path.join(webRoot, 'tsconfig.json'),
    loader: { '.css': 'empty' },
    logOverride: { 'unsupported-directive': 'silent' },
    define: {
      'process.env.NODE_ENV': '"production"',
      __STOREFRONT_CSS__: JSON.stringify(cssContent),
    },
  });

  await fs.writeFile(cssOut, cssContent);

  const builtJs = await fs.readFile(outFile, 'utf8');
  if (/\bimport\s+.*from\s+['"]/.test(builtJs)) {
    throw new Error('Built block bundle contains unresolved bare ESM import statements.');
  }
  if (!builtJs.includes('__NEXTCMS_PLUGINS__') || !builtJs.includes('ecommerce-plugin')) {
    throw new Error('Built block bundle is missing OpenExt __NEXTCMS_PLUGINS__ registration.');
  }

  console.log(`Built storefront block bundle: ${outFile} (${builtJs.length} bytes)`);
  console.log(`Built storefront block styles: ${cssOut} (${cssContent.length} bytes)`);
}

buildBlock().catch((err) => {
  console.error('Failed to build storefront block bundle:', err);
  process.exit(1);
});
