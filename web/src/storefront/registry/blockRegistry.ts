import { StorefrontFoundationBlock } from '../blocks/StorefrontFoundationBlock';
import { PlannedMilestoneBlock } from '../blocks/PlannedMilestoneBlock';
import { ProductGridBlock } from '../blocks/ProductGridBlock';
import type {
  BlockDefinition,
  BlockRegistry,
  BlockSettingsMap,
  StorefrontPageType,
} from '../types/storefront';

const registryStore = new Map<string, BlockDefinition<BlockSettingsMap>>();

export const blockRegistry: BlockRegistry = {
  register<TSettings extends BlockSettingsMap>(definition: BlockDefinition<TSettings>): void {
    if (!definition || !definition.blockType) {
      throw new Error('Block definition must have a non-empty blockType.');
    }
    registryStore.set(
      definition.blockType,
      definition as unknown as BlockDefinition<BlockSettingsMap>
    );
  },

  get(blockType: string): BlockDefinition<BlockSettingsMap> | undefined {
    if (!blockType) return undefined;
    return registryStore.get(blockType);
  },

  has(blockType: string): boolean {
    if (!blockType) return false;
    return registryStore.has(blockType);
  },

  getAll(): BlockDefinition<BlockSettingsMap>[] {
    return Array.from(registryStore.values());
  },

  getByPageType(pageType: StorefrontPageType): BlockDefinition<BlockSettingsMap>[] {
    return Array.from(registryStore.values()).filter((def) => def.pageType === pageType);
  },
};

// ==========================================
// REGISTRATION OF ALL MILESTONE BLOCKS
// ==========================================

// 1. Milestone 1 Foundation Proof Block
blockRegistry.register({
  blockType: 'ecommerce.foundation',
  defaultLabel: 'Ecommerce Storefront Foundation',
  requiredByDefault: false,
  status: 'implemented',
  plannedMilestone: 'Milestone 1 — Storefront Foundation',
  defaultSettings: {},
  fieldSpecs: [],
  component: StorefrontFoundationBlock,
});

// 2. Shop Blueprint Blocks (Milestone 2 Blueprints, Scheduled for Milestones 5, 7, 9)
blockRegistry.register({
  blockType: 'ecommerce.shop-header',
  defaultLabel: 'Shop Header & Breadcrumbs',
  pageType: 'shop',
  requiredByDefault: false,
  status: 'planned',
  plannedMilestone: 'Milestone 9 — Shop Page',
  defaultSettings: {
    heading: 'All Products',
    subheading: 'Browse our live catalog and filter by category.',
    showBreadcrumbs: true,
    showTotalCount: true,
  },
  fieldSpecs: [
    { key: 'heading', label: 'Header Title', type: 'string' },
    { key: 'subheading', label: 'Header Subtitle', type: 'string' },
    { key: 'showBreadcrumbs', label: 'Show Breadcrumbs', type: 'boolean' },
    { key: 'showTotalCount', label: 'Show Product Count', type: 'boolean' },
  ],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.category-filter',
  defaultLabel: 'Category Filter & Search Toolbar',
  pageType: 'shop',
  requiredByDefault: false,
  status: 'planned',
  plannedMilestone: 'Milestone 7 & 9 — Search, Filter & Shop Page',
  defaultSettings: {
    filterLayout: 'horizontal-pills',
    showSearchInput: true,
    showSortDropdown: true,
    defaultSort: 'newest',
  },
  fieldSpecs: [
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
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.product-grid',
  defaultLabel: 'Catalog Product Grid',
  pageType: 'shop',
  requiredByDefault: true,
  status: 'implemented',
  plannedMilestone: 'Milestone 5 — Product Grid',
  defaultSettings: {
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
    // Blueprint backward-compatibility aliases
    showCompareAtPrice: true,
    showStockBadge: true,
    cardAction: 'add_to_cart',
  },
  fieldSpecs: [
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
  ],
  component: ProductGridBlock,
});

// 3. Product Page Blueprint Blocks (Scheduled for Milestone 10)
blockRegistry.register({
  blockType: 'ecommerce.product-breadcrumbs',
  defaultLabel: 'Catalog Breadcrumb Bar',
  pageType: 'product',
  requiredByDefault: false,
  status: 'planned',
  plannedMilestone: 'Milestone 10 — Product Detail Page',
  defaultSettings: {
    showCategoryPath: true,
    showBackToShopLink: true,
  },
  fieldSpecs: [
    { key: 'showCategoryPath', label: 'Show Category in Breadcrumb', type: 'boolean' },
    { key: 'showBackToShopLink', label: 'Show Back to Shop Link', type: 'boolean' },
  ],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.product-detail',
  defaultLabel: 'Product Gallery & Purchase Box',
  pageType: 'product',
  requiredByDefault: true,
  status: 'planned',
  plannedMilestone: 'Milestone 10 — Product Detail Page',
  defaultSettings: {
    galleryPosition: 'left',
    showVariantPicker: true,
    showQuantitySelector: true,
    showStockStatus: true,
    showSku: true,
    showTaxHint: true,
    showDescriptionTab: true,
  },
  fieldSpecs: [
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
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.related-products',
  defaultLabel: 'Related Products Section',
  pageType: 'product',
  requiredByDefault: false,
  status: 'planned',
  plannedMilestone: 'Milestone 5 & 10 — Product Grid & Product Detail Page',
  defaultSettings: {
    sectionTitle: 'Related Products',
    maxItems: 4,
    matchStrategy: 'same_category',
  },
  fieldSpecs: [
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
  component: PlannedMilestoneBlock,
});

// 4. Cart Page Blueprint Blocks (Scheduled for Milestone 11)
blockRegistry.register({
  blockType: 'ecommerce.cart-items',
  defaultLabel: 'Cart Line Items Table',
  pageType: 'cart',
  requiredByDefault: true,
  status: 'planned',
  plannedMilestone: 'Milestone 11 — Cart Page',
  defaultSettings: {
    showThumbnails: true,
    showVariantDetails: true,
    allowQuantityAdjust: true,
    showStockLimitWarning: true,
    emptyCartMessage: 'Your cart is currently empty.',
  },
  fieldSpecs: [
    { key: 'showThumbnails', label: 'Show Product Thumbnails', type: 'boolean' },
    { key: 'showVariantDetails', label: 'Show Selected Size / Color', type: 'boolean' },
    { key: 'allowQuantityAdjust', label: 'Allow Quantity Controls', type: 'boolean' },
    { key: 'showStockLimitWarning', label: 'Show Stock Cap Alerts', type: 'boolean' },
    { key: 'emptyCartMessage', label: 'Empty Cart Message', type: 'string' },
  ],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.cart-coupon',
  defaultLabel: 'Coupon & Promotion Code Box',
  pageType: 'cart',
  requiredByDefault: false,
  status: 'planned',
  plannedMilestone: 'Milestone 11 — Cart Page',
  defaultSettings: {
    inputPlaceholder: 'Enter coupon code',
    showAppliedRuleBadges: true,
  },
  fieldSpecs: [
    { key: 'inputPlaceholder', label: 'Coupon Input Placeholder', type: 'string' },
    { key: 'showAppliedRuleBadges', label: 'Show Applied Promotion Tags', type: 'boolean' },
  ],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.cart-summary',
  defaultLabel: 'Cart Totals & Tax Summary',
  pageType: 'cart',
  requiredByDefault: true,
  status: 'planned',
  plannedMilestone: 'Milestone 11 — Cart Page',
  defaultSettings: {
    showDiscountBreakdown: true,
    showTaxBreakdown: true,
    showShippingEstimate: true,
    proceedButtonText: 'Proceed to Checkout',
    continueShoppingPath: '/shop',
  },
  fieldSpecs: [
    { key: 'showDiscountBreakdown', label: 'Show Discount Savings Row', type: 'boolean' },
    { key: 'showTaxBreakdown', label: 'Show Itemized Tax Breakdown', type: 'boolean' },
    { key: 'showShippingEstimate', label: 'Show Shipping Estimate Row', type: 'boolean' },
    { key: 'proceedButtonText', label: 'Checkout CTA Label', type: 'string' },
    { key: 'continueShoppingPath', label: 'Continue Shopping Link', type: 'string' },
  ],
  component: PlannedMilestoneBlock,
});

// 5. Checkout Page Blueprint Blocks (Scheduled for Milestone 12)
blockRegistry.register({
  blockType: 'ecommerce.checkout-form',
  defaultLabel: 'Customer & Shipping Address Form',
  pageType: 'checkout',
  requiredByDefault: true,
  status: 'planned',
  plannedMilestone: 'Milestone 12 — Checkout Page',
  defaultSettings: {
    requirePhone: true,
    enableOrderNotes: true,
    showFulfillmentLocationSelector: true,
    checkoutNotice:
      'Final taxes, shipping rates, and inventory availability are verified on submission.',
  },
  fieldSpecs: [
    { key: 'requirePhone', label: 'Require Customer Phone Number', type: 'boolean' },
    { key: 'enableOrderNotes', label: 'Show Delivery Notes Field', type: 'boolean' },
    {
      key: 'showFulfillmentLocationSelector',
      label: 'Show Warehouse Selector (When CustomerSelect Enabled)',
      type: 'boolean',
    },
    { key: 'checkoutNotice', label: 'Checkout Policy Note', type: 'string' },
  ],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.checkout-summary',
  defaultLabel: 'Order Review & Totals Panel',
  pageType: 'checkout',
  requiredByDefault: true,
  status: 'planned',
  plannedMilestone: 'Milestone 12 — Checkout Page',
  defaultSettings: {
    showLineItemsList: true,
    showCouponCodeSummary: true,
    showTaxBreakdown: true,
    showShippingRow: true,
    submitButtonLabel: 'Place Order',
  },
  fieldSpecs: [
    { key: 'showLineItemsList', label: 'Show Condensed Line Items', type: 'boolean' },
    { key: 'showCouponCodeSummary', label: 'Show Applied Coupons', type: 'boolean' },
    { key: 'showTaxBreakdown', label: 'Show Tax Rule Breakdown', type: 'boolean' },
    { key: 'showShippingRow', label: 'Show Shipping Cost Row', type: 'boolean' },
    { key: 'submitButtonLabel', label: 'Submit Order Button Label', type: 'string' },
  ],
  component: PlannedMilestoneBlock,
});
