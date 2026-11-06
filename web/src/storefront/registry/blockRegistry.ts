import { StorefrontFoundationBlock } from '../blocks/StorefrontFoundationBlock';
import { PlannedMilestoneBlock } from '../blocks/PlannedMilestoneBlock';
import { ProductGridBlock } from '../blocks/ProductGridBlock';
import { ProductDetailBlock } from '../blocks/ProductDetailBlock';
import { RelatedProductsBlock } from '../blocks/RelatedProductsBlock';
import { OrderLookupBlock } from '../blocks/OrderLookupBlock';
import { CartButtonBlock, CategoryShowcaseBlock, ProductSearchBlock, ShopHeroBlock, StoreFooterBlock, StoreHeaderBlock, TrustBadgesBlock } from '../blocks/StoreChrome';
import { CategoryFilterBlock, ShopHeaderBlock } from '../blocks/ShopBlocks';
import { CartCouponBlock, CartItemsBlock, CartPageBlock, CartSummaryBlock } from '../blocks/CartBlocks';
import { CheckoutFormBlock, CheckoutPageBlock, CheckoutSummaryBlock } from '../blocks/CheckoutBlocks';
import type { BlockDefinition, BlockRegistry, BlockSettingsMap, StorefrontBlockFieldSpec, StorefrontPageType } from '../types/storefront';

const registryStore = new Map<string, BlockDefinition<BlockSettingsMap>>();

export const blockRegistry: BlockRegistry = {
  register<TSettings extends BlockSettingsMap>(definition: BlockDefinition<TSettings>): void {
    if (!definition || !definition.blockType) {
      throw new Error('Block definition must have a non-empty blockType.');
    }
    registryStore.set(definition.blockType, definition as unknown as BlockDefinition<BlockSettingsMap>);
  },
  get(blockType: string) {
    return blockType ? registryStore.get(blockType) : undefined;
  },
  has(blockType: string) {
    return Boolean(blockType) && registryStore.has(blockType);
  },
  getAll() {
    return Array.from(registryStore.values());
  },
  getByPageType(pageType: StorefrontPageType) {
    return Array.from(registryStore.values()).filter((def) => def.pageType === pageType);
  },
};

// ---------------------------------------------------------------------------------------------------------
// Field helpers. These fields become the block's settings form in OpenExt's page builder (settingsSchema.ts).
// ---------------------------------------------------------------------------------------------------------
type When = StorefrontBlockFieldSpec['showWhen'];
const bool = (key: string, label: string, showWhen?: When): StorefrontBlockFieldSpec => ({ key, label, type: 'boolean', showWhen });
const str = (key: string, label: string, description?: string, showWhen?: When): StorefrontBlockFieldSpec => ({ key, label, type: 'string', description, showWhen });
const long = (key: string, label: string, description?: string, showWhen?: When): StorefrontBlockFieldSpec => ({ key, label, type: 'text', description, showWhen });
const numberField = (key: string, label: string, min: number, max: number): StorefrontBlockFieldSpec => ({ key, label, type: 'number', min, max });
const select = (key: string, label: string, options: Array<[string | number, string]>, description?: string, showWhen?: When): StorefrontBlockFieldSpec => ({
  key,
  label,
  type: 'select',
  options: options.map(([value, label]) => ({ value, label })),
  description,
  showWhen,
});
const when = (key: string, ...equals: Array<string | number | boolean>): When => ({ key, equals });
const LINK_HINT = 'A page address like /shop, or #catalog to scroll to the product grid.';

// 1. Foundation (an Ecommerce block with nothing chosen yet, on very old pages).
blockRegistry.register({
  blockType: 'ecommerce.foundation',
  defaultLabel: 'Ecommerce Storefront Foundation',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {},
  fieldSpecs: [],
  component: StorefrontFoundationBlock,
});

// 2. Shop page.
blockRegistry.register({
  blockType: 'ecommerce.shop-header',
  defaultLabel: 'Shop Header & Breadcrumbs',
  pageType: 'shop',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    heading: 'All Products',
    subheading: 'Browse our live catalog and filter by category.',
    showBreadcrumbs: true,
    showTotalCount: true,
    showCartLink: true,
    align: 'left',
  },
  fieldSpecs: [
    str('heading', 'Heading'),
    str('subheading', 'Text under the heading'),
    select('align', 'Alignment', [['left', 'Left'], ['center', 'Centre']]),
    bool('showBreadcrumbs', 'Show breadcrumbs'),
    bool('showTotalCount', 'Show product count'),
    bool('showCartLink', 'Show cart link', when('align', 'left')),
  ],
  component: ShopHeaderBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.category-filter',
  defaultLabel: 'Shop Filter (Search, Category, Price, Sort)',
  pageType: 'shop',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    filterLayout: 'horizontal-pills',
    heading: '',
    description: '',
    showSearchInput: true,
    searchPlaceholder: 'Search products…',
    showCategoryFilter: true,
    showPriceFilter: true,
    priceRanges: '0-500, 500-1000, 1000-2500, 2500+',
    showSortDropdown: true,
    defaultSort: 'newest',
    showActiveFilters: true,
    showResultsBar: true,
  },
  fieldSpecs: [
    select(
      'filterLayout',
      'Layout',
      [
        ['horizontal-pills', 'Bar with category buttons'],
        ['dropdown', 'Bar with dropdowns'],
        ['sidebar-list', 'Sidebar (place in a column next to the grid)'],
      ]
    ),
    str('heading', 'Heading (optional)'),
    str('description', 'Text under the heading (optional)'),
    bool('showSearchInput', 'Show search'),
    str('searchPlaceholder', 'Search placeholder', undefined, when('showSearchInput', true)),
    bool('showCategoryFilter', 'Show category filter'),
    bool('showPriceFilter', 'Show price filter'),
    str('priceRanges', 'Price ranges (₹)', 'Comma-separated, e.g. 0-500, 500-1000, 2500+', when('showPriceFilter', true)),
    bool('showSortDropdown', 'Show sort'),
    select(
      'defaultSort',
      'Default sort',
      [
        ['newest', 'Newest first'],
        ['price_asc', 'Price: low to high'],
        ['price_desc', 'Price: high to low'],
        ['name_asc', 'Name: A to Z'],
      ]
    ),
    bool('showActiveFilters', 'Show active filter chips'),
    bool('showResultsBar', 'Show results bar', when('filterLayout', 'horizontal-pills', 'dropdown')),
  ],
  component: CategoryFilterBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.product-grid',
  defaultLabel: 'Product Grid',
  pageType: 'shop',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    heading: '',
    description: '',
    source: 'all',
    categoryId: '',
    selectedProductIds: '',
    sort: 'newest',
    pageSize: 12,
    columnsDesktop: 4,
    columnsTablet: 2,
    columnsMobile: 2,
    imageAspect: 'square',
    showCategory: true,
    showComparePrice: true,
    showDiscountBadge: true,
    showStock: true,
    showAddToCart: true,
    showSku: false,
    showResultCount: true,
    showPagination: true,
    // Older page aliases
    showCompareAtPrice: true,
    showStockBadge: true,
    cardAction: 'add_to_cart',
  },
  fieldSpecs: [
    str('heading', 'Heading (optional)'),
    str('description', 'Text under the heading (optional)'),
    select(
      'source',
      'Products to show',
      [
        ['all', 'All products (follows the shop filter)'],
        ['latest', 'Newest arrivals'],
        ['category', 'One category'],
        ['selected', 'Hand-picked products'],
      ]
    ),
    str('categoryId', 'Category', 'Includes its sub-categories.', when('source', 'category')),
    str('selectedProductIds', 'Product IDs', 'Comma-separated, in the order to show them.', when('source', 'selected')),
    select('sort', 'Sort', [['newest', 'Newest first'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name_asc', 'Name: A to Z']]),
    numberField('pageSize', 'Products per page', 1, 48),
    select('columnsDesktop', 'Columns on wide screens', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]),
    select('columnsTablet', 'Columns on tablets', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]),
    select('columnsMobile', 'Columns on phones', [[1, '1'], [2, '2']]),
    select('imageAspect', 'Picture shape', [['square', 'Square'], ['portrait', 'Portrait (4:5)'], ['landscape', 'Landscape (4:3)']]),
    bool('showCategory', 'Show category'),
    bool('showComparePrice', 'Show original price'),
    bool('showDiscountBadge', 'Show discount badge'),
    bool('showStock', 'Show stock'),
    bool('showAddToCart', 'Show Add to cart'),
    bool('showSku', 'Show SKU'),
    bool('showResultCount', 'Show "Showing X of Y"'),
    bool('showPagination', 'Show page numbers'),
  ],
  component: ProductGridBlock,
});

// 3. Product page.
blockRegistry.register({
  blockType: 'ecommerce.product-breadcrumbs',
  defaultLabel: 'Catalog Breadcrumb Bar',
  pageType: 'product',
  requiredByDefault: false,
  status: 'planned',
  defaultSettings: { showCategoryPath: true, showBackToShopLink: true },
  fieldSpecs: [bool('showCategoryPath', 'Show category in breadcrumb'), bool('showBackToShopLink', 'Show back to shop link')],
  component: PlannedMilestoneBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.product-detail',
  defaultLabel: 'Product Details',
  pageType: 'product',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    galleryPosition: 'left',
    showBreadcrumbs: true,
    showVariantPicker: true,
    showQuantitySelector: true,
    showStockStatus: true,
    showSku: true,
    showTaxHint: true,
    addToCartLabel: 'Add to cart',
    showBuyNow: true,
    buyNowLabel: 'Buy now',
    showPerks: true,
    returnsText: 'Easy returns and exchanges',
    showDescriptionTab: true,
  },
  fieldSpecs: [
    select('galleryPosition', 'Pictures', [['left', 'On the left'], ['right', 'On the right']]),
    bool('showBreadcrumbs', 'Show breadcrumbs'),
    bool('showVariantPicker', 'Show size / colour choice'),
    bool('showQuantitySelector', 'Show quantity'),
    bool('showStockStatus', 'Show stock'),
    bool('showSku', 'Show SKU'),
    bool('showTaxHint', 'Show "taxes at checkout" note'),
    str('addToCartLabel', 'Add to cart button text'),
    bool('showBuyNow', 'Show Buy now'),
    str('buyNowLabel', 'Buy now button text', undefined, when('showBuyNow', true)),
    bool('showPerks', 'Show delivery & returns perks'),
    str('returnsText', 'Returns perk text', undefined, when('showPerks', true)),
    bool('showDescriptionTab', 'Show description & shipping tabs'),
  ],
  component: ProductDetailBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.related-products',
  defaultLabel: 'Related Products',
  pageType: 'product',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    sectionTitle: 'You may also like',
    description: '',
    maxItems: 4,
    columnsDesktop: 4,
    matchStrategy: 'same_category',
    showViewAll: true,
    showAddToCart: true,
  },
  fieldSpecs: [
    str('sectionTitle', 'Heading'),
    str('description', 'Text under the heading (optional)'),
    numberField('maxItems', 'How many products', 2, 12),
    select('columnsDesktop', 'Columns on wide screens', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]),
    select('matchStrategy', 'Which products', [['same_category', 'Same category'], ['newest', 'Newest']]),
    bool('showViewAll', 'Show "View all" link'),
    bool('showAddToCart', 'Show Add to cart'),
  ],
  component: RelatedProductsBlock,
});

// 4. Cart page: separate pieces (older pages) and the combined cart.
blockRegistry.register({
  blockType: 'ecommerce.cart-items',
  defaultLabel: 'Cart Items',
  pageType: 'cart',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    showThumbnails: true,
    showVariantDetails: true,
    allowQuantityAdjust: true,
    showStockLimitWarning: true,
    deliveryNote: 'Delivered in 3–7 business days',
    emptyCartMessage: 'Your cart is currently empty.',
  },
  fieldSpecs: [
    bool('showThumbnails', 'Show pictures'),
    bool('showVariantDetails', 'Show size / colour'),
    bool('allowQuantityAdjust', 'Allow quantity changes'),
    bool('showStockLimitWarning', 'Warn when stock runs short'),
    str('deliveryNote', 'Delivery note under each item', 'Leave empty to hide.'),
    str('emptyCartMessage', 'Empty cart message'),
  ],
  component: CartItemsBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.cart-coupon',
  defaultLabel: 'Coupon Box',
  pageType: 'cart',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: { inputPlaceholder: 'Enter coupon code', showAppliedRuleBadges: true },
  fieldSpecs: [str('inputPlaceholder', 'Placeholder'), bool('showAppliedRuleBadges', 'Show applied coupon')],
  component: CartCouponBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.cart-summary',
  defaultLabel: 'Cart Totals',
  pageType: 'cart',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    showDiscountBreakdown: true,
    showTaxBreakdown: true,
    showShippingEstimate: true,
    proceedButtonText: 'Proceed to Checkout',
    continueShoppingPath: '/shop',
  },
  fieldSpecs: [
    bool('showDiscountBreakdown', 'Show discount'),
    bool('showTaxBreakdown', 'Show tax'),
    bool('showShippingEstimate', 'Show shipping'),
    str('proceedButtonText', 'Checkout button text'),
    str('continueShoppingPath', 'Continue shopping link'),
  ],
  component: CartSummaryBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.cart',
  defaultLabel: 'Cart (Items & Order Summary)',
  pageType: 'cart',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    heading: 'Your shopping cart',
    emptyCartMessage: 'Your cart is empty.',
    showThumbnails: true,
    showVariantDetails: true,
    allowQuantityAdjust: true,
    deliveryNote: 'Delivered in 3–7 business days',
    showFreeShippingProgress: true,
    showCoupon: true,
    inputPlaceholder: 'Enter code',
    proceedButtonText: 'Proceed to checkout',
    showTrustCard: true,
    trustText: 'Your details are only used to deliver your order. Pay when it arrives.',
    showContinueShopping: true,
  },
  fieldSpecs: [
    str('heading', 'Heading', 'Leave empty to hide.'),
    str('emptyCartMessage', 'Empty cart message'),
    bool('showThumbnails', 'Show pictures'),
    bool('showVariantDetails', 'Show size / colour'),
    bool('allowQuantityAdjust', 'Allow quantity changes'),
    str('deliveryNote', 'Delivery note under each item', 'Leave empty to hide.'),
    bool('showFreeShippingProgress', 'Show free-shipping progress'),
    bool('showCoupon', 'Show coupon box'),
    str('inputPlaceholder', 'Coupon placeholder', undefined, when('showCoupon', true)),
    str('proceedButtonText', 'Checkout button text'),
    bool('showTrustCard', 'Show "Secure checkout" card'),
    str('trustText', 'Secure checkout text', undefined, when('showTrustCard', true)),
    bool('showContinueShopping', 'Show "Continue shopping" button'),
  ],
  component: CartPageBlock,
});

// 5. Checkout page: separate pieces (older pages) and the combined checkout.
blockRegistry.register({
  blockType: 'ecommerce.checkout-form',
  defaultLabel: 'Checkout Form',
  pageType: 'checkout',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    requirePhone: true,
    enableOrderNotes: true,
    showFulfillmentLocationSelector: true,
    checkoutNotice: 'Final taxes, shipping rates, and inventory availability are verified on submission.',
  },
  fieldSpecs: [
    bool('requirePhone', 'Require phone number'),
    bool('enableOrderNotes', 'Show delivery notes'),
    bool('showFulfillmentLocationSelector', 'Show warehouse choice (when enabled in Settings)'),
    str('checkoutNotice', 'Note under the form'),
  ],
  component: CheckoutFormBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.checkout-summary',
  defaultLabel: 'Checkout Order Summary',
  pageType: 'checkout',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    showLineItemsList: true,
    showCouponCodeSummary: true,
    showCoupon: false,
    showTaxBreakdown: true,
    showShippingRow: true,
    showPerks: true,
    submitButtonLabel: 'Place Order',
  },
  fieldSpecs: [
    bool('showLineItemsList', 'Show items'),
    bool('showCoupon', 'Show coupon box'),
    bool('showTaxBreakdown', 'Show tax'),
    bool('showShippingRow', 'Show shipping'),
    bool('showPerks', 'Show reassurance lines'),
    str('submitButtonLabel', 'Place order button text'),
  ],
  component: CheckoutSummaryBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.checkout',
  defaultLabel: 'Checkout (Steps & Order Summary)',
  pageType: 'checkout',
  requiredByDefault: true,
  status: 'implemented',
  defaultSettings: {
    checkoutLayout: 'steps',
    heading: 'Secure checkout',
    subheading: 'Complete your order in a few steps.',
    showProgress: true,
    requirePhone: true,
    enableOrderNotes: true,
    showLineItemsList: true,
    showCoupon: true,
    inputPlaceholder: 'Enter code',
    showPerks: true,
    submitButtonLabel: 'Place order',
    checkoutNotice: 'Final taxes, shipping and stock are confirmed when you place the order.',
    thankYouHeading: 'Thank you for your order',
    orderStatusLink: '',
  },
  fieldSpecs: [
    select('checkoutLayout', 'Layout', [['steps', 'Steps (contact → delivery → payment)'], ['single', 'Everything on one page']]),
    str('heading', 'Heading', 'Leave empty to hide.'),
    str('subheading', 'Text under the heading'),
    bool('showProgress', 'Show step progress', when('checkoutLayout', 'steps')),
    bool('requirePhone', 'Require phone number'),
    bool('enableOrderNotes', 'Show delivery notes'),
    bool('showLineItemsList', 'Show items in the summary'),
    bool('showCoupon', 'Show coupon box'),
    bool('showPerks', 'Show reassurance lines'),
    str('submitButtonLabel', 'Place order button text'),
    str('checkoutNotice', 'Note before Place order'),
    str('thankYouHeading', 'Thank-you heading'),
    str('orderStatusLink', 'Order status page', 'Address of a page with the Order lookup block, e.g. /track-order. Adds a "Check order status" button after ordering.'),
  ],
  component: CheckoutPageBlock,
});

// 6. Banners and sections usable on any page.
blockRegistry.register({
  blockType: 'ecommerce.store-header',
  defaultLabel: 'Store Header & Navigation (older pages)',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: { showAnnouncement: true, announcement: '', showCategoryLinks: true, showSearch: true },
  fieldSpecs: [
    bool('showAnnouncement', 'Show announcement bar'),
    str('announcement', 'Announcement text', 'Blank = shipping & Cash on Delivery message.'),
    bool('showCategoryLinks', 'Show category links'),
    bool('showSearch', 'Show search'),
  ],
  component: StoreHeaderBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.shop-hero',
  defaultLabel: 'Hero Banner',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    eyebrow: 'New season',
    heading: 'Everyday essentials, made well',
    subheading: 'Browse the full collection. Cash on Delivery available across India.',
    buttonLabel: 'Shop all products',
    buttonLink: '#catalog',
    secondaryButtonLabel: '',
    secondaryButtonLink: '/cart',
    style: 'plain',
    imageSource: 'products',
    imageUrl: '',
    imagePosition: 'right',
    showHighlights: true,
    highlights: '',
  },
  fieldSpecs: [
    str('eyebrow', 'Small label above the heading', 'Leave empty to hide.'),
    str('heading', 'Heading'),
    long('subheading', 'Text'),
    str('buttonLabel', 'Main button text', 'Leave empty to hide.'),
    str('buttonLink', 'Main button link', LINK_HINT),
    str('secondaryButtonLabel', 'Second button text', 'Leave empty to hide.'),
    str('secondaryButtonLink', 'Second button link', LINK_HINT),
    select('style', 'Background', [['plain', 'None'], ['soft', 'Soft grey'], ['dark', 'Dark'], ['accent', 'Colourful']]),
    select('imageSource', 'Picture', [['products', 'Newest product photos (collage)'], ['product', 'Newest product photo'], ['custom', 'My own picture'], ['none', 'No picture']]),
    str('imageUrl', 'Picture address (URL)', undefined, when('imageSource', 'custom')),
    select('imagePosition', 'Picture position', [['right', 'Right'], ['left', 'Left']], undefined, when('imageSource', 'products', 'product', 'custom')),
    bool('showHighlights', 'Show highlights row'),
    str('highlights', 'Highlights', 'Comma-separated, e.g. Cash on Delivery, Free shipping, Easy returns. Blank = automatic.', when('showHighlights', true)),
  ],
  component: ShopHeroBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.category-showcase',
  defaultLabel: 'Shop by Category',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    heading: 'Shop by category',
    subheading: 'Discover products across our most popular categories',
    align: 'center',
    maxItems: 4,
    columns: 3,
    tileButtonLabel: 'Browse',
    showViewAll: true,
    viewAllLabel: 'View all products',
  },
  fieldSpecs: [
    str('heading', 'Heading'),
    str('subheading', 'Text under the heading'),
    select('align', 'Heading alignment', [['center', 'Centre'], ['left', 'Left']]),
    numberField('maxItems', 'How many categories', 2, 8),
    select('columns', 'Columns on wide screens', [[2, '2'], [3, '3'], [4, '4']]),
    str('tileButtonLabel', 'Tile button text'),
    bool('showViewAll', 'Show "View all" button'),
    str('viewAllLabel', '"View all" button text', undefined, when('showViewAll', true)),
  ],
  component: CategoryShowcaseBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.trust-badges',
  defaultLabel: 'Store Features',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    layout: 'strip',
    eyebrow: 'Why choose us',
    heading: '',
    subheading: '',
    showShipping: true,
    shippingTitle: '',
    shippingText: 'Delivered to your door across India.',
    showCod: true,
    codTitle: '',
    codText: 'Pay in cash or UPI when your order arrives.',
    showReturns: true,
    returnsText: 'Easy 7-day returns',
    returnsDetail: 'Hassle-free returns and exchanges.',
    showSecure: true,
    secureTitle: '',
    secureText: 'Your details stay private and are only used for your order.',
    showSupport: false,
    supportTitle: '',
    supportText: '',
    imageUrl: '',
    buttonLabel: '',
    buttonLink: '/shop',
  },
  fieldSpecs: [
    select('layout', 'Layout', [['strip', 'Compact strip'], ['cards', 'Cards with heading'], ['split', 'Text with a picture']]),
    str('eyebrow', 'Small label above the heading', undefined, when('layout', 'cards', 'split')),
    str('heading', 'Heading', 'Blank = "Why shop with us" (cards and picture layouts).'),
    long('subheading', 'Text under the heading'),
    bool('showShipping', 'Show shipping'),
    str('shippingTitle', 'Shipping title', 'Blank = free-shipping amount from Settings.', when('showShipping', true)),
    str('shippingText', 'Shipping text', undefined, when('showShipping', true)),
    bool('showCod', 'Show Cash on Delivery'),
    str('codTitle', 'Cash on Delivery title', undefined, when('showCod', true)),
    str('codText', 'Cash on Delivery text', undefined, when('showCod', true)),
    bool('showReturns', 'Show returns'),
    str('returnsText', 'Returns title', undefined, when('showReturns', true)),
    str('returnsDetail', 'Returns text', undefined, when('showReturns', true)),
    bool('showSecure', 'Show secure checkout'),
    str('secureTitle', 'Secure checkout title', undefined, when('showSecure', true)),
    str('secureText', 'Secure checkout text', undefined, when('showSecure', true)),
    bool('showSupport', 'Show customer support'),
    str('supportTitle', 'Support title', undefined, when('showSupport', true)),
    str('supportText', 'Support text', 'Blank = your contact details from Settings.', when('showSupport', true)),
    str('imageUrl', 'Picture address (URL)', 'Blank = your newest product photo.', when('layout', 'split')),
    str('buttonLabel', 'Button text', 'Leave empty to hide.', when('layout', 'cards', 'split')),
    str('buttonLink', 'Button link', LINK_HINT, when('layout', 'cards', 'split')),
  ],
  component: TrustBadgesBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.store-footer',
  defaultLabel: 'Store Footer (older pages)',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: { aboutText: 'Quality products, honest prices, delivered to your door.', showContact: true },
  fieldSpecs: [long('aboutText', 'About text'), bool('showContact', 'Show contact details')],
  component: StoreFooterBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.order-lookup',
  defaultLabel: 'Order Lookup',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: {
    heading: 'Track your order',
    description: 'Enter your order number and the email you used at checkout to see its status.',
    buttonLabel: 'Find my order',
    showItems: true,
    showContinueShopping: true,
  },
  fieldSpecs: [
    str('heading', 'Heading'),
    long('description', 'Text'),
    str('buttonLabel', 'Button text'),
    bool('showItems', 'Show the items in the order'),
    bool('showContinueShopping', 'Show "Continue shopping"'),
  ],
  component: OrderLookupBlock,
});

// 7. Pieces for OpenExt's own site header.
const align = (fallback: string) => select('align', 'Alignment', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], `Default: ${fallback}`);

blockRegistry.register({
  blockType: 'ecommerce.cart-button',
  defaultLabel: 'Cart Button & Mini Cart',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: { label: 'Cart', showLabel: true, showCount: true, align: 'right' },
  fieldSpecs: [str('label', 'Button text'), bool('showLabel', 'Show text'), bool('showCount', 'Show item count'), align('right')],
  component: CartButtonBlock,
});

blockRegistry.register({
  blockType: 'ecommerce.product-search',
  defaultLabel: 'Product Search Box',
  requiredByDefault: false,
  status: 'implemented',
  defaultSettings: { placeholder: 'Search products', align: 'center' },
  fieldSpecs: [str('placeholder', 'Placeholder'), align('centre')],
  component: ProductSearchBlock,
});
