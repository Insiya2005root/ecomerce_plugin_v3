// Builds the admin for OpenExt's Mount API (no iframe):
//   ui/admin/mount.js    ESM entry exporting mount/unmount (+ chunks/ loaded on demand per screen)
//   ui/admin/admin.css   Tailwind output scoped to the admin's root element so it cannot restyle OpenExt
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(webRoot, '..', 'plugin', 'ecommerce-plugin', 'ui', 'admin');
const SCOPE = '.ecom-admin';

async function buildJs() {
  const result = await esbuild.build({
    entryPoints: { mount: path.join(webRoot, 'src', 'admin', 'mount.tsx') },
    outdir: outDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    chunkNames: 'chunks/[name]-[hash]',
    tsconfig: path.join(webRoot, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty' },
    logOverride: { 'unsupported-directive': 'silent' },
    metafile: true,
  });
  const outputs = Object.keys(result.metafile.outputs);
  const leaked = Object.keys(result.metafile.inputs).filter((p) => /node_modules[\\/]next[\\/]/.test(p));
  if (leaked.length) throw new Error(`Admin bundle must not include Next.js runtime: ${leaked.join(', ')}`);
  return outputs.length;
}

/**
 * Selectors that targeted the document (:root, html, body, :host) now target the scope root, and the
 * `.dark` theme block applies when the root itself carries `.dark` (mirrored from OpenExt's theme).
 */
function scopeSelector(sel) {
  const s = sel.trim();
  if (s === '.dark') return ':scope.dark';
  return s
    .replace(/:root\b/g, ':scope')
    .replace(/:host\b/g, ':scope')
    .replace(/^(html|body)(?=$|[\s.:[>+~])/, ':scope');
}

/**
 * Flattens @layer blocks into plain rules in layer order. Unlayered rules beat OpenExt's own unlayered
 * rules only by specificity/proximity, but layered ones would always lose to them; flattening keeps
 * our cascade intact inside the plugin area.
 */
function flattenLayers(root) {
  let order = [];
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
  // Nested layers (e.g. inside @media) are rare; unwrap them in place.
  out.walkAtRules('layer', (at) => {
    if (at.nodes) at.replaceWith(at.nodes);
    else at.remove();
  });
  return out;
}

async function buildCss() {
  const from = path.join(webRoot, 'src', 'app', 'globals.css');
  const source = await fs.readFile(from, 'utf8');
  const result = await postcss([tailwind({ base: webRoot, optimize: false })]).process(source, { from });
  const flat = flattenLayers(postcss.parse(result.css));

  // @property registrations are global and cannot live inside @scope; keep them at top level.
  const properties = [];
  flat.walkAtRules('property', (at) => {
    properties.push(at.clone());
    at.remove();
  });
  flat.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
  });
  const keyframes = [];
  flat.walkAtRules(/keyframes$/, (at) => {
    keyframes.push(at.clone());
    at.remove();
  });

  const out = postcss.root();
  for (const p of properties) out.append(p);
  for (const k of keyframes) out.append(k);
  const scope = postcss.atRule({ name: 'scope', params: `(${SCOPE})` });
  scope.append(flat.nodes.map((n) => n.clone()));
  // OpenExt animates every input/button (`input, button { transition: all .3s }`); same specificity, but
  // scope proximity lets this win, while our transition-* utilities (a class) still beat it.
  scope.append(postcss.parse(':where(:scope) :is(input, button) { transition: none; }').nodes);
  out.append(scope);

  const minified = await esbuild.transform(out.toString(), { loader: 'css', minify: true, legalComments: 'none' });
  await fs.writeFile(path.join(outDir, 'admin.css'), minified.code);
  return minified.code.length;
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const files = await buildJs();
  const cssBytes = await buildCss();
  const mount = await fs.readFile(path.join(outDir, 'mount.js'), 'utf8');
  if (!/export\s*\{[^}]*\bmount\b/.test(mount)) throw new Error('mount.js does not export mount()');
  console.log(`Built admin: ${outDir}`);
  console.log(`  ${files} JS files (mount.js ${mount.length} bytes), admin.css ${cssBytes} bytes`);
}

main().catch((err) => {
  console.error('Admin build failed:', err);
  process.exit(1);
});
