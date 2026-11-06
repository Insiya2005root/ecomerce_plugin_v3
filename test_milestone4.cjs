// test_milestone4.cjs
// Automated verification for Phase 3 - Milestone 4: ProductCard
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const React = require('./web/node_modules/react');
const ReactDOMServer = require('./web/node_modules/react-dom/server');

console.log('====================================================');
console.log('RUNNING PHASE 3 - MILESTONE 4 VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Verify files exist
const productCardTsx = path.resolve(__dirname, 'web/src/storefront/components/ProductCard.tsx');
const storefrontStylesCss = path.resolve(__dirname, 'web/src/storefront/storefront.css');
const storefrontPageTsx = path.resolve(__dirname, 'web/src/app/storefront/page.tsx');
const blockIndexJs = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/index.js');
const blockStylesCss = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/styles.css');

assert(fs.existsSync(productCardTsx), 'ProductCard.tsx must exist');
assert(fs.existsSync(path.resolve(__dirname, 'web/src/storefront/storefront.css')), 'storefront.css (Tailwind entry) must exist');
// The Storefront admin preview page was removed (storefront pages now live in OpenExt Pages); its checks skip.
assert(fs.existsSync(blockIndexJs), 'ui/block/index.js must exist');
assert(fs.existsSync(blockStylesCss), 'ui/block/styles.css must exist');
console.log('✓ File existence verified');

// 2. Transpile / test ProductCard logic via dynamic check
// We can check source code contracts and also run SSR test if transpile is available
const cardSource = fs.readFileSync(productCardTsx, 'utf8');

// Contract assertions:
assert(cardSource.includes('export interface ProductCardProps'), 'Must export ProductCardProps');
assert(cardSource.includes('export function ProductCard'), 'Must export ProductCard');
assert(cardSource.includes('onAddToCart?: (productId: string) => void'), 'Must support onAddToCart callback');
assert(cardSource.includes('isOutOfStock'), 'Must calculate isOutOfStock');
assert(cardSource.includes('compareAtPrice'), 'Must handle compareAtPrice');
assert(cardSource.includes('catalogPrice'), 'Must handle catalogPrice');
assert(cardSource.includes('ecom-sf-product-card-img-fallback'), 'Must include SVG/CSS fallback for missing/broken image');
assert(cardSource.includes('onError='), 'Must handle image onError fallback state');
assert(cardSource.includes('aria-disabled={isOutOfStock}'), 'Must set accessibility aria-disabled on stock state');
assert(!cardSource.includes('POST /cart'), 'ProductCard must NOT call /cart directly or fake cart state');
assert(!cardSource.includes('calculateTax'), 'ProductCard must NOT recalculate tax/cart totals');
console.log('✓ ProductCard API contracts and design rules verified');

// 3. Verify CSS styling rules for ProductCard
const cssSource = fs.readFileSync(storefrontStylesCss, 'utf8');
assert(cssSource.includes('@import "tailwindcss"') && cssSource.includes('shadcn/tailwind.css'), 'storefront.css must build on Tailwind and shadcn');
assert(cardSource.includes('aspect-square'), 'Card media must maintain stable 1:1 aspect ratio');
assert(cardSource.includes('ImageOff'), 'Card must show an icon when the image is missing');
assert(cardSource.includes('<Badge') && cardSource.includes('discountPercentage'), 'Card must show a discount Badge');
assert(cardSource.includes('line-through'), 'Compare-at price must be struck through');
assert(cardSource.includes('text-destructive'), 'Out-of-stock state must be styled');
assert(cardSource.includes('disabled={isOutOfStock}'), 'Add to cart must be disabled when out of stock');
assert(cardSource.includes('<Button'), 'Card uses the shadcn Button (touch-sized)');
console.log('✓ ProductCard CSS styling rules verified');

// 4. Verify Storefront Admin Page integration
if (fs.existsSync(storefrontPageTsx)) {
const pageSource = fs.readFileSync(storefrontPageTsx, 'utf8');
assert(pageSource.includes("import { ProductCard } from '@/storefront/components/ProductCard'"), 'storefront/page.tsx must import ProductCard');
assert(pageSource.includes('storefrontApiClient.getProducts({ limit: 1'), 'storefront/page.tsx must fetch real published product');
assert(pageSource.includes('No Published Products Found'), 'storefront/page.tsx must contain empty state fallback');
assert(pageSource.includes('onAddToCart'), 'storefront/page.tsx must hook into onAddToCart callback');
assert(pageSource.includes('cardShowCategory'), 'storefront/page.tsx must support toggle display flags');
console.log('✓ Storefront Admin Overview real-product preview verified');
} else {
  console.log('- Storefront admin preview page removed; preview checks skipped');
}

// 5. Verify UI block bundle includes ProductCard styles
const blockCssSource = fs.readFileSync(blockStylesCss, 'utf8');
assert(blockCssSource.includes('.ecom-sf .aspect-square') && blockCssSource.includes('.ecom-sf .line-clamp-2'), 'ui/block/styles.css must include the scoped Tailwind classes the card uses');
console.log('✓ Block distribution styles.css verified');

// 6. Test ProductCard behavioral rendering via Node using ts-node or compiled JS
// Let's create an esbuild mini test bundle to execute ProductCard in simulated DOM/SSR
const esbuild = require('./web/node_modules/esbuild');

const bundleResult = esbuild.buildSync({
  entryPoints: [productCardTsx],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'transform',
  external: ['react', 'react-dom']
});

const cardModuleCode = bundleResult.outputFiles[0].text;
const m = { exports: {} };
const customRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return require('./web/node_modules/react/jsx-runtime');
  if (id === 'react/jsx-dev-runtime') return require('./web/node_modules/react/jsx-dev-runtime');
  if (id === 'react-dom') return require('./web/node_modules/react-dom');
  if (id === 'react-dom/server') return ReactDOMServer;
  return require(id);
};
const fn = new Function('module', 'exports', 'require', cardModuleCode);
fn(m, m.exports, customRequire);

const { ProductCard } = m.exports;
assert(typeof ProductCard === 'function', 'ProductCard must be a React functional component');

// Test A: Normal in-stock product with discount
const mockDiscountedProduct = {
  id: 'prod_123',
  name: 'Wireless Noise-Cancelling Headphones',
  slug: 'wireless-headphones',
  description: 'Premium headphones',
  price: 5000,
  catalogPrice: 3999,
  compareAtPrice: 5000,
  discountPercentage: 20,
  sku: 'WH-100',
  stock: 15,
  inStock: true,
  image: 'https://example.com/headphones.jpg',
  images: ['https://example.com/headphones.jpg'],
  videos: [],
  categoryId: 'cat_audio',
  isDigital: false,
  tags: ['audio', 'bluetooth'],
  metaTitle: 'Headphones',
  metaDescription: 'Desc',
  variants: [],
};

const ssrDiscounted = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductCard, {
    product: mockDiscountedProduct,
    categoryName: 'Audio Equipment',
    currencySymbol: '₹',
  })
);

assert(ssrDiscounted.includes('Wireless Noise-Cancelling Headphones'), 'Must render product name');
assert(ssrDiscounted.includes('Audio Equipment'), 'Must render category name');
assert(ssrDiscounted.includes('3,999'), 'Must render catalogPrice');
assert(ssrDiscounted.includes('5,000'), 'Must render compareAtPrice');
assert(ssrDiscounted.toLowerCase().includes("20% off"), 'Must render discount badge');
assert(ssrDiscounted.toLowerCase().includes("in stock"), 'Must render In Stock badge');
assert(ssrDiscounted.toLowerCase().includes("add to cart"), 'Must render Add to Cart button');
assert(!ssrDiscounted.includes('disabled=""'), 'In-stock button must not be disabled');
console.log('✓ Scenario A: Discounted In-Stock Product SSR passes');

// Test B: Out of stock product
const mockOutOfStockProduct = {
  id: 'prod_456',
  name: 'Sold Out Smartphone',
  slug: 'sold-out-phone',
  description: 'Out of stock device',
  price: 25000,
  catalogPrice: 25000,
  compareAtPrice: null,
  discountPercentage: 0,
  sku: 'PH-404',
  stock: 0,
  inStock: false,
  image: null,
  images: [],
  videos: [],
  categoryId: null,
  isDigital: false,
  tags: [],
  metaTitle: '',
  metaDescription: '',
  variants: [],
};

const ssrOutOfStock = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductCard, {
    product: mockOutOfStockProduct,
    currencySymbol: '₹',
  })
);

assert(ssrOutOfStock.includes('Sold Out Smartphone'), 'Must render product name');
assert(ssrOutOfStock.toLowerCase().includes("out of stock"), 'Must render Out of Stock indicator');
assert(ssrOutOfStock.includes('disabled=""') || ssrOutOfStock.includes('disabled'), 'Out-of-stock button must be disabled');
assert(ssrOutOfStock.includes('aria-disabled="true"'), 'Out-of-stock button must have aria-disabled="true"');
assert(ssrOutOfStock.includes('ecom-sf-product-card-img-fallback'), 'Missing image must render fallback');
assert(!ssrDiscounted.includes('ecom-sf-product-card-img-fallback'), 'Available image must not render fallback');
assert(!ssrOutOfStock.toLowerCase().includes("% off"), 'Non-discounted product must not render discount badge');
console.log('✓ Scenario B: Out-of-Stock Product with fallback image SSR passes');

// Test C: Display flags disabled
const ssrFlagsHidden = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ProductCard, {
    product: mockDiscountedProduct,
    categoryName: 'Audio Equipment',
    showCategory: false,
    showComparePrice: false,
    showDiscountBadge: false,
    showStock: false,
    showAddToCart: false,
  })
);

assert(!ssrFlagsHidden.includes('Audio Equipment'), 'showCategory: false must hide category');
assert(!ssrFlagsHidden.toLowerCase().includes("20% off"), 'showDiscountBadge: false must hide badge');
assert(!ssrFlagsHidden.toLowerCase().includes("in stock"), 'showStock: false must hide stock');
assert(!ssrFlagsHidden.toLowerCase().includes("add to cart"), 'showAddToCart: false must hide button');
console.log('✓ Scenario C: Configurable Display Flags SSR passes');

console.log('\n====================================================');
console.log('ALL MILESTONE 4 VERIFICATIONS PASSED');
console.log('====================================================');
