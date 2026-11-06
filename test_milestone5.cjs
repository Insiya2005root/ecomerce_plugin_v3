// test_milestone5.cjs
// Automated verification for Phase 3 - Milestone 5: Product Grid Block
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const React = require('./web/node_modules/react');
const ReactDOMServer = require('./web/node_modules/react-dom/server');

console.log('====================================================');
console.log('RUNNING PHASE 3 - MILESTONE 5 VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Verify files exist
const productGridBlockTsx = path.resolve(__dirname, 'web/src/storefront/blocks/ProductGridBlock.tsx');
const productCardTsx = path.resolve(__dirname, 'web/src/storefront/components/ProductCard.tsx');
const blockRegistryTs = path.resolve(__dirname, 'web/src/storefront/registry/blockRegistry.ts');
const storefrontStylesCss = path.resolve(__dirname, 'web/src/storefront/storefront.css');
const gridSource = fs.readFileSync(path.resolve(__dirname, 'web/src/storefront/blocks/ProductGridBlock.tsx'), 'utf8');
const blockIndexJs = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/index.js');
const blockStylesCss = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/styles.css');

assert(fs.existsSync(productGridBlockTsx), 'ProductGridBlock.tsx must exist');
assert(fs.existsSync(productCardTsx), 'ProductCard.tsx must exist');
assert(fs.existsSync(blockRegistryTs), 'blockRegistry.ts must exist');
assert(fs.existsSync(path.resolve(__dirname, 'web/src/storefront/storefront.css')), 'storefront.css (Tailwind entry) must exist');
assert(fs.existsSync(blockIndexJs), 'ui/block/index.js must exist');
assert(fs.existsSync(blockStylesCss), 'ui/block/styles.css must exist');
console.log('✓ File existence verified');

// 2. Verify ProductCard Hardening
const cardSource = fs.readFileSync(productCardTsx, 'utf8');
assert(!cardSource.includes("const productHref = href || `/product?slug="), 'ProductCard must NOT link to unfinished Product Detail page when href is omitted');
assert(cardSource.includes('hasValidHref ?'), 'ProductCard must check hasValidHref');
assert(cardSource.includes('ecom-sf-product-card-title-text'), 'ProductCard must support non-linked title text when href is unset');
assert(cardSource.includes('onAddToCart?.(product.id)'), 'onAddToCart must receive canonical product.id');
console.log('✓ Milestone 4 quick hardening verified (Product Detail links unset, canonical DTO preserved)');

// 3. Verify Block Registry Implementation
const registrySource = fs.readFileSync(blockRegistryTs, 'utf8');
assert(registrySource.includes("import { ProductGridBlock } from '../blocks/ProductGridBlock'"), 'blockRegistry.ts must import ProductGridBlock');
assert(registrySource.includes("blockType: 'ecommerce.product-grid'"), 'blockRegistry.ts must register ecommerce.product-grid');
assert(registrySource.includes("status: 'implemented'"), 'ecommerce.product-grid must have status: implemented');
assert(registrySource.includes('component: ProductGridBlock'), 'ecommerce.product-grid must point to ProductGridBlock');
assert(/(key: |\()'source'/.test(registrySource), 'Registry must spec source field');
assert(/(key: |\()'sort'/.test(registrySource), 'Registry must spec sort field');
assert(/(key: |\()'pageSize'/.test(registrySource), 'Registry must spec pageSize field');
assert(/(key: |\()'columnsDesktop'/.test(registrySource), 'Registry must spec columnsDesktop field');
assert(/(key: |\()'columnsTablet'/.test(registrySource), 'Registry must spec columnsTablet field');
assert(/(key: |\()'columnsMobile'/.test(registrySource), 'Registry must spec columnsMobile field');
assert(/(key: |\()'showCategory'/.test(registrySource), 'Registry must spec showCategory field');
assert(/(key: |\()'showComparePrice'/.test(registrySource), 'Registry must spec showComparePrice field');
assert(/(key: |\()'showDiscountBadge'/.test(registrySource), 'Registry must spec showDiscountBadge field');
assert(/(key: |\()'showStock'/.test(registrySource), 'Registry must spec showStock field');
assert(/(key: |\()'showAddToCart'/.test(registrySource), 'Registry must spec showAddToCart field');
console.log('✓ Product Grid block registry entry verified (implemented status, complete fieldSpecs & defaults)');

// 4. Verify CSS Rules for Responsive Product Grid
const cssSource = fs.readFileSync(storefrontStylesCss, 'utf8');
assert(cssSource.includes('@source'), 'storefront.css must tell Tailwind where the storefront classes live');
assert(gridSource.includes('@4xl:grid-cols-'), 'Grid must set desktop columns (container query)');
assert(gridSource.includes('@xl:grid-cols-'), 'Grid must set tablet columns (container query)');
assert(gridSource.includes("1: 'grid-cols-1', 2: 'grid-cols-2'"), 'Grid must set phone columns');
assert(gridSource.includes('@/components/ui/pagination'), 'Grid must use the shadcn Pagination');
assert(gridSource.includes('EditorHint'), 'Grid must show page-builder hints');

const blockCssSource = fs.readFileSync(blockStylesCss, 'utf8');
assert(blockCssSource.includes('.ecom-sf .\\@4xl\\:grid-cols-4'), 'ui/block/styles.css must include the grid column classes');
assert(blockCssSource.includes('@container'), 'ui/block/styles.css must include container queries');
console.log('✓ CSS responsive grid and pagination styles verified');

// 5. Test ProductCard & ProductGridBlock logic via esbuild & SSR
const esbuild = require('./web/node_modules/esbuild');

// A. ProductCard SSR checks with/without href
const cardBundle = esbuild.buildSync({
  entryPoints: [productCardTsx],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'transform',
  external: ['react', 'react-dom']
});

const customRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return require('./web/node_modules/react/jsx-runtime');
  if (id === 'react/jsx-dev-runtime') return require('./web/node_modules/react/jsx-dev-runtime');
  if (id === 'react-dom') return require('./web/node_modules/react-dom');
  if (id === 'react-dom/client') return require('./web/node_modules/react-dom/client');
  if (id === 'react-dom/server') return ReactDOMServer;
  return require(id);
};

const cardModule = { exports: {} };
new Function('module', 'exports', 'require', cardBundle.outputFiles[0].text)(cardModule, cardModule.exports, customRequire);
const { ProductCard } = cardModule.exports;

const mockProduct = {
  id: 'prod_123',
  name: 'Mechanical Keyboard',
  slug: 'mechanical-keyboard',
  description: 'RGB mechanical keyboard',
  price: 4999,
  catalogPrice: 3999,
  compareAtPrice: 4999,
  discountPercentage: 20,
  sku: 'KB-101',
  stock: 10,
  inStock: true,
  image: 'https://example.com/kb.jpg',
  images: ['https://example.com/kb.jpg'],
  videos: [],
  categoryId: 'cat_electronics',
  isDigital: false,
  tags: [],
  metaTitle: '',
  metaDescription: '',
  variants: [],
};

// Check without href: should NOT have <a href="/product?slug=...">
const ssrNoHref = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductCard, { product: mockProduct })
);
assert(!ssrNoHref.includes('href="/product'), 'Default ProductCard must not render unfinished product href');
assert(ssrNoHref.includes('ecom-sf-product-card-title-text'), 'ProductCard without href must render ecom-sf-product-card-title-text');

// Check with explicit href: should have <a href="/shop/custom-link">
const ssrWithHref = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductCard, { product: mockProduct, href: '/shop/custom-link' })
);
assert(ssrWithHref.includes('href="/shop/custom-link"'), 'ProductCard with explicit href must render anchor link');
console.log('✓ ProductCard navigation behavior verified (unset href leaves links disabled, explicit href links cleanly)');

// B. ProductGridBlock bundle & SSR checks
const gridBundle = esbuild.buildSync({
  entryPoints: [productGridBlockTsx],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'transform',
  external: ['react', 'react-dom']
});

const gridModule = { exports: {} };
new Function('module', 'exports', 'require', gridBundle.outputFiles[0].text)(gridModule, gridModule.exports, customRequire);
const { ProductGridBlock } = gridModule.exports;
assert(typeof ProductGridBlock === 'function', 'ProductGridBlock must be a React component');

// Test Initial Loading SSR
const ssrLoading = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductGridBlock, {
    block: { id: 'grid-1', blockType: 'ecommerce.product-grid', label: 'Product Catalog' },
    settings: { columnsDesktop: 4, columnsTablet: 2, columnsMobile: 1, pageSize: 12 },
    isEditing: false,
  })
);
assert(ssrLoading.includes('Loading products'), 'Initial SSR must render loading state');
console.log('✓ ProductGrid initial loading SSR verified');

console.log('\n====================================================');
console.log('ALL MILESTONE 5 VERIFICATIONS PASSED');
console.log('====================================================');
