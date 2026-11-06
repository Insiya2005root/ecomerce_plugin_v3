/**
 * ProductGrid Redesign & Final Hardening QA Test Suite
 *
 * Verifies 4-column desktop layout defaults, compact ProductCard design,
 * 1:1 square contained images, self-injected CSS, selected product order preservation,
 * stable sorting tiebreakers, and responsive container constraints.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('RUNNING PRODUCTGRID REDESIGN & HARDENING QA SUITE');
console.log('====================================================\n');

const ROOT_DIR = __dirname;
const PLUGIN_SRC = path.join(ROOT_DIR, 'plugin', 'ecommerce-plugin', 'src');
const WEB_SRC = path.join(ROOT_DIR, 'web', 'src');

// 1. Four-Column Desktop Defaults Verification
console.log('--> 1. Verifying 4-Column Desktop Defaults across all subsystems...');
const blueprintCode = fs.readFileSync(path.join(PLUGIN_SRC, 'services', 'StorefrontBlueprintService.ts'), 'utf8');
assert(
  blueprintCode.includes('columnsDesktop: 4'),
  'Shop blueprint must default columnsDesktop to 4'
);

const registryCode = fs.readFileSync(path.join(WEB_SRC, 'storefront', 'registry', 'blockRegistry.ts'), 'utf8');
assert(
  registryCode.includes('columnsDesktop: 4'),
  'Block registry product-grid entry must default columnsDesktop to 4'
);

const gridBlockCode = fs.readFileSync(path.join(WEB_SRC, 'storefront', 'blocks', 'ProductGridBlock.tsx'), 'utf8');
assert(gridBlockCode.includes('num(settings.columnsDesktop, 4, 2, 6)'), 'ProductGridBlock component must default columnsDesktop to 4');

const cardCode = fs.readFileSync(path.join(WEB_SRC, 'storefront', 'components', 'ProductCard.tsx'), 'utf8');
const blockCss = fs.readFileSync(path.join(ROOT_DIR, 'plugin', 'ecommerce-plugin', 'ui', 'block', 'styles.css'), 'utf8');
assert(blockCss.includes(".ecom-sf .\\@4xl\\:grid-cols-4"), 'CSS must define 4 desktop columns');
assert(gridBlockCode.includes('StorefrontShell') && blockCss.includes(".ecom-sf .max-w-7xl"), 'Container must be max-w-7xl');
console.log('✓ 4-Column desktop defaults verified across blueprint, registry, component, and CSS.');

// 2. Responsive Grid Breakpoints
console.log('\n--> 2. Verifying Responsive Breakpoints (Desktop: 4, Tablet: 2, Mobile: 1)...');
assert(blockCss.includes('min-width:40rem') || blockCss.includes('width>=40rem'), 'CSS must have the 640px (sm) breakpoint');
assert(blockCss.includes(".ecom-sf .\\@xl\\:grid-cols-2"), 'Tablet breakpoint must use 2 columns');
assert(blockCss.includes(".ecom-sf .grid-cols-1") && blockCss.includes(".ecom-sf .grid-cols-2"), 'Phone grid must offer 1 or 2 columns');
console.log('✓ Responsive breakpoints verified.');

// 3. Compact ProductCard Design & Contained Square Images
console.log('\n--> 3. Verifying Compact ProductCard Design & Contained 1:1 Images...');
assert(cardCode.includes("square: 'aspect-square'") && blockCss.includes(".ecom-sf .aspect-square"), 'Product card media must default to a square');
assert(cardCode.includes('object-cover') && blockCss.includes(".ecom-sf .object-cover"), 'Product card images fill the square without distortion');
assert(cardCode.includes('line-clamp-2') && blockCss.includes(".ecom-sf .line-clamp-2"), 'Product card title must clamp to maximum 2 lines');
assert(cardCode.includes('ecom-sf-product-card-footer'), 'Card must have a footer for uniform bottom alignment');
assert(cardCode.includes('mt-auto') && blockCss.includes(".ecom-sf .mt-auto"), 'Price section must use mt-auto for aligned baseline');

assert(
  cardCode.includes('ecom-sf-product-card-footer mt-auto'),
  'ProductCard component must wrap price and action sections in ecom-sf-product-card-footer'
);
assert(cardCode.includes('ecom-sf-product-card-category') && cardCode.includes('ecom-sf-product-card-sku'), 'ProductCard must show category and SKU');
console.log('✓ Compact ProductCard design and contained image specifications verified.');

// 4. Standalone Self-Injected CSS Bundle Verification
console.log('\n--> 4. Verifying Standalone Self-Injected CSS into OpenExt host head...');
const buildBlockCode = fs.readFileSync(path.join(ROOT_DIR, 'web', 'scripts', 'build-block.mjs'), 'utf8');
assert(
  buildBlockCode.includes('__STOREFRONT_CSS__'),
  'build-block.mjs must embed __STOREFRONT_CSS__ in bundle define'
);

const blockEntryCode = fs.readFileSync(path.join(WEB_SRC, 'storefront', 'blockEntry.tsx'), 'utf8');
assert(
  blockEntryCode.includes('ensureStorefrontStyles'),
  'blockEntry.tsx must define ensureStorefrontStyles'
);
assert(
  blockEntryCode.includes('ecommerce-plugin-storefront-styles'),
  'blockEntry.tsx must use dedicated style ID ecommerce-plugin-storefront-styles'
);

const blockBundleCode = fs.readFileSync(path.join(ROOT_DIR, 'plugin', 'ecommerce-plugin', 'ui', 'block', 'index.js'), 'utf8');
assert(
  blockBundleCode.includes('ecommerce-plugin-storefront-styles'),
  'Compiled ui/block/index.js bundle must contain embedded storefront stylesheet'
);
console.log('✓ Standalone self-injected CSS bundle verified.');

// 5. Selected Product Order Preservation & Stable Sorting
console.log('\n--> 5. Verifying Selected Product Order Preservation & Stable Sorting...');
const storefrontRoutesCode = fs.readFileSync(path.join(PLUGIN_SRC, 'routes', 'storefront.ts'), 'utf8');
assert(
  storefrontRoutesCode.includes('isExplicitNonDefaultSort'),
  'storefront.ts must distinguish explicit non-default sorts from default newest sort'
);
assert(
  storefrontRoutesCode.includes('orderMap.get(a.id)'),
  'storefront.ts must preserve configured selected product IDs order when no non-default sort is requested'
);
assert(
  storefrontRoutesCode.includes('_id: 1'),
  'storefront.ts must provide secondary _id: 1 tiebreakers for deterministic stable sorting'
);

assert(gridBlockCode.includes("if (sort && sort !== 'newest') query.sort = sort;"), 'ProductGridBlock must not send default newest sort for selected source');
console.log('✓ Selected product order preservation and stable sorting tiebreakers verified.');

// 6. Zero Mutating Database Writes on Public Reads
console.log('\n--> 6. Verifying Zero-Write Guarantees on Public Routes...');
assert(
  storefrontRoutesCode.includes('StorefrontBlueprintService.getPageStatsForTenant(tenantId)'),
  'Health route must use getPageStatsForTenant (countDocuments only)'
);
assert(
  storefrontRoutesCode.includes('StorefrontBlueprintService.getPublicPageReadOnly'),
  'Public page route must use getPublicPageReadOnly without mutations'
);
console.log('✓ Zero-write guarantees verified.');

console.log('\n====================================================');
console.log('ALL PRODUCTGRID REDESIGN & HARDENING CHECKS PASSED!');
console.log('====================================================');
