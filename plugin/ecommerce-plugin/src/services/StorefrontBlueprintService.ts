import StorefrontPage from '../models/StorefrontPage';

declare const require: (moduleId: string) => any;
const crypto = require('crypto');

export type StorefrontPageType = 'shop' | 'product' | 'cart' | 'checkout';

export const STOREFRONT_PAGE_TYPES: StorefrontPageType[] = [
  'shop',
  'product',
  'cart',
  'checkout',
];

export interface StorefrontBlockFieldSpec {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  description?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string | number }>;
}

export interface StorefrontBlockConfig {
  id: string;
  uniqueId: string;
  type: 'ecommerce-plugin';
  blockType: string;
  label: string;
  required: boolean;
  enabled: boolean;
  settings: Record<string, any>;
}

export interface StorefrontBlueprintDefinition {
  blueprintId: string;
  pageType: StorefrontPageType;
  version: number;
  slug: string;
  title: string;
  description: string;
  routePattern: string;
  isDynamicTemplate: boolean;
  defaultPublished: boolean;
  blocks: StorefrontBlockConfig[];
  fieldSpecs: Record<string, StorefrontBlockFieldSpec[]>;
}

export interface StorefrontPageDTO {
  id: string;
  pageType: StorefrontPageType;
  blueprintId: string;
  cmsPageId: string | null;
  slug: string;
  title: string;
  description: string;
  routePattern: string;
  isDynamicTemplate: boolean;
  isPublished: boolean;
  appliedBlueprintVersion: number;
  latestBlueprintVersion: number;
  hasNewerBlueprint: boolean;
  appliedBlueprintHash: string;
  currentConfigHash: string;
  isCustomized: boolean;
  customizationState: 'Default' | 'Customized';
  revision: number;
  lastCustomizedAt: string | null;
  lastResetAt: string | null;
  updatedAt: string | null;
  blocks: StorefrontBlockConfig[];
  fieldSpecs: Record<string, StorefrontBlockFieldSpec[]>;
}

const FORBIDDEN_LIVE_DATA_KEYS = new Set([
  'products',
  'product',
  'categories',
  'category',
  'orders',
  'order',
  'taxrules',
  'taxclasses',
  'taxclassid',
  'costprice',
  'barcode',
  'discountrules',
  'variants',
  'inventory',
  'stockquantity',
  'calculatedtax',
]);

const BASE_BLUEPRINTS: Record<StorefrontPageType, StorefrontBlueprintDefinition> = {
  shop: {
    blueprintId: 'ecommerce-shop-blueprint',
    pageType: 'shop',
    version: 1,
    slug: 'shop',
    title: 'Shop Catalog',
    description:
      'Main customer catalog page displaying live published products, category filters, search, and sorting.',
    routePattern: '/shop',
    isDynamicTemplate: false,
    defaultPublished: true,
    blocks: [
      {
        id: 'shop-header',
        uniqueId: 'ecommerce-shop-header',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.shop-header',
        label: 'Shop Header & Breadcrumbs',
        required: false,
        enabled: true,
        settings: {
          heading: 'All Products',
          subheading: 'Browse our live catalog and filter by category.',
          showBreadcrumbs: true,
          showTotalCount: true,
        },
      },
      {
        id: 'category-navigation',
        uniqueId: 'ecommerce-shop-categories',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.category-filter',
        label: 'Category Filter & Search Toolbar',
        required: false,
        enabled: true,
        settings: {
          filterLayout: 'horizontal-pills',
          showSearchInput: true,
          showSortDropdown: true,
          defaultSort: 'newest',
        },
      },
      {
        id: 'product-grid',
        uniqueId: 'ecommerce-shop-product-grid',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.product-grid',
        label: 'Catalog Product Grid',
        required: true,
        enabled: true,
        settings: {
          source: 'all',
          categoryId: '',
          selectedProductIds: '',
          sort: 'newest',
          pageSize: 12,
          columnsDesktop: 4,
          columnsTablet: 2,
          columnsMobile: 1,
          showCategory: true,
          showComparePrice: true,
          showDiscountBadge: true,
          showStock: true,
          showAddToCart: true,
          showCompareAtPrice: true,
          showStockBadge: true,
          showSku: false,
          cardAction: 'add_to_cart',
        },
      },
    ],
    fieldSpecs: {
      'ecommerce.shop-header': [
        { key: 'heading', label: 'Header Title', type: 'string' },
        { key: 'subheading', label: 'Header Subtitle', type: 'string' },
        { key: 'showBreadcrumbs', label: 'Show Breadcrumbs', type: 'boolean' },
        { key: 'showTotalCount', label: 'Show Product Count', type: 'boolean' },
      ],
      'ecommerce.category-filter': [
        {
          key: 'filterLayout',
          label: 'Category Filter Style',
          type: 'select',
          options: [
            { label: 'Horizontal Pills', value: 'horizontal-pills' },
            { label: 'Sidebar List', value: 'sidebar-list' },
            { label: 'Compact Dropdown', value: 'dropdown' },
          ],
        },
        { key: 'showSearchInput', label: 'Enable Keyword Search', type: 'boolean' },
        { key: 'showSortDropdown', label: 'Enable Sort Selector', type: 'boolean' },
        {
          key: 'defaultSort',
          label: 'Default Sort Order',
          type: 'select',
          options: [
            { label: 'Newest First', value: 'newest' },
            { label: 'Price: Low to High', value: 'price_asc' },
            { label: 'Price: High to Low', value: 'price_desc' },
            { label: 'Name: A to Z', value: 'name_asc' },
          ],
        },
      ],
      'ecommerce.product-grid': [
        {
          key: 'source',
          label: 'Product Source',
          type: 'select',
          options: [
            { label: 'All Published Products', value: 'all' },
            { label: 'Latest Arrivals', value: 'latest' },
            { label: 'Specific Category', value: 'category' },
            { label: 'Selected Product IDs', value: 'selected' },
          ],
        },
        {
          key: 'categoryId',
          label: 'Category ID (When source is Category)',
          type: 'string',
        },
        {
          key: 'selectedProductIds',
          label: 'Comma-Separated Product IDs (When source is Selected)',
          type: 'string',
        },
        {
          key: 'sort',
          label: 'Sort Order',
          type: 'select',
          options: [
            { label: 'Newest First', value: 'newest' },
            { label: 'Price: Low to High', value: 'price_asc' },
            { label: 'Price: High to Low', value: 'price_desc' },
            { label: 'Name: A to Z', value: 'name_asc' },
          ],
        },
        {
          key: 'pageSize',
          label: 'Products Per Page',
          type: 'number',
          min: 1,
          max: 48,
        },
        {
          key: 'columnsDesktop',
          label: 'Desktop Columns',
          type: 'select',
          options: [
            { label: '2 Columns', value: 2 },
            { label: '3 Columns', value: 3 },
            { label: '4 Columns', value: 4 },
          ],
        },
        {
          key: 'columnsTablet',
          label: 'Tablet Columns',
          type: 'select',
          options: [
            { label: '1 Column', value: 1 },
            { label: '2 Columns', value: 2 },
            { label: '3 Columns', value: 3 },
          ],
        },
        {
          key: 'columnsMobile',
          label: 'Mobile Columns',
          type: 'select',
          options: [
            { label: '1 Column', value: 1 },
            { label: '2 Columns', value: 2 },
          ],
        },
        { key: 'showCategory', label: 'Show Category Label', type: 'boolean' },
        { key: 'showComparePrice', label: 'Show Compare-At Price', type: 'boolean' },
        { key: 'showDiscountBadge', label: 'Show Discount Badge', type: 'boolean' },
        { key: 'showStock', label: 'Show Stock Status', type: 'boolean' },
        { key: 'showAddToCart', label: 'Show Add to Cart Button', type: 'boolean' },
        { key: 'showCompareAtPrice', label: 'Show Compare-At Price (Legacy)', type: 'boolean' },
        { key: 'showStockBadge', label: 'Show Stock Status Badge (Legacy)', type: 'boolean' },
        { key: 'showSku', label: 'Show SKU on Cards', type: 'boolean' },
        {
          key: 'cardAction',
          label: 'Primary Card Button',
          type: 'select',
          options: [
            { label: 'Add to Cart + View Details', value: 'add_to_cart' },
            { label: 'View Product Details Only', value: 'view_only' },
          ],
        },
      ],
    },
  },
  product: {
    blueprintId: 'ecommerce-product-blueprint',
    pageType: 'product',
    version: 1,
    slug: 'product',
    title: 'Product Detail Template',
    description:
      'Reusable dynamic template for all published products. Resolves live product data by slug or ID at request time.',
    routePattern: '/product?slug=:slug',
    isDynamicTemplate: true,
    defaultPublished: true,
    blocks: [
      {
        id: 'product-breadcrumbs',
        uniqueId: 'ecommerce-product-breadcrumbs',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.product-breadcrumbs',
        label: 'Catalog Breadcrumb Bar',
        required: false,
        enabled: true,
        settings: {
          showCategoryPath: true,
          showBackToShopLink: true,
        },
      },
      {
        id: 'product-detail-main',
        uniqueId: 'ecommerce-product-detail-main',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.product-detail',
        label: 'Product Gallery & Purchase Box',
        required: true,
        enabled: true,
        settings: {
          galleryPosition: 'left',
          showVariantPicker: true,
          showQuantitySelector: true,
          showStockStatus: true,
          showSku: true,
          showTaxHint: true,
          showDescriptionTab: true,
        },
      },
      {
        id: 'related-products',
        uniqueId: 'ecommerce-product-related',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.related-products',
        label: 'Related Products Section',
        required: false,
        enabled: true,
        settings: {
          sectionTitle: 'Related Products',
          maxItems: 4,
          matchStrategy: 'same_category',
        },
      },
    ],
    fieldSpecs: {
      'ecommerce.product-breadcrumbs': [
        { key: 'showCategoryPath', label: 'Show Category in Breadcrumb', type: 'boolean' },
        { key: 'showBackToShopLink', label: 'Show Back to Shop Link', type: 'boolean' },
      ],
      'ecommerce.product-detail': [
        {
          key: 'galleryPosition',
          label: 'Media Gallery Position',
          type: 'select',
          options: [
            { label: 'Left Column', value: 'left' },
            { label: 'Right Column', value: 'right' },
          ],
        },
        { key: 'showVariantPicker', label: 'Show Size / Color Selector', type: 'boolean' },
        { key: 'showQuantitySelector', label: 'Show Quantity Stepper', type: 'boolean' },
        { key: 'showStockStatus', label: 'Show Live Stock Indicator', type: 'boolean' },
        { key: 'showSku', label: 'Display Product SKU', type: 'boolean' },
        { key: 'showTaxHint', label: 'Show Tax Inclusion Note', type: 'boolean' },
        { key: 'showDescriptionTab', label: 'Show Full Description Section', type: 'boolean' },
      ],
      'ecommerce.related-products': [
        { key: 'sectionTitle', label: 'Section Heading', type: 'string' },
        { key: 'maxItems', label: 'Maximum Related Items', type: 'number', min: 2, max: 12 },
        {
          key: 'matchStrategy',
          label: 'Matching Rule',
          type: 'select',
          options: [
            { label: 'Same Category', value: 'same_category' },
            { label: 'Newest Catalog Items', value: 'newest' },
          ],
        },
      ],
    },
  },
  cart: {
    blueprintId: 'ecommerce-cart-blueprint',
    pageType: 'cart',
    version: 1,
    slug: 'cart',
    title: 'Shopping Cart',
    description:
      'Customer cart page displaying selected items, coupon entry, and live backend-calculated subtotal, discounts, taxes, and shipping estimates.',
    routePattern: '/cart',
    isDynamicTemplate: false,
    defaultPublished: true,
    blocks: [
      {
        id: 'cart-items-list',
        uniqueId: 'ecommerce-cart-items',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.cart-items',
        label: 'Cart Line Items Table',
        required: true,
        enabled: true,
        settings: {
          showThumbnails: true,
          showVariantDetails: true,
          allowQuantityAdjust: true,
          showStockLimitWarning: true,
          emptyCartMessage: 'Your cart is currently empty.',
        },
      },
      {
        id: 'cart-coupon-box',
        uniqueId: 'ecommerce-cart-coupon',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.cart-coupon',
        label: 'Coupon & Promotion Code Box',
        required: false,
        enabled: true,
        settings: {
          inputPlaceholder: 'Enter coupon code',
          showAppliedRuleBadges: true,
        },
      },
      {
        id: 'cart-order-summary',
        uniqueId: 'ecommerce-cart-summary',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.cart-summary',
        label: 'Cart Totals & Tax Summary',
        required: true,
        enabled: true,
        settings: {
          showDiscountBreakdown: true,
          showTaxBreakdown: true,
          showShippingEstimate: true,
          proceedButtonText: 'Proceed to Checkout',
          continueShoppingPath: '/shop',
        },
      },
    ],
    fieldSpecs: {
      'ecommerce.cart-items': [
        { key: 'showThumbnails', label: 'Show Product Thumbnails', type: 'boolean' },
        { key: 'showVariantDetails', label: 'Show Selected Size / Color', type: 'boolean' },
        { key: 'allowQuantityAdjust', label: 'Allow Quantity Controls', type: 'boolean' },
        { key: 'showStockLimitWarning', label: 'Show Stock Cap Alerts', type: 'boolean' },
        { key: 'emptyCartMessage', label: 'Empty Cart Message', type: 'string' },
      ],
      'ecommerce.cart-coupon': [
        { key: 'inputPlaceholder', label: 'Coupon Input Placeholder', type: 'string' },
        { key: 'showAppliedRuleBadges', label: 'Show Applied Promotion Tags', type: 'boolean' },
      ],
      'ecommerce.cart-summary': [
        { key: 'showDiscountBreakdown', label: 'Show Discount Savings Row', type: 'boolean' },
        { key: 'showTaxBreakdown', label: 'Show Itemized Tax Breakdown', type: 'boolean' },
        { key: 'showShippingEstimate', label: 'Show Shipping Estimate Row', type: 'boolean' },
        { key: 'proceedButtonText', label: 'Checkout CTA Label', type: 'string' },
        { key: 'continueShoppingPath', label: 'Continue Shopping Link', type: 'string' },
      ],
    },
  },
  checkout: {
    blueprintId: 'ecommerce-checkout-blueprint',
    pageType: 'checkout',
    version: 1,
    slug: 'checkout',
    title: 'Checkout',
    description:
      'Order completion page structure with customer contact/shipping address inputs and final backend-verified order summary.',
    routePattern: '/checkout',
    isDynamicTemplate: false,
    defaultPublished: true,
    blocks: [
      {
        id: 'checkout-customer-form',
        uniqueId: 'ecommerce-checkout-customer-form',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.checkout-form',
        label: 'Customer & Shipping Address Form',
        required: true,
        enabled: true,
        settings: {
          requirePhone: true,
          enableOrderNotes: true,
          showFulfillmentLocationSelector: true,
          checkoutNotice:
            'Final taxes, shipping rates, and inventory availability are verified on submission.',
        },
      },
      {
        id: 'checkout-order-review',
        uniqueId: 'ecommerce-checkout-order-review',
        type: 'ecommerce-plugin',
        blockType: 'ecommerce.checkout-summary',
        label: 'Order Review & Totals Panel',
        required: true,
        enabled: true,
        settings: {
          showLineItemsList: true,
          showCouponCodeSummary: true,
          showTaxBreakdown: true,
          showShippingRow: true,
          submitButtonLabel: 'Place Order',
        },
      },
    ],
    fieldSpecs: {
      'ecommerce.checkout-form': [
        { key: 'requirePhone', label: 'Require Customer Phone Number', type: 'boolean' },
        { key: 'enableOrderNotes', label: 'Show Delivery Notes Field', type: 'boolean' },
        {
          key: 'showFulfillmentLocationSelector',
          label: 'Show Warehouse Selector (When CustomerSelect Enabled)',
          type: 'boolean',
        },
        { key: 'checkoutNotice', label: 'Checkout Policy Note', type: 'string' },
      ],
      'ecommerce.checkout-summary': [
        { key: 'showLineItemsList', label: 'Show Condensed Line Items', type: 'boolean' },
        { key: 'showCouponCodeSummary', label: 'Show Applied Coupons', type: 'boolean' },
        { key: 'showTaxBreakdown', label: 'Show Tax Rule Breakdown', type: 'boolean' },
        { key: 'showShippingRow', label: 'Show Shipping Cost Row', type: 'boolean' },
        { key: 'submitButtonLabel', label: 'Submit Order Button Label', type: 'string' },
      ],
    },
  },
};

// ---------------------------------------------------------------------------------------------------------
// Blueprint v2: full storefront layout (store header, hero, category tiles, trust strip, footer, two-column
// cart and checkout, related products). Pages still on v1 and not customized upgrade automatically
// (see ensurePageProvisioned); customized pages keep the merchant's blocks.
// ---------------------------------------------------------------------------------------------------------
const bool = (key: string, label: string): StorefrontBlockFieldSpec => ({ key, label, type: 'boolean' });
const text = (key: string, label: string): StorefrontBlockFieldSpec => ({ key, label, type: 'string' });

const V2_FIELD_SPECS: Record<string, StorefrontBlockFieldSpec[]> = {
  'ecommerce.store-header': [
    bool('showAnnouncement', 'Show Announcement Bar'),
    text('announcement', 'Announcement Text (blank = shipping & COD message)'),
    bool('showCategoryLinks', 'Show Category Links'),
    bool('showSearch', 'Show Search'),
  ],
  'ecommerce.shop-hero': [
    text('eyebrow', 'Small Label Above Heading'),
    text('heading', 'Heading'),
    text('subheading', 'Subheading'),
    text('buttonLabel', 'Button Label'),
    {
      key: 'style',
      label: 'Banner Style',
      type: 'select',
      options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Soft', value: 'soft' },
        { label: 'Accent', value: 'accent' },
      ],
    },
  ],
  'ecommerce.category-showcase': [
    text('heading', 'Section Heading'),
    { key: 'maxItems', label: 'Maximum Categories', type: 'number', min: 2, max: 8 },
  ],
  'ecommerce.trust-badges': [
    bool('showShipping', 'Show Shipping Badge'),
    bool('showCod', 'Show Cash on Delivery Badge'),
    bool('showReturns', 'Show Returns Badge'),
    text('returnsText', 'Returns Policy Text'),
    bool('showSecure', 'Show Secure Checkout Badge'),
  ],
  'ecommerce.store-footer': [
    text('aboutText', 'About Text'),
    bool('showContact', 'Show Contact Details'),
  ],
  'ecommerce.cart': [
    text('emptyCartMessage', 'Empty Cart Message'),
    bool('showCoupon', 'Show Coupon Box'),
    bool('showFreeShippingProgress', 'Show Free Shipping Progress'),
    text('proceedButtonText', 'Checkout Button Label'),
  ],
  'ecommerce.checkout': [
    bool('requirePhone', 'Require Phone Number'),
    bool('enableOrderNotes', 'Show Delivery Notes Field'),
    text('checkoutNotice', 'Checkout Policy Note'),
  ],
};

const V2_DEFAULTS: Record<string, Record<string, any>> = {
  'ecommerce.store-header': { showAnnouncement: true, announcement: '', showCategoryLinks: true, showSearch: true },
  'ecommerce.shop-hero': {
    eyebrow: 'New season',
    heading: 'Everyday essentials, made well',
    subheading: 'Browse the full collection. Cash on Delivery available across India.',
    buttonLabel: 'Shop all products',
    style: 'dark',
  },
  'ecommerce.category-showcase': { heading: 'Shop by category', maxItems: 4 },
  'ecommerce.trust-badges': { showShipping: true, showCod: true, showReturns: true, returnsText: 'Easy 7-day returns', showSecure: true },
  'ecommerce.store-footer': { aboutText: 'Quality products, honest prices, delivered to your door.', showContact: true },
  'ecommerce.cart': { emptyCartMessage: 'Your cart is empty.', showCoupon: true, showFreeShippingProgress: true, proceedButtonText: 'Proceed to Checkout' },
  'ecommerce.checkout': {
    requirePhone: true,
    enableOrderNotes: true,
    checkoutNotice: 'Final taxes, shipping and stock are confirmed when you place the order.',
  },
};

function v2Block(page: StorefrontPageType, id: string, blockType: string, label: string, required: boolean, settings?: Record<string, any>): StorefrontBlockConfig {
  return {
    id,
    uniqueId: `ecommerce-${page}-${id}`,
    type: 'ecommerce-plugin',
    blockType,
    label,
    required,
    enabled: true,
    settings: cloneDeepJson(settings ?? V2_DEFAULTS[blockType] ?? {}),
  };
}

function cloneDeepJson<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

/** Reuses a v1 block (same id, settings) so merchant-facing settings stay the same. */
function v1Block(page: StorefrontPageType, blockType: string): StorefrontBlockConfig {
  const found = BASE_BLUEPRINTS[page].blocks.find((b) => b.blockType === blockType);
  if (!found) throw new Error(`Blueprint v1 has no ${blockType} block on the ${page} page`);
  return cloneDeepJson(found);
}

function applyStorefrontV2() {
  const header = (page: StorefrontPageType) => v2Block(page, 'store-header', 'ecommerce.store-header', 'Store Header & Navigation', false);
  const footer = (page: StorefrontPageType) => v2Block(page, 'store-footer', 'ecommerce.store-footer', 'Store Footer', false);
  const trust = (page: StorefrontPageType) => v2Block(page, 'trust-badges', 'ecommerce.trust-badges', 'Trust & Service Badges', false);

  const layouts: Record<StorefrontPageType, StorefrontBlockConfig[]> = {
    shop: [
      header('shop'),
      v2Block('shop', 'shop-hero', 'ecommerce.shop-hero', 'Hero Banner', false),
      v2Block('shop', 'category-showcase', 'ecommerce.category-showcase', 'Shop by Category Tiles', false),
      v1Block('shop', 'ecommerce.category-filter'),
      v1Block('shop', 'ecommerce.product-grid'),
      trust('shop'),
      footer('shop'),
    ],
    product: [
      header('product'),
      v1Block('product', 'ecommerce.product-detail'),
      v1Block('product', 'ecommerce.related-products'),
      trust('product'),
      footer('product'),
    ],
    cart: [header('cart'), v2Block('cart', 'cart', 'ecommerce.cart', 'Cart (Items, Coupon & Summary)', true), trust('cart'), footer('cart')],
    checkout: [header('checkout'), v2Block('checkout', 'checkout', 'ecommerce.checkout', 'Checkout (Details & Order Summary)', true), footer('checkout')],
  };

  for (const page of Object.keys(layouts) as StorefrontPageType[]) {
    const bp = BASE_BLUEPRINTS[page];
    bp.version = 2;
    bp.blocks = layouts[page];
    for (const block of bp.blocks) {
      if (V2_FIELD_SPECS[block.blockType]) bp.fieldSpecs[block.blockType] = V2_FIELD_SPECS[block.blockType];
    }
  }
}
applyStorefrontV2();

// ---------------------------------------------------------------------------------------------------------
// Blueprint v4: the pages are ordinary OpenExt pages made of Ecommerce blocks (the shadcn-based hero,
// category tiles, filter, product grid, store features, product details, cart, checkout). Each block is
// customised in OpenExt's page builder through the plugin's settings schema, and merchants can add, move,
// remove or mix them with OpenExt's own blocks. No plugin header/footer: OpenExt wraps every page with the
// site Header and Footer pages.
// ---------------------------------------------------------------------------------------------------------
export type CmsComponent = Record<string, any>;

/** An Ecommerce block as OpenExt stores it: configuration lives in `content`, which the page builder edits. */
function pluginComponent(block: StorefrontBlockConfig): CmsComponent {
  return {
    id: block.id,
    uniqueId: block.uniqueId,
    type: 'ecommerce-plugin',
    label: block.label,
    content: JSON.stringify({ blockType: block.blockType, settings: block.settings }),
    style: { width: '100%' },
  };
}

const V4_HERO = {
  eyebrow: 'New season',
  heading: 'Everyday essentials, made well',
  subheading: 'Browse the full collection. Cash on Delivery available across India.',
  buttonLabel: 'Shop all products',
  buttonLink: '#catalog',
  style: 'plain',
  imageSource: 'products',
  imagePosition: 'right',
  showHighlights: true,
};
const V4_FEATURES = {
  ...V2_DEFAULTS['ecommerce.trust-badges'],
  layout: 'cards',
  eyebrow: 'Why choose us',
  heading: 'Why shop with us',
  subheading: 'Quality products, honest prices and a checkout that keeps it simple.',
};

function v4EcommerceBlocks(page: StorefrontPageType): StorefrontBlockConfig[] {
  const keep = (blockType: string) => {
    const found = BASE_BLUEPRINTS[page].blocks.find((b) => b.blockType === blockType);
    if (!found) throw new Error(`Blueprint v2 has no ${blockType} block on the ${page} page`);
    return cloneDeepJson(found);
  };
  switch (page) {
    case 'shop':
      return [
        v2Block('shop', 'shop-hero', 'ecommerce.shop-hero', 'Hero Banner', false, V4_HERO),
        keep('ecommerce.category-showcase'),
        keep('ecommerce.category-filter'),
        keep('ecommerce.product-grid'),
        v2Block('shop', 'store-features', 'ecommerce.trust-badges', 'Store Features', false, V4_FEATURES),
      ];
    case 'product':
      return [
        keep('ecommerce.product-detail'),
        keep('ecommerce.related-products'),
        v2Block('product', 'store-features', 'ecommerce.trust-badges', 'Store Features', false, { ...V2_DEFAULTS['ecommerce.trust-badges'], layout: 'strip' }),
      ];
    case 'cart':
      return [keep('ecommerce.cart')];
    case 'checkout':
      return [keep('ecommerce.checkout')];
  }
}

/** The OpenExt page content for a page type, in page order. */
async function buildPageComponents(_page: StorefrontPageType, blocks: StorefrontBlockConfig[]): Promise<CmsComponent[]> {
  return blocks.map(pluginComponent);
}

function applyStorefrontV4() {
  for (const page of STOREFRONT_PAGE_TYPES) {
    const bp = BASE_BLUEPRINTS[page];
    bp.blocks = v4EcommerceBlocks(page);
    bp.version = 4;
  }
}
applyStorefrontV4();

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined && k !== '_id').sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Fingerprint of an OpenExt page's content, used to tell whether the merchant edited it. */
function hashComponents(components: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(Array.isArray(components) ? components : [])).digest('hex');
}

/** Ecommerce blocks inside an OpenExt page (config from `content`, falling back to older top-level fields). */
function extractEcommerceBlocks(components: unknown): StorefrontBlockConfig[] {
  const out: StorefrontBlockConfig[] = [];
  const visit = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      if (Array.isArray(c.children)) c.children.forEach(visit);
      if (c.type !== 'ecommerce-plugin') continue;
      let parsed: any = {};
      if (typeof c.content === 'string' && c.content.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(c.content) || {};
        } catch {
          parsed = {};
        }
      }
      const blockType = String(parsed.blockType || c.blockType || '');
      if (!blockType) continue;
      out.push({
        id: String(c.id || c.uniqueId || blockType),
        uniqueId: String(c.uniqueId || c.id || blockType),
        type: 'ecommerce-plugin',
        blockType,
        label: String(c.label || blockType),
        required: Boolean(c.required),
        enabled: c.enabled !== false,
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : c.settings || {},
      });
    }
  };
  visit(components);
  return out;
}

// Optional runtime overrides used by controlled blueprint upgrade tests
const blueprintOverrides = new Map<StorefrontPageType, StorefrontBlueprintDefinition>();

function cloneDeep<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function stableNormalizeSettings(settings: Record<string, any> | undefined | null): Record<string, any> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  const sortedKeys = Object.keys(settings).sort();
  const normalized: Record<string, any> = {};
  for (const key of sortedKeys) {
    const val = settings[key];
    if (val !== undefined) {
      normalized[key] = val;
    }
  }
  return normalized;
}

export class StorefrontBlueprintService {
  static isValidPageType(pageType: any): pageType is StorefrontPageType {
    return (
      typeof pageType === 'string' &&
      (STOREFRONT_PAGE_TYPES as string[]).includes(pageType)
    );
  }

  static getBlueprint(pageType: StorefrontPageType): StorefrontBlueprintDefinition {
    const override = blueprintOverrides.get(pageType);
    if (override) {
      return cloneDeep(override);
    }
    return cloneDeep(BASE_BLUEPRINTS[pageType]);
  }

  static getAllBlueprints(): StorefrontBlueprintDefinition[] {
    return STOREFRONT_PAGE_TYPES.map((pt) => this.getBlueprint(pt));
  }

  /**
   * Used by tests or future blueprint migrations to register a newer blueprint version definition.
   */
  static setBlueprintOverrideForTesting(
    pageType: StorefrontPageType,
    definition: StorefrontBlueprintDefinition | null
  ): void {
    if (!definition) {
      blueprintOverrides.delete(pageType);
    } else {
      blueprintOverrides.set(pageType, cloneDeep(definition));
    }
  }

  static computeBlocksHash(blocks: StorefrontBlockConfig[]): string {
    const canonical = (Array.isArray(blocks) ? blocks : []).map((b) => ({
      id: String(b.id || ''),
      uniqueId: String(b.uniqueId || ''),
      type: 'ecommerce-plugin',
      blockType: String(b.blockType || ''),
      required: Boolean(b.required),
      enabled: Boolean(b.enabled),
      settings: stableNormalizeSettings(b.settings),
    }));
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(canonical))
      .digest('hex')
      .slice(0, 24);
  }

  private static assertNoEmbeddedCommerceEntities(
    obj: any,
    path: string = 'settings'
  ): string | null {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return null;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        if (item && typeof item === 'object') {
          return `Block ${path}[${i}] cannot store embedded objects or live catalog documents.`;
        }
      }
      return null;
    }

    for (const [key, val] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (FORBIDDEN_LIVE_DATA_KEYS.has(normalizedKey)) {
        return `Block ${path}.${key} is forbidden: storefront blocks must store configuration only, never live catalog or pricing data.`;
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return `Block ${path}.${key} cannot contain nested entity objects.`;
      }
      if (Array.isArray(val)) {
        const nestedErr = this.assertNoEmbeddedCommerceEntities(val, `${path}.${key}`);
        if (nestedErr) return nestedErr;
      }
    }
    return null;
  }

  static validateAndNormalizeBlocks(
    pageType: StorefrontPageType,
    inputBlocks: any
  ): {
    valid: boolean;
    error?: string;
    blocks?: StorefrontBlockConfig[];
  } {
    if (!Array.isArray(inputBlocks) || inputBlocks.length === 0) {
      return {
        valid: false,
        error: 'Page configuration must contain a non-empty ordered blocks array.',
      };
    }

    const blueprint = this.getBlueprint(pageType);
    const blueprintById = new Map<string, StorefrontBlockConfig>();
    const blueprintByBlockType = new Map<string, StorefrontBlockConfig>();

    for (const bpBlock of blueprint.blocks) {
      blueprintById.set(bpBlock.id, bpBlock);
      blueprintByBlockType.set(bpBlock.blockType, bpBlock);
    }

    const seenIds = new Set<string>();
    const seenUniqueIds = new Set<string>();
    const normalizedBlocks: StorefrontBlockConfig[] = [];

    for (let i = 0; i < inputBlocks.length; i++) {
      const raw = inputBlocks[i];
      if (!raw || typeof raw !== 'object') {
        return { valid: false, error: `Block at position ${i + 1} must be an object.` };
      }

      const rawId = typeof raw.id === 'string' ? raw.id.trim() : '';
      const rawBlockType = typeof raw.blockType === 'string' ? raw.blockType.trim() : '';

      const bpBlock = blueprintById.get(rawId) || blueprintByBlockType.get(rawBlockType);
      if (!bpBlock) {
        return {
          valid: false,
          error: `Block "${rawId || rawBlockType || `#${i + 1}`}" is not a valid blueprint block for the "${pageType}" page.`,
        };
      }

      if (rawBlockType && rawBlockType !== bpBlock.blockType) {
        return {
          valid: false,
          error: `Block "${bpBlock.id}" must use blockType "${bpBlock.blockType}".`,
        };
      }

      if (seenIds.has(bpBlock.id)) {
        return {
          valid: false,
          error: `Duplicate block id "${bpBlock.id}" is not allowed.`,
        };
      }
      seenIds.add(bpBlock.id);

      const uniqueId =
        typeof raw.uniqueId === 'string' && raw.uniqueId.trim().length > 0
          ? raw.uniqueId.trim()
          : bpBlock.uniqueId;

      if (seenUniqueIds.has(uniqueId)) {
        return {
          valid: false,
          error: `Duplicate block uniqueId "${uniqueId}" is not allowed.`,
        };
      }
      seenUniqueIds.add(uniqueId);

      const requestedEnabled = raw.enabled !== undefined ? Boolean(raw.enabled) : true;
      if (bpBlock.required && !requestedEnabled) {
        return {
          valid: false,
          error: `Required system block "${bpBlock.label}" (${bpBlock.id}) cannot be disabled.`,
        };
      }

      const rawSettings = raw.settings !== undefined ? raw.settings : {};
      if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
        return {
          valid: false,
          error: `Settings for block "${bpBlock.id}" must be a key-value object.`,
        };
      }

      const forbiddenError = this.assertNoEmbeddedCommerceEntities(
        rawSettings,
        `${bpBlock.id}.settings`
      );
      if (forbiddenError) {
        return { valid: false, error: forbiddenError };
      }

      // Merge and sanitize settings against fieldSpecs + blueprint defaults
      const specs = blueprint.fieldSpecs[bpBlock.blockType] || [];
      const specByKey = new Map<string, StorefrontBlockFieldSpec>();
      for (const spec of specs) {
        specByKey.set(spec.key, spec);
      }

      const mergedSettings: Record<string, any> = {
        ...cloneDeep(bpBlock.settings),
      };

      for (const [k, v] of Object.entries(rawSettings)) {
        const spec = specByKey.get(k);
        if (!spec) {
          // Settings the page builder offers beyond this list (the storefront block defines them and checks
          // every value before use) are kept when they are plain values; anything else is rejected.
          const plain = typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 2000);
          if (!(k in bpBlock.settings) && !plain) {
            return {
              valid: false,
              error: `Unsupported setting "${k}" on block "${bpBlock.id}".`,
            };
          }
        }

        if (spec) {
          if (spec.type === 'boolean') {
            mergedSettings[k] = Boolean(v);
          } else if (spec.type === 'number') {
            const num = Number(v);
            if (!Number.isFinite(num)) {
              return {
                valid: false,
                error: `Setting "${spec.label}" on block "${bpBlock.label}" must be a valid number.`,
              };
            }
            const clampedMin = spec.min !== undefined ? Math.max(spec.min, num) : num;
            const clamped = spec.max !== undefined ? Math.min(spec.max, clampedMin) : clampedMin;
            mergedSettings[k] = clamped;
          } else if (spec.type === 'string') {
            mergedSettings[k] = String(v ?? '')
              .trim()
              .slice(0, 240);
          } else if (spec.type === 'select') {
            const allowedValues = (spec.options || []).map((o) => o.value);
            const normalizedVal =
              typeof allowedValues[0] === 'number' ? Number(v) : String(v ?? '');
            // Newer storefront versions add options (e.g. a 'plain' hero, 6 columns); short plain values pass.
            const passThrough = (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v)) || (typeof v === 'number' && Number.isFinite(v));
            if (allowedValues.length > 0 && !allowedValues.includes(normalizedVal) && !passThrough) {
              return {
                valid: false,
                error: `Invalid option "${String(v)}" for setting "${spec.label}" on block "${bpBlock.label}".`,
              };
            }
            mergedSettings[k] = allowedValues.includes(normalizedVal) ? normalizedVal : v;
          }
        } else {
          mergedSettings[k] = v;
        }
      }

      normalizedBlocks.push({
        id: bpBlock.id,
        uniqueId,
        type: 'ecommerce-plugin',
        blockType: bpBlock.blockType,
        label:
          typeof raw.label === 'string' && raw.label.trim().length > 0
            ? raw.label.trim().slice(0, 120)
            : bpBlock.label,
        required: bpBlock.required,
        enabled: bpBlock.required ? true : requestedEnabled,
        settings: stableNormalizeSettings(mergedSettings),
      });
    }

    // Verify all required blueprint blocks are present
    for (const bpBlock of blueprint.blocks) {
      if (bpBlock.required && !seenIds.has(bpBlock.id)) {
        return {
          valid: false,
          error: `Required system block "${bpBlock.label}" (${bpBlock.id}) cannot be removed from the "${blueprint.title}" page.`,
        };
      }
    }

    return {
      valid: true,
      blocks: normalizedBlocks,
    };
  }

  private static toCmsPageComponents(
    pageType: StorefrontPageType,
    blocks: StorefrontBlockConfig[]
  ): Array<Record<string, any>> {
    return blocks.map((block) => ({
      id: block.id,
      uniqueId: block.uniqueId,
      type: 'ecommerce-plugin',
      blockType: block.blockType,
      label: block.label,
      required: block.required,
      enabled: block.enabled,
      pageType,
      settings: cloneDeep(block.settings),
    }));
  }

  private static getCmsLocaleForTenant(tenantId: string): string {
    return tenantId === 'default_tenant' ? 'en' : `en__${tenantId}`;
  }

  private static async findCmsPage(CmsPageModel: any, tenantId: string, storefrontDoc: any): Promise<any> {
    if (storefrontDoc.cmsPageId) {
      try {
        const byId = await CmsPageModel.findById(storefrontDoc.cmsPageId);
        if (byId) return byId;
      } catch {
        // invalid id: fall back to the slug
      }
    }
    return CmsPageModel.findOne({ slug: storefrontDoc.slug, locale: this.getCmsLocaleForTenant(tenantId), pageType: 'page' });
  }

  /**
   * Reads the storefront page from OpenExt Pages, which own the layout. The OpenExt page is never written
   * here: edits made in the page builder (blocks, text, order, title, published) are kept. Creates the
   * page when it is missing. Records whether the content still matches what the plugin last wrote.
   */
  private static async syncWithCmsPage(
    tenantId: string,
    storefrontDoc: any,
    blueprint: StorefrontBlueprintDefinition
  ): Promise<any> {
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    if (!CmsPageModel) return storefrontDoc;

    const cmsPage = await this.findCmsPage(CmsPageModel, tenantId, storefrontDoc);
    if (!cmsPage) {
      return this.writeCmsLayout(tenantId, storefrontDoc, await buildPageComponents(storefrontDoc.pageType, storefrontDoc.blocks));
    }

    const components = Array.isArray(cmsPage.component) ? cmsPage.component : [];
    const currentHash = hashComponents(components);
    let changed = false;
    const set = (key: string, value: any) => {
      if (storefrontDoc[key] !== value) {
        storefrontDoc[key] = value;
        changed = true;
      }
    };

    set('cmsPageId', String(cmsPage._id));
    if (!storefrontDoc.appliedCmsHash) {
      // Written by an older plugin version: untouched if it still equals what that version wrote.
      const legacy = JSON.stringify(this.toCmsPageComponents(storefrontDoc.pageType, storefrontDoc.blocks));
      if (JSON.stringify(components) === legacy) set('appliedCmsHash', currentHash);
    }
    const customized = !storefrontDoc.appliedCmsHash || currentHash !== storefrontDoc.appliedCmsHash;
    if (customized && !storefrontDoc.isCustomized) set('lastCustomizedAt', new Date());
    set('isCustomized', customized);
    if (storefrontDoc.currentConfigHash !== currentHash) {
      set('currentConfigHash', currentHash);
      set('revision', (Number(storefrontDoc.revision) || 1) + 1);
      const ecommerceBlocks = extractEcommerceBlocks(components);
      storefrontDoc.blocks = ecommerceBlocks;
      storefrontDoc.markModified?.('blocks');
    }
    if (typeof cmsPage.pageName === 'string' && cmsPage.pageName.trim()) set('title', cmsPage.pageName.trim().slice(0, 120));
    set('isPublished', Boolean(cmsPage.isPublished));

    if (changed) await storefrontDoc.save();
    return storefrontDoc;
  }

  /** Writes the plugin's layout into the OpenExt page (create, upgrade of an untouched page, or reset). */
  private static async writeCmsLayout(
    tenantId: string,
    storefrontDoc: any,
    components: CmsComponent[],
    asPluginLayout: boolean = true
  ): Promise<any> {
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    const hash = hashComponents(components);
    if (CmsPageModel) {
      let cmsPage = await this.findCmsPage(CmsPageModel, tenantId, storefrontDoc);
      if (!cmsPage) {
        cmsPage = await CmsPageModel.create({
          pageName: storefrontDoc.title,
          pageType: 'page',
          isPublished: Boolean(storefrontDoc.isPublished),
          isHome: false,
          isGlobal: false,
          preHeading: storefrontDoc.blueprintId,
          description: storefrontDoc.description,
          slug: storefrontDoc.slug,
          locale: this.getCmsLocaleForTenant(tenantId),
          translationGroupId: `${tenantId}:${storefrontDoc.blueprintId}`,
          seoName: storefrontDoc.title,
          seoMeta: storefrontDoc.description,
          component: components,
          modifications: [],
        });
      } else {
        cmsPage.component = components;
        cmsPage.markModified?.('component');
        cmsPage.pageName = storefrontDoc.title;
        cmsPage.description = storefrontDoc.description;
        cmsPage.isPublished = Boolean(storefrontDoc.isPublished);
        await cmsPage.save();
      }
      storefrontDoc.cmsPageId = String(cmsPage._id);
    }
    if (asPluginLayout) storefrontDoc.appliedCmsHash = hash;
    storefrontDoc.currentConfigHash = hash;
    storefrontDoc.isCustomized = hash !== storefrontDoc.appliedCmsHash;
    storefrontDoc.blocks = extractEcommerceBlocks(components);
    storefrontDoc.markModified?.('blocks');
    await storefrontDoc.save();
    return storefrontDoc;
  }

  /** Writes only the page title / description / published flag to the OpenExt page. */
  private static async writeCmsMeta(tenantId: string, storefrontDoc: any): Promise<void> {
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    if (!CmsPageModel) return;
    const cmsPage = await this.findCmsPage(CmsPageModel, tenantId, storefrontDoc);
    if (!cmsPage) return;
    cmsPage.pageName = storefrontDoc.title;
    cmsPage.description = storefrontDoc.description;
    cmsPage.isPublished = Boolean(storefrontDoc.isPublished);
    await cmsPage.save();
  }

  /**
   * Replaces the Ecommerce blocks of the OpenExt page with `blocks` (plugin admin API), keeping the
   * merchant's other OpenExt blocks where they are. The new Ecommerce blocks go where the first one was.
   */
  private static async writeCmsEcommerceBlocks(tenantId: string, storefrontDoc: any, blocks: StorefrontBlockConfig[]): Promise<void> {
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    const current = CmsPageModel ? await this.findCmsPage(CmsPageModel, tenantId, storefrontDoc) : null;
    const existing: CmsComponent[] = Array.isArray(current?.component) ? current.component : [];
    const next: CmsComponent[] = [];
    let inserted = false;
    for (const c of existing) {
      if (c && c.type === 'ecommerce-plugin') {
        if (!inserted) {
          next.push(...blocks.filter((b) => b.enabled).map(pluginComponent));
          inserted = true;
        }
        continue;
      }
      next.push(c);
    }
    if (!inserted) next.push(...blocks.filter((b) => b.enabled).map(pluginComponent));
    await this.writeCmsLayout(tenantId, storefrontDoc, next, false);
  }

  /**
   * Gives the storefront pages an owner. Pages are created at plugin start-up, when no one is signed in,
   * so they have no `createdBy`; OpenExt's Pages list hides ownerless pages from most roles (and its
   * search breaks on them). The first signed-in admin to use the plugin becomes their owner.
   * Returns how many pages were updated.
   */
  static async adoptOwnerlessPages(tenantId: string, userId: string): Promise<number> {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId) || String(userId).length !== 24) return 0;
    const CmsPageModel = await StorefrontPage.getCmsPageModel();
    if (!CmsPageModel) return 0;
    const docs = await StorefrontPage.getModel().find({ tenantId, cmsPageId: { $ne: null } }).select('cmsPageId').lean();
    const ids = docs.map((d: any) => String(d.cmsPageId)).filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    if (ids.length === 0) return 0;
    const result = await CmsPageModel.updateMany(
      { _id: { $in: ids }, $or: [{ createdBy: { $exists: false } }, { createdBy: null }] },
      { $set: { createdBy: new mongoose.Types.ObjectId(userId) } }
    );
    return Number(result?.modifiedCount ?? result?.nModified ?? 0);
  }

  /**
   * Idempotently provisions all 4 default storefront pages for a tenant and handles safe blueprint version upgrades.
   */
  static async ensureProvisionedForTenant(tenantId: string): Promise<StorefrontPageDTO[]> {
    const results: StorefrontPageDTO[] = [];
    for (const pageType of STOREFRONT_PAGE_TYPES) {
      const dto = await this.ensurePageProvisioned(tenantId, pageType);
      results.push(dto);
    }
    return results;
  }

  static async ensurePageProvisioned(
    tenantId: string,
    pageType: StorefrontPageType
  ): Promise<StorefrontPageDTO> {
    const StorefrontPageModel = StorefrontPage.getModel();
    const blueprint = this.getBlueprint(pageType);
    const blueprintHash = this.computeBlocksHash(blueprint.blocks);

    let doc = await StorefrontPageModel.findOne({ tenantId, pageType });

    if (!doc) {
      try {
        doc = await StorefrontPageModel.create({
          tenantId,
          pageType,
          blueprintId: blueprint.blueprintId,
          cmsPageId: null,
          slug: blueprint.slug,
          title: blueprint.title,
          description: blueprint.description,
          routePattern: blueprint.routePattern,
          isDynamicTemplate: blueprint.isDynamicTemplate,
          isPublished: blueprint.defaultPublished,
          appliedBlueprintVersion: blueprint.version,
          appliedBlueprintHash: blueprintHash,
          currentConfigHash: blueprintHash,
          isCustomized: false,
          revision: 1,
          lastCustomizedAt: null,
          lastResetAt: null,
          blocks: cloneDeep(blueprint.blocks),
        });
      } catch (err: any) {
        // Handle concurrent provisioning race gracefully
        if (err && err.code === 11000) {
          doc = await StorefrontPageModel.findOne({ tenantId, pageType });
        } else {
          throw err;
        }
      }
    }

    // Read the OpenExt page first (it owns the layout); creates it when missing
    doc = await this.syncWithCmsPage(tenantId, doc, blueprint);

    // Check if blueprint definition has a newer version than what was applied
    if (doc.appliedBlueprintVersion < blueprint.version) {
      if (!doc.isCustomized) {
        // Safe automatic upgrade for pages nobody edited in the page builder
        doc.appliedBlueprintVersion = blueprint.version;
        doc.appliedBlueprintHash = blueprintHash;
        doc.routePattern = blueprint.routePattern;
        doc.isDynamicTemplate = blueprint.isDynamicTemplate;
        doc.revision = (Number(doc.revision) || 1) + 1;
        doc = await this.writeCmsLayout(tenantId, doc, await buildPageComponents(pageType, blueprint.blocks));
      }
      // Edited pages keep the merchant's content; Settings → Storefront pages offers "Apply latest design".
    }

    return this.toDTO(doc, blueprint);
  }

  static async updatePageConfiguration(
    tenantId: string,
    pageType: StorefrontPageType,
    payload: {
      title?: string;
      description?: string;
      isPublished?: boolean;
      blocks?: any[];
      expectedRevision?: number;
    }
  ): Promise<{
    success: boolean;
    status: number;
    error?: string;
    page?: StorefrontPageDTO;
  }> {
    await this.ensurePageProvisioned(tenantId, pageType);

    const StorefrontPageModel = StorefrontPage.getModel();
    const blueprint = this.getBlueprint(pageType);
    const doc = await StorefrontPageModel.findOne({ tenantId, pageType });

    if (!doc) {
      return {
        success: false,
        status: 404,
        error: `Storefront page "${pageType}" not found.`,
      };
    }

    if (
      payload.expectedRevision !== undefined &&
      Number(payload.expectedRevision) !== Number(doc.revision)
    ) {
      return {
        success: false,
        status: 409,
        error:
          'Page configuration was modified in another session. Please refresh to load the latest revision before saving.',
      };
    }

    let nextBlocks: StorefrontBlockConfig[] = doc.blocks;
    if (payload.blocks !== undefined) {
      const validation = this.validateAndNormalizeBlocks(pageType, payload.blocks);
      if (!validation.valid || !validation.blocks) {
        return {
          success: false,
          status: 400,
          error: validation.error || 'Invalid block configuration.',
        };
      }
      nextBlocks = validation.blocks;
    }

    const nextTitle =
      typeof payload.title === 'string' && payload.title.trim().length > 0
        ? payload.title.trim().slice(0, 120)
        : doc.title;

    const nextDescription =
      typeof payload.description === 'string'
        ? payload.description.trim().slice(0, 400)
        : doc.description;

    const nextPublished =
      payload.isPublished !== undefined ? Boolean(payload.isPublished) : Boolean(doc.isPublished);

    doc.title = nextTitle;
    doc.description = nextDescription;
    doc.isPublished = nextPublished;
    doc.revision = (Number(doc.revision) || 1) + 1;

    if (payload.blocks !== undefined) {
      await this.writeCmsEcommerceBlocks(tenantId, doc, nextBlocks);
      doc.lastCustomizedAt = doc.isCustomized ? new Date() : doc.lastCustomizedAt;
      await doc.save();
    } else {
      await doc.save();
      await this.writeCmsMeta(tenantId, doc);
    }

    return {
      success: true,
      status: 200,
      page: this.toDTO(doc, blueprint),
    };
  }

  static async resetPageToDefault(
    tenantId: string,
    pageType: StorefrontPageType,
    confirmReset: boolean
  ): Promise<{
    success: boolean;
    status: number;
    error?: string;
    page?: StorefrontPageDTO;
  }> {
    if (confirmReset !== true) {
      return {
        success: false,
        status: 400,
        error:
          'Explicit confirmation (confirmReset: true) is required to reset a storefront page to its default blueprint.',
      };
    }

    await this.ensurePageProvisioned(tenantId, pageType);

    const StorefrontPageModel = StorefrontPage.getModel();
    const blueprint = this.getBlueprint(pageType);
    const blueprintHash = this.computeBlocksHash(blueprint.blocks);

    const doc = await StorefrontPageModel.findOne({ tenantId, pageType });
    if (!doc) {
      return {
        success: false,
        status: 404,
        error: `Storefront page "${pageType}" not found.`,
      };
    }

    doc.title = blueprint.title;
    doc.description = blueprint.description;
    doc.slug = blueprint.slug;
    doc.routePattern = blueprint.routePattern;
    doc.isDynamicTemplate = blueprint.isDynamicTemplate;
    doc.isPublished = blueprint.defaultPublished;
    doc.appliedBlueprintVersion = blueprint.version;
    doc.appliedBlueprintHash = blueprintHash;
    doc.lastResetAt = new Date();
    doc.revision = (Number(doc.revision) || 1) + 1;
    await this.writeCmsLayout(tenantId, doc, await buildPageComponents(pageType, blueprint.blocks));

    return {
      success: true,
      status: 200,
      page: this.toDTO(doc, blueprint),
    };
  }

  static toDTO(doc: any, blueprint?: StorefrontBlueprintDefinition): StorefrontPageDTO {
    const pageType = doc.pageType as StorefrontPageType;
    const bp = blueprint || this.getBlueprint(pageType);
    const appliedVersion = Number(doc.appliedBlueprintVersion) || 1;
    const latestVersion = Number(bp.version) || 1;
    const isCustomized = Boolean(doc.isCustomized);

    const blocks: StorefrontBlockConfig[] = (Array.isArray(doc.blocks) ? doc.blocks : []).map(
      (b: any) => ({
        id: String(b.id || ''),
        uniqueId: String(b.uniqueId || ''),
        type: 'ecommerce-plugin',
        blockType: String(b.blockType || ''),
        label: String(b.label || ''),
        required: Boolean(b.required),
        enabled: Boolean(b.enabled),
        settings: stableNormalizeSettings(b.settings),
      })
    );

    return {
      id: String(doc._id),
      pageType,
      blueprintId: String(doc.blueprintId || bp.blueprintId),
      cmsPageId: doc.cmsPageId ? String(doc.cmsPageId) : null,
      slug: String(doc.slug || bp.slug),
      title: String(doc.title || bp.title),
      description: String(doc.description ?? bp.description),
      routePattern: String(doc.routePattern || bp.routePattern),
      isDynamicTemplate: Boolean(doc.isDynamicTemplate ?? bp.isDynamicTemplate),
      isPublished: Boolean(doc.isPublished),
      appliedBlueprintVersion: appliedVersion,
      latestBlueprintVersion: latestVersion,
      hasNewerBlueprint: latestVersion > appliedVersion,
      appliedBlueprintHash: String(doc.appliedBlueprintHash || ''),
      currentConfigHash: String(doc.currentConfigHash || ''),
      isCustomized,
      customizationState: isCustomized ? 'Customized' : 'Default',
      revision: Number(doc.revision) || 1,
      lastCustomizedAt: doc.lastCustomizedAt
        ? new Date(doc.lastCustomizedAt).toISOString()
        : null,
      lastResetAt: doc.lastResetAt ? new Date(doc.lastResetAt).toISOString() : null,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      blocks,
      fieldSpecs: cloneDeep(bp.fieldSpecs),
    };
  }

  static toPublicPageDTO(dto: StorefrontPageDTO) {
    return {
      pageType: dto.pageType,
      blueprintId: dto.blueprintId,
      slug: dto.slug,
      title: dto.title,
      description: dto.description,
      routePattern: dto.routePattern,
      isDynamicTemplate: dto.isDynamicTemplate,
      isPublished: dto.isPublished,
      appliedBlueprintVersion: dto.appliedBlueprintVersion,
      revision: dto.revision,
      blocks: dto.blocks.filter((b) => b.enabled),
    };
  }

  /**
   * Read-only statistics for storefront health check. Performs ZERO database writes.
   */
  static async getPageStatsForTenant(tenantId: string): Promise<{
    totalBlueprints: number;
    provisionedPages: number;
    publishedPages: number;
    customizedPages: number;
  }> {
    const StorefrontPageModel = StorefrontPage.getModel();
    const [provisionedPages, publishedPages, customizedPages] = await Promise.all([
      StorefrontPageModel.countDocuments({ tenantId }),
      StorefrontPageModel.countDocuments({ tenantId, isPublished: true }),
      StorefrontPageModel.countDocuments({ tenantId, isCustomized: true }),
    ]);

    return {
      totalBlueprints: STOREFRONT_PAGE_TYPES.length,
      provisionedPages,
      publishedPages,
      customizedPages,
    };
  }

  /**
   * Read-only public page resolver. Performs ZERO database writes.
   * Enforces published-only visibility.
   */
  static async getPublicPageReadOnly(
    tenantId: string,
    pageType: StorefrontPageType
  ): Promise<any | null> {
    const StorefrontPageModel = StorefrontPage.getModel();
    const doc = await StorefrontPageModel.findOne({ tenantId, pageType }).lean();

    if (doc) {
      if (!doc.isPublished) return null;
      const bp = this.getBlueprint(pageType);
      const fullDto = this.toDTO(doc, bp);
      return this.toPublicPageDTO(fullDto);
    }

    // If page document not yet created, check if blueprint is defaultPublished
    const blueprint = this.getBlueprint(pageType);
    if (!blueprint.defaultPublished) return null;

    return {
      pageType,
      blueprintId: blueprint.blueprintId,
      slug: blueprint.slug,
      title: blueprint.title,
      description: blueprint.description,
      routePattern: blueprint.routePattern,
      isDynamicTemplate: blueprint.isDynamicTemplate,
      isPublished: true,
      appliedBlueprintVersion: blueprint.version,
      revision: 1,
      blocks: cloneDeep(blueprint.blocks).filter((b: any) => b.enabled),
    };
  }
}
