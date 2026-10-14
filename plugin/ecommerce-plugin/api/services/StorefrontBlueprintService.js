"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorefrontBlueprintService = exports.STOREFRONT_PAGE_TYPES = void 0;
const StorefrontPage_1 = __importDefault(require("../models/StorefrontPage"));
const crypto = require('crypto');
exports.STOREFRONT_PAGE_TYPES = [
    'shop',
    'product',
    'cart',
    'checkout',
];
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
const BASE_BLUEPRINTS = {
    shop: {
        blueprintId: 'ecommerce-shop-blueprint',
        pageType: 'shop',
        version: 1,
        slug: 'shop',
        title: 'Shop Catalog',
        description: 'Main customer catalog page displaying live published products, category filters, search, and sorting.',
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
        description: 'Reusable dynamic template for all published products. Resolves live product data by slug or ID at request time.',
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
        description: 'Customer cart page displaying selected items, coupon entry, and live backend-calculated subtotal, discounts, taxes, and shipping estimates.',
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
        description: 'Order completion page structure with customer contact/shipping address inputs and final backend-verified order summary.',
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
                    checkoutNotice: 'Final taxes, shipping rates, and inventory availability are verified on submission.',
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
// Optional runtime overrides used by controlled blueprint upgrade tests
const blueprintOverrides = new Map();
function cloneDeep(val) {
    return JSON.parse(JSON.stringify(val));
}
function stableNormalizeSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }
    const sortedKeys = Object.keys(settings).sort();
    const normalized = {};
    for (const key of sortedKeys) {
        const val = settings[key];
        if (val !== undefined) {
            normalized[key] = val;
        }
    }
    return normalized;
}
class StorefrontBlueprintService {
    static isValidPageType(pageType) {
        return (typeof pageType === 'string' &&
            exports.STOREFRONT_PAGE_TYPES.includes(pageType));
    }
    static getBlueprint(pageType) {
        const override = blueprintOverrides.get(pageType);
        if (override) {
            return cloneDeep(override);
        }
        return cloneDeep(BASE_BLUEPRINTS[pageType]);
    }
    static getAllBlueprints() {
        return exports.STOREFRONT_PAGE_TYPES.map((pt) => this.getBlueprint(pt));
    }
    /**
     * Used by tests or future blueprint migrations to register a newer blueprint version definition.
     */
    static setBlueprintOverrideForTesting(pageType, definition) {
        if (!definition) {
            blueprintOverrides.delete(pageType);
        }
        else {
            blueprintOverrides.set(pageType, cloneDeep(definition));
        }
    }
    static computeBlocksHash(blocks) {
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
    static assertNoEmbeddedCommerceEntities(obj, path = 'settings') {
        if (obj === null || obj === undefined)
            return null;
        if (typeof obj !== 'object')
            return null;
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
                if (nestedErr)
                    return nestedErr;
            }
        }
        return null;
    }
    static validateAndNormalizeBlocks(pageType, inputBlocks) {
        if (!Array.isArray(inputBlocks) || inputBlocks.length === 0) {
            return {
                valid: false,
                error: 'Page configuration must contain a non-empty ordered blocks array.',
            };
        }
        const blueprint = this.getBlueprint(pageType);
        const blueprintById = new Map();
        const blueprintByBlockType = new Map();
        for (const bpBlock of blueprint.blocks) {
            blueprintById.set(bpBlock.id, bpBlock);
            blueprintByBlockType.set(bpBlock.blockType, bpBlock);
        }
        const seenIds = new Set();
        const seenUniqueIds = new Set();
        const normalizedBlocks = [];
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
            const uniqueId = typeof raw.uniqueId === 'string' && raw.uniqueId.trim().length > 0
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
            const forbiddenError = this.assertNoEmbeddedCommerceEntities(rawSettings, `${bpBlock.id}.settings`);
            if (forbiddenError) {
                return { valid: false, error: forbiddenError };
            }
            // Merge and sanitize settings against fieldSpecs + blueprint defaults
            const specs = blueprint.fieldSpecs[bpBlock.blockType] || [];
            const specByKey = new Map();
            for (const spec of specs) {
                specByKey.set(spec.key, spec);
            }
            const mergedSettings = {
                ...cloneDeep(bpBlock.settings),
            };
            for (const [k, v] of Object.entries(rawSettings)) {
                const spec = specByKey.get(k);
                if (!spec) {
                    // Reject unknown arbitrary keys so blocks stay strictly configuration-driven
                    if (!(k in bpBlock.settings)) {
                        return {
                            valid: false,
                            error: `Unsupported setting "${k}" on block "${bpBlock.id}".`,
                        };
                    }
                }
                if (spec) {
                    if (spec.type === 'boolean') {
                        mergedSettings[k] = Boolean(v);
                    }
                    else if (spec.type === 'number') {
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
                    }
                    else if (spec.type === 'string') {
                        mergedSettings[k] = String(v ?? '')
                            .trim()
                            .slice(0, 240);
                    }
                    else if (spec.type === 'select') {
                        const allowedValues = (spec.options || []).map((o) => o.value);
                        const normalizedVal = typeof allowedValues[0] === 'number' ? Number(v) : String(v ?? '');
                        if (allowedValues.length > 0 && !allowedValues.includes(normalizedVal)) {
                            return {
                                valid: false,
                                error: `Invalid option "${String(v)}" for setting "${spec.label}" on block "${bpBlock.label}".`,
                            };
                        }
                        mergedSettings[k] = normalizedVal;
                    }
                }
                else {
                    mergedSettings[k] = v;
                }
            }
            normalizedBlocks.push({
                id: bpBlock.id,
                uniqueId,
                type: 'ecommerce-plugin',
                blockType: bpBlock.blockType,
                label: typeof raw.label === 'string' && raw.label.trim().length > 0
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
    static toCmsPageComponents(pageType, blocks) {
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
    static getCmsLocaleForTenant(tenantId) {
        return tenantId === 'default_tenant' ? 'en' : `en__${tenantId}`;
    }
    /**
     * Synchronize the StorefrontPage record with OpenExt's canonical Page collection.
     * Also detects if the merchant edited the page's component array directly through OpenExt's Page Editor.
     */
    static async syncWithCmsPage(tenantId, storefrontDoc, blueprint, forceOverwriteCmsPage = false) {
        const CmsPageModel = await StorefrontPage_1.default.getCmsPageModel();
        if (!CmsPageModel) {
            return storefrontDoc;
        }
        const locale = this.getCmsLocaleForTenant(tenantId);
        let cmsPage = null;
        if (storefrontDoc.cmsPageId) {
            try {
                cmsPage = await CmsPageModel.findById(storefrontDoc.cmsPageId);
            }
            catch {
                cmsPage = null;
            }
        }
        if (!cmsPage) {
            cmsPage = await CmsPageModel.findOne({
                slug: storefrontDoc.slug,
                locale,
                pageType: 'page',
            });
        }
        if (!cmsPage) {
            cmsPage = await CmsPageModel.create({
                pageName: storefrontDoc.title,
                pageType: 'page',
                isPublished: Boolean(storefrontDoc.isPublished),
                isHome: false,
                isGlobal: false,
                preHeading: blueprint.blueprintId,
                description: storefrontDoc.description,
                slug: storefrontDoc.slug,
                locale,
                translationGroupId: `${tenantId}:${blueprint.blueprintId}`,
                seoName: storefrontDoc.title,
                seoMeta: storefrontDoc.description,
                component: this.toCmsPageComponents(storefrontDoc.pageType, storefrontDoc.blocks),
                modifications: [],
            });
            storefrontDoc.cmsPageId = String(cmsPage._id);
            await storefrontDoc.save();
            return storefrontDoc;
        }
        // If not forcing overwrite from Storefront Admin, check if the merchant edited `cmsPage.component` via OpenExt Page Editor
        if (!forceOverwriteCmsPage && Array.isArray(cmsPage.component) && cmsPage.component.length > 0) {
            const validation = this.validateAndNormalizeBlocks(storefrontDoc.pageType, cmsPage.component);
            if (validation.valid && validation.blocks) {
                const cmsBlocksHash = this.computeBlocksHash(validation.blocks);
                if (cmsBlocksHash !== storefrontDoc.currentConfigHash) {
                    storefrontDoc.blocks = validation.blocks;
                    storefrontDoc.currentConfigHash = cmsBlocksHash;
                    storefrontDoc.isCustomized = cmsBlocksHash !== storefrontDoc.appliedBlueprintHash;
                    storefrontDoc.lastCustomizedAt = storefrontDoc.isCustomized
                        ? new Date()
                        : storefrontDoc.lastCustomizedAt;
                    storefrontDoc.revision = (Number(storefrontDoc.revision) || 1) + 1;
                    await storefrontDoc.save();
                }
            }
        }
        // Ensure CMS Page stays aligned with StorefrontPage state
        const expectedComponents = this.toCmsPageComponents(storefrontDoc.pageType, storefrontDoc.blocks);
        const currentCmsComponentsJson = JSON.stringify(cmsPage.component || []);
        const expectedCmsComponentsJson = JSON.stringify(expectedComponents);
        let cmsNeedsSave = false;
        if (String(storefrontDoc.cmsPageId || '') !== String(cmsPage._id)) {
            storefrontDoc.cmsPageId = String(cmsPage._id);
            await storefrontDoc.save();
        }
        if (cmsPage.pageName !== storefrontDoc.title) {
            cmsPage.pageName = storefrontDoc.title;
            cmsNeedsSave = true;
        }
        if (cmsPage.description !== storefrontDoc.description) {
            cmsPage.description = storefrontDoc.description;
            cmsNeedsSave = true;
        }
        if (Boolean(cmsPage.isPublished) !== Boolean(storefrontDoc.isPublished)) {
            cmsPage.isPublished = Boolean(storefrontDoc.isPublished);
            cmsNeedsSave = true;
        }
        if (currentCmsComponentsJson !== expectedCmsComponentsJson) {
            cmsPage.component = expectedComponents;
            cmsPage.markModified('component');
            cmsNeedsSave = true;
        }
        if (cmsNeedsSave) {
            await cmsPage.save();
        }
        return storefrontDoc;
    }
    /**
     * Idempotently provisions all 4 default storefront pages for a tenant and handles safe blueprint version upgrades.
     */
    static async ensureProvisionedForTenant(tenantId) {
        const results = [];
        for (const pageType of exports.STOREFRONT_PAGE_TYPES) {
            const dto = await this.ensurePageProvisioned(tenantId, pageType);
            results.push(dto);
        }
        return results;
    }
    static async ensurePageProvisioned(tenantId, pageType) {
        const StorefrontPageModel = StorefrontPage_1.default.getModel();
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
            }
            catch (err) {
                // Handle concurrent provisioning race gracefully
                if (err && err.code === 11000) {
                    doc = await StorefrontPageModel.findOne({ tenantId, pageType });
                }
                else {
                    throw err;
                }
            }
        }
        // Sync any external edits made via OpenExt Page Editor first
        doc = await this.syncWithCmsPage(tenantId, doc, blueprint, false);
        // Check if blueprint definition has a newer version than what was applied
        if (doc.appliedBlueprintVersion < blueprint.version) {
            const wasUntouchedDefault = !doc.isCustomized && doc.currentConfigHash === doc.appliedBlueprintHash;
            if (wasUntouchedDefault) {
                // Safe automatic upgrade for untouched default pages
                doc.blocks = cloneDeep(blueprint.blocks);
                doc.appliedBlueprintVersion = blueprint.version;
                doc.appliedBlueprintHash = blueprintHash;
                doc.currentConfigHash = blueprintHash;
                doc.isCustomized = false;
                doc.routePattern = blueprint.routePattern;
                doc.isDynamicTemplate = blueprint.isDynamicTemplate;
                doc.revision = (Number(doc.revision) || 1) + 1;
                await doc.save();
                doc = await this.syncWithCmsPage(tenantId, doc, blueprint, true);
            }
            // If doc.isCustomized is true, we intentionally preserve the merchant's blocks, settings, and appliedBlueprintVersion!
        }
        return this.toDTO(doc, blueprint);
    }
    static async updatePageConfiguration(tenantId, pageType, payload) {
        await this.ensurePageProvisioned(tenantId, pageType);
        const StorefrontPageModel = StorefrontPage_1.default.getModel();
        const blueprint = this.getBlueprint(pageType);
        const doc = await StorefrontPageModel.findOne({ tenantId, pageType });
        if (!doc) {
            return {
                success: false,
                status: 404,
                error: `Storefront page "${pageType}" not found.`,
            };
        }
        if (payload.expectedRevision !== undefined &&
            Number(payload.expectedRevision) !== Number(doc.revision)) {
            return {
                success: false,
                status: 409,
                error: 'Page configuration was modified in another session. Please refresh to load the latest revision before saving.',
            };
        }
        let nextBlocks = doc.blocks;
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
        const nextTitle = typeof payload.title === 'string' && payload.title.trim().length > 0
            ? payload.title.trim().slice(0, 120)
            : doc.title;
        const nextDescription = typeof payload.description === 'string'
            ? payload.description.trim().slice(0, 400)
            : doc.description;
        const nextPublished = payload.isPublished !== undefined ? Boolean(payload.isPublished) : Boolean(doc.isPublished);
        const nextHash = this.computeBlocksHash(nextBlocks);
        const hasTitleOrDescCustomization = nextTitle !== blueprint.title || nextDescription !== blueprint.description;
        const isCustomized = nextHash !== doc.appliedBlueprintHash || hasTitleOrDescCustomization;
        doc.title = nextTitle;
        doc.description = nextDescription;
        doc.isPublished = nextPublished;
        doc.blocks = nextBlocks;
        doc.currentConfigHash = nextHash;
        doc.isCustomized = isCustomized;
        if (isCustomized) {
            doc.lastCustomizedAt = new Date();
        }
        doc.revision = (Number(doc.revision) || 1) + 1;
        await doc.save();
        await this.syncWithCmsPage(tenantId, doc, blueprint, true);
        return {
            success: true,
            status: 200,
            page: this.toDTO(doc, blueprint),
        };
    }
    static async resetPageToDefault(tenantId, pageType, confirmReset) {
        if (confirmReset !== true) {
            return {
                success: false,
                status: 400,
                error: 'Explicit confirmation (confirmReset: true) is required to reset a storefront page to its default blueprint.',
            };
        }
        await this.ensurePageProvisioned(tenantId, pageType);
        const StorefrontPageModel = StorefrontPage_1.default.getModel();
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
        doc.currentConfigHash = blueprintHash;
        doc.isCustomized = false;
        doc.lastResetAt = new Date();
        doc.blocks = cloneDeep(blueprint.blocks);
        doc.revision = (Number(doc.revision) || 1) + 1;
        await doc.save();
        await this.syncWithCmsPage(tenantId, doc, blueprint, true);
        return {
            success: true,
            status: 200,
            page: this.toDTO(doc, blueprint),
        };
    }
    static toDTO(doc, blueprint) {
        const pageType = doc.pageType;
        const bp = blueprint || this.getBlueprint(pageType);
        const appliedVersion = Number(doc.appliedBlueprintVersion) || 1;
        const latestVersion = Number(bp.version) || 1;
        const isCustomized = Boolean(doc.isCustomized);
        const blocks = (Array.isArray(doc.blocks) ? doc.blocks : []).map((b) => ({
            id: String(b.id || ''),
            uniqueId: String(b.uniqueId || ''),
            type: 'ecommerce-plugin',
            blockType: String(b.blockType || ''),
            label: String(b.label || ''),
            required: Boolean(b.required),
            enabled: Boolean(b.enabled),
            settings: stableNormalizeSettings(b.settings),
        }));
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
    static toPublicPageDTO(dto) {
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
    static async getPageStatsForTenant(tenantId) {
        const StorefrontPageModel = StorefrontPage_1.default.getModel();
        const [provisionedPages, publishedPages, customizedPages] = await Promise.all([
            StorefrontPageModel.countDocuments({ tenantId }),
            StorefrontPageModel.countDocuments({ tenantId, isPublished: true }),
            StorefrontPageModel.countDocuments({ tenantId, isCustomized: true }),
        ]);
        return {
            totalBlueprints: exports.STOREFRONT_PAGE_TYPES.length,
            provisionedPages,
            publishedPages,
            customizedPages,
        };
    }
    /**
     * Read-only public page resolver. Performs ZERO database writes.
     * Enforces published-only visibility.
     */
    static async getPublicPageReadOnly(tenantId, pageType) {
        const StorefrontPageModel = StorefrontPage_1.default.getModel();
        const doc = await StorefrontPageModel.findOne({ tenantId, pageType }).lean();
        if (doc) {
            if (!doc.isPublished)
                return null;
            const bp = this.getBlueprint(pageType);
            const fullDto = this.toDTO(doc, bp);
            return this.toPublicPageDTO(fullDto);
        }
        // If page document not yet created, check if blueprint is defaultPublished
        const blueprint = this.getBlueprint(pageType);
        if (!blueprint.defaultPublished)
            return null;
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
            blocks: cloneDeep(blueprint.blocks).filter((b) => b.enabled),
        };
    }
}
exports.StorefrontBlueprintService = StorefrontBlueprintService;
