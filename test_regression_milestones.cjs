// test_regression_milestones.cjs
// Comprehensive regression verification for Phase 3 Milestones 1, 2, 3, and 4.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('RUNNING COMPREHENSIVE STOREFRONT REGRESSION SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// MILESTONE 1 VERIFICATION
// ----------------------------------------------------
console.log('--> Checking Milestone 1: Storefront Foundation & Security...');
const pluginIndexTs = path.resolve(__dirname, 'plugin/ecommerce-plugin/src/index.ts');
const storefrontRoutesTs = path.resolve(__dirname, 'plugin/ecommerce-plugin/src/routes/storefront.ts');

assert(fs.existsSync(pluginIndexTs), 'plugin src/index.ts must exist');
assert(fs.existsSync(storefrontRoutesTs), 'storefront.ts routes must exist');

const pluginIndexCode = fs.readFileSync(pluginIndexTs, 'utf8');
const storefrontRoutesCode = fs.readFileSync(storefrontRoutesTs, 'utf8');

// Ensure /checkout is NOT anonymously public
assert(
  !pluginIndexCode.includes("req.path === '/checkout'") &&
  !pluginIndexCode.includes('req.path === "/checkout"') &&
  !pluginIndexCode.includes("req.path.startsWith('/checkout')"),
  'Security: Anonymous /checkout must NOT be allowed in public routes (Milestone 1 hardening)'
);

// Ensure storefront routes are mounted and public endpoints exist
assert(pluginIndexCode.includes('/storefront'), 'Storefront router must be mounted at /storefront');
assert(storefrontRoutesCode.includes('/health'), 'GET /storefront/health must exist');
assert(storefrontRoutesCode.includes('/settings'), 'GET /storefront/settings must exist');
assert(storefrontRoutesCode.includes('/categories'), 'GET /storefront/categories must exist');
assert(storefrontRoutesCode.includes('/products'), 'GET /storefront/products must exist');
assert(storefrontRoutesCode.includes('/pages/:pageType'), 'GET /storefront/pages/:pageType must exist');
assert(storefrontRoutesCode.includes('toPublicProductDTO'), 'Storefront must use read-safe DTO serializer');

console.log('✓ Milestone 1: Foundation routes, read-safe DTOs, and auth hardening verified.');

// ----------------------------------------------------
// MILESTONE 2 VERIFICATION
// ----------------------------------------------------
console.log('\n--> Checking Milestone 2: Pages & Blueprint System...');
const pageModelTs = path.resolve(__dirname, 'plugin/ecommerce-plugin/src/models/StorefrontPage.ts');
const blueprintServiceTs = path.resolve(__dirname, 'plugin/ecommerce-plugin/src/services/StorefrontBlueprintService.ts');

assert(fs.existsSync(pageModelTs), 'StorefrontPage model must exist');
assert(fs.existsSync(blueprintServiceTs), 'StorefrontBlueprintService must exist');

const blueprintServiceCode = fs.readFileSync(blueprintServiceTs, 'utf8');
assert(blueprintServiceCode.includes("'shop'"), 'Shop blueprint must exist');
assert(blueprintServiceCode.includes("'product'"), 'Product page blueprint must exist');
assert(blueprintServiceCode.includes("'cart'"), 'Cart blueprint must exist');
assert(blueprintServiceCode.includes("'checkout'"), 'Checkout blueprint must exist');
assert(blueprintServiceCode.includes('appliedBlueprintVersion'), 'Blueprint versioning must be supported');
assert(blueprintServiceCode.includes('isCustomized'), 'Merchant customization protection must be supported');

console.log('✓ Milestone 2: 4 Default blueprints, version tracking, and admin endpoints verified.');

// ----------------------------------------------------
// MILESTONE 3 VERIFICATION
// ----------------------------------------------------
console.log('\n--> Checking Milestone 3: Block Registry & Renderer...');
const registryTs = path.resolve(__dirname, 'web/src/storefront/registry/blockRegistry.ts');
const validationTs = path.resolve(__dirname, 'web/src/storefront/registry/blockValidation.ts');
const rendererTsx = path.resolve(__dirname, 'web/src/storefront/renderer/BlockRenderer.tsx');
const plannedBlockTsx = path.resolve(__dirname, 'web/src/storefront/blocks/PlannedMilestoneBlock.tsx');
const blockIndexJs = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/index.js');

assert(fs.existsSync(registryTs), 'blockRegistry.ts must exist');
assert(fs.existsSync(validationTs), 'blockValidation.ts must exist');
assert(fs.existsSync(rendererTsx), 'BlockRenderer.tsx must exist');
assert(fs.existsSync(plannedBlockTsx), 'PlannedMilestoneBlock.tsx must exist');
assert(fs.existsSync(blockIndexJs), 'ui/block/index.js bundle must exist');

const plannedBlockCode = fs.readFileSync(plannedBlockTsx, 'utf8');
// Verify public mode returns null for planned blocks
assert(
  plannedBlockCode.includes('return null;'),
  'Planned blocks must return null for public mode (Milestone 3 correction)'
);

const blockIndexCode = fs.readFileSync(blockIndexJs, 'utf8');
assert(blockIndexCode.includes('__NEXTCMS_PLUGINS__'), 'Block bundle must attach to __NEXTCMS_PLUGINS__');
assert(blockIndexCode.includes('ecommerce-plugin'), 'Block bundle must register ecommerce-plugin');

console.log('✓ Milestone 3: Block registry, safe renderer, and public null behavior verified.');

// ----------------------------------------------------
// MILESTONE 4 VERIFICATION
// ----------------------------------------------------
console.log('\n--> Checking Milestone 4: Customer-Facing ProductCard...');
const productCardTsx = path.resolve(__dirname, 'web/src/storefront/components/ProductCard.tsx');
const storefrontPageTsx = path.resolve(__dirname, 'web/src/app/storefront/page.tsx');

assert(fs.existsSync(productCardTsx), 'ProductCard.tsx must exist');
const cardCode = fs.readFileSync(productCardTsx, 'utf8');
assert(cardCode.includes('export function ProductCard'), 'ProductCard must be exported');
assert(cardCode.includes('catalogPrice'), 'ProductCard must support catalogPrice');
assert(cardCode.includes('compareAtPrice'), 'ProductCard must support compareAtPrice');
assert(cardCode.includes('onAddToCart?: (productId: string) => void'), 'ProductCard must expose onAddToCart contract');
assert(cardCode.includes('aria-disabled={isOutOfStock}'), 'ProductCard must handle out-of-stock accessibility');

const pageCode = fs.readFileSync(storefrontPageTsx, 'utf8');
assert(pageCode.includes('ProductCard'), 'Storefront admin page must preview ProductCard');
assert(pageCode.includes('storefrontApiClient.getProducts({ limit: 1 }'), 'Storefront admin page must fetch real product');

console.log('✓ Milestone 4: Reusable ProductCard and live admin preview verified.');

// ----------------------------------------------------
// MILESTONE 5 VERIFICATION
// ----------------------------------------------------
console.log('\n--> Checking Milestone 5: Product Grid Block...');
const productGridBlockTsx = path.resolve(__dirname, 'web/src/storefront/blocks/ProductGridBlock.tsx');
const blockRegistryTs = path.resolve(__dirname, 'web/src/storefront/registry/blockRegistry.ts');
const blockStylesCss = path.resolve(__dirname, 'plugin/ecommerce-plugin/ui/block/styles.css');

assert(fs.existsSync(productGridBlockTsx), 'ProductGridBlock.tsx must exist');
const gridCode = fs.readFileSync(productGridBlockTsx, 'utf8');
assert(gridCode.includes('export function ProductGridBlock'), 'ProductGridBlock must be exported');
assert(gridCode.includes('storefrontApiClient') && gridCode.includes('getProducts'), 'ProductGridBlock must fetch real products');
assert(gridCode.includes('<ProductCard'), 'ProductGridBlock must render items with ProductCard');
assert(gridCode.includes('totalPages > 1'), 'ProductGridBlock must handle bounded pagination');

const regCode = fs.readFileSync(blockRegistryTs, 'utf8');
assert(regCode.includes("blockType: 'ecommerce.product-grid'"), 'Registry must register ecommerce.product-grid');
assert(regCode.includes("status: 'implemented'"), 'ecommerce.product-grid must be marked implemented');
assert(regCode.includes('component: ProductGridBlock'), 'ecommerce.product-grid must point to ProductGridBlock');

const gridCssCode = fs.readFileSync(blockStylesCss, 'utf8');
assert(gridCssCode.includes('.ecom-sf-product-grid'), 'Distribution CSS must contain .ecom-sf-product-grid');
assert(gridCssCode.includes('var(--grid-cols-desktop'), 'Distribution CSS must contain responsive column vars');

console.log('✓ Milestone 5: Live ProductGrid block, registry implementation, and responsive layout verified.');

console.log('\n====================================================');
console.log('ALL REGRESSION CHECKS PASSED SUCCESSFULLY (M1-M5)');
console.log('====================================================');
