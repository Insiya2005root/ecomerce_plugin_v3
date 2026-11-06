"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const Category_1 = __importDefault(require("../models/Category"));
const Settings_1 = __importDefault(require("../models/Settings"));
const DiscountEngine_1 = require("../services/DiscountEngine");
const StorefrontBlueprintService_1 = require("../services/StorefrontBlueprintService");
function resolveTenantId(req) {
    // Check trusted server-assigned tenant context only.
    // Never trust client-controlled headers (x-tenant-id), query params, or body fields.
    if (typeof req?.tenantId === 'string' && req.tenantId.trim().length > 0) {
        return req.tenantId.trim();
    }
    if (typeof req?.tenant === 'string' && req.tenant.trim().length > 0) {
        return req.tenant.trim();
    }
    if (typeof req?.tenant?.id === 'string' && req.tenant.id.trim().length > 0) {
        return req.tenant.id.trim();
    }
    if (typeof req?.tenant?._id === 'string' && req.tenant._id.trim().length > 0) {
        return req.tenant._id.trim();
    }
    if (typeof req?.cms?.tenantId === 'string' && req.cms.tenantId.trim().length > 0) {
        return req.cms.tenantId.trim();
    }
    if (typeof req?.cms?.tenant?.id === 'string' && req.cms.tenant.id.trim().length > 0) {
        return req.cms.tenant.id.trim();
    }
    if (typeof req?.cms?.tenant?._id === 'string' && req.cms.tenant._id.trim().length > 0) {
        return req.cms.tenant._id.trim();
    }
    if (typeof req?.user?.tenantId === 'string' && req.user.tenantId.trim().length > 0) {
        return req.user.tenantId.trim();
    }
    if (typeof req?.storeId === 'string' && req.storeId.trim().length > 0) {
        return req.storeId.trim();
    }
    if (typeof req?.siteId === 'string' && req.siteId.trim().length > 0) {
        return req.siteId.trim();
    }
    return 'default_tenant';
}
function ensureAdminAuthenticated(req, res) {
    if (!req?.user) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized',
        });
        return false;
    }
    return true;
}
function escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function toPublicCategoryDTO(cat) {
    return {
        id: String(cat._id),
        name: String(cat.name || ''),
        slug: String(cat.slug || ''),
        description: cat.description ? String(cat.description) : '',
        image: cat.image ? String(cat.image) : null,
        parentId: cat.parentId ? String(cat.parentId) : null,
    };
}
function toPublicProductDTO(prod, rawDiscountPercentage) {
    const { basePrice, catalogPrice, compareAtPrice, discountPercentage } = DiscountEngine_1.DiscountEngine.resolveCatalogProductPricing(prod, rawDiscountPercentage);
    const stock = Math.max(0, Number(prod.stock) || 0);
    const images = Array.isArray(prod.images) ? prod.images.filter(Boolean).map(String) : [];
    const primaryImage = prod.image ? String(prod.image) : images.length > 0 ? images[0] : null;
    const variants = Array.isArray(prod.variants)
        ? prod.variants.map((v) => {
            const vStock = Math.max(0, Number(v.stock) || 0);
            const hasOverride = v.priceOverride !== undefined && v.priceOverride !== null && v.priceOverride !== '';
            return {
                id: v._id ? String(v._id) : undefined,
                size: v.size ? String(v.size) : '',
                color: v.color ? String(v.color) : '',
                stock: vStock,
                inStock: vStock > 0,
                priceOverride: hasOverride ? Math.max(0, Number(v.priceOverride) || 0) : null,
            };
        })
        : [];
    return {
        id: String(prod._id),
        name: String(prod.name || ''),
        slug: String(prod.slug || ''),
        description: prod.description ? String(prod.description) : '',
        price: basePrice,
        catalogPrice,
        compareAtPrice,
        discountPercentage,
        sku: prod.sku ? String(prod.sku) : '',
        stock,
        inStock: stock > 0,
        image: primaryImage,
        images,
        videos: Array.isArray(prod.videos) ? prod.videos.filter(Boolean).map(String) : [],
        categoryId: prod.categoryId ? String(prod.categoryId) : null,
        isDigital: Boolean(prod.isDigital),
        tags: Array.isArray(prod.tags) ? prod.tags.filter(Boolean).map(String) : [],
        metaTitle: prod.metaTitle ? String(prod.metaTitle) : '',
        metaDescription: prod.metaDescription ? String(prod.metaDescription) : '',
        variants,
    };
}
function toPublicSettingsDTO(settings) {
    const store = settings?.store || {};
    return {
        storeName: store.name ? String(store.name) : '',
        supportEmail: store.email ? String(store.email) : '',
        supportPhone: store.phone ? String(store.phone) : '',
        currency: 'INR',
        currencySymbol: '₹',
        taxesEnabled: settings?.taxesEnabled !== undefined ? Boolean(settings.taxesEnabled) : true,
        pricesIncludeTax: Boolean(settings?.pricesIncludeTax),
        displayTaxBreakdown: settings?.displayTaxBreakdown !== undefined ? Boolean(settings.displayTaxBreakdown) : true,
        shippingMethod: settings?.shippingMethod === 'Distance' ? 'Distance' : 'Flat',
        freeShippingThreshold: Math.max(0, Number(settings?.freeShippingThreshold) || 0),
        // A fixed ship-from store (Settings → Shipping) means shoppers never pick a location.
        locationSelection: settings?.locationSelection === 'CustomerSelect' && !settings?.shipFromLocationId ? 'CustomerSelect' : 'Nearest',
    };
}
const registerStorefrontRoutes = (app) => {
    // 1. Lightweight Storefront Health & Readiness (Strictly Read-Only, ZERO Database Writes)
    app.get('/storefront/health', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const ProductModel = Product_1.default.getModel();
            const CategoryModel = Category_1.default.getModel();
            const SettingsModel = Settings_1.default.getModel();
            const [publishedProducts, activeCategories, settings, pageStats] = await Promise.all([
                ProductModel.countDocuments({ tenantId, status: 'Published' }),
                CategoryModel.countDocuments({
                    tenantId,
                    isActive: { $ne: false },
                    status: { $nin: ['Draft', 'Archived', 'Inactive'] },
                }),
                SettingsModel.findOne({ tenantId })
                    .select('taxesEnabled shippingMethod locationSelection')
                    .lean(),
                StorefrontBlueprintService_1.StorefrontBlueprintService.getPageStatsForTenant(tenantId),
            ]);
            return res.json({
                success: true,
                status: 'ready',
                catalog: {
                    publishedProducts,
                    activeCategories,
                },
                pages: {
                    totalBlueprints: pageStats.totalBlueprints,
                    provisionedPages: pageStats.provisionedPages,
                    publishedPages: pageStats.publishedPages,
                    customizedPages: pageStats.customizedPages,
                },
                configuration: {
                    taxesEnabled: settings && settings.taxesEnabled !== undefined
                        ? Boolean(settings.taxesEnabled)
                        : true,
                    shippingMethod: settings?.shippingMethod === 'Distance' ? 'Distance' : 'Flat',
                    locationSelection: settings?.locationSelection === 'CustomerSelect'
                        ? 'CustomerSelect'
                        : 'Nearest',
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to verify storefront readiness',
            });
        }
    });
    // 2. Public Storefront Settings (Whitelisted DTO)
    app.get('/storefront/settings', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const SettingsModel = Settings_1.default.getModel();
            const settings = await SettingsModel.findOne({ tenantId }).lean();
            return res.json({
                success: true,
                settings: toPublicSettingsDTO(settings),
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load storefront settings',
            });
        }
    });
    // 3. Public Categories List (Active/Customer-Visible Only)
    app.get('/storefront/categories', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const CategoryModel = Category_1.default.getModel();
            const categories = await CategoryModel.find({
                tenantId,
                isActive: { $ne: false },
                status: { $nin: ['Draft', 'Archived', 'Inactive'] },
            })
                .select('_id name slug description image parentId')
                .sort({ name: 1 })
                .lean();
            return res.json({
                success: true,
                categories: categories.map(toPublicCategoryDTO),
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load categories',
            });
        }
    });
    // 4. Public Products List (Published Only, Sanitized DTO, Bounded Pagination)
    app.get('/storefront/products', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const ProductModel = Product_1.default.getModel();
            const { search, categoryId, sort = 'newest', page = '1', limit = '12', ids, minPrice, maxPrice, } = req.query;
            const parsedPage = Math.max(1, parseInt(String(page || '1'), 10) || 1);
            const parsedLimit = Math.min(50, Math.max(1, parseInt(String(limit || '12'), 10) || 12));
            const skip = (parsedPage - 1) * parsedLimit;
            const query = {
                tenantId,
                status: 'Published',
            };
            const allowedSorts = ['newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc'];
            const rawSort = String(sort || 'newest').trim();
            const normalizedSort = allowedSorts.includes(rawSort) ? rawSort : 'newest';
            let validIds = [];
            if (ids && typeof ids === 'string') {
                validIds = ids
                    .split(',')
                    .map((id) => id.trim())
                    .filter((id) => mongoose_1.default.Types.ObjectId.isValid(id) && id.length === 24)
                    .slice(0, 50);
                if (validIds.length === 0) {
                    return res.json({
                        success: true,
                        products: [],
                        pagination: { total: 0, page: parsedPage, limit: parsedLimit, totalPages: 0 },
                    });
                }
                query._id = { $in: validIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) };
            }
            else {
                if (search && typeof search === 'string' && search.trim().length > 0) {
                    const safePattern = escapeRegex(search.trim().slice(0, 100));
                    query.$or = [
                        { name: { $regex: safePattern, $options: 'i' } },
                        { description: { $regex: safePattern, $options: 'i' } },
                        { sku: { $regex: safePattern, $options: 'i' } },
                    ];
                }
                if (categoryId && typeof categoryId === 'string' && categoryId.trim().length > 0) {
                    const trimmedCat = categoryId.trim();
                    if (!mongoose_1.default.Types.ObjectId.isValid(trimmedCat) || trimmedCat.length !== 24) {
                        return res.json({
                            success: true,
                            products: [],
                            pagination: { total: 0, page: parsedPage, limit: parsedLimit, totalPages: 0 },
                        });
                    }
                    // A category includes its sub-categories (Apparel shows products filed under Apparel › Shirts).
                    const CategoryModel = Category_1.default.getModel();
                    const ids = [trimmedCat];
                    for (let frontier = [trimmedCat], depth = 0; frontier.length && depth < 5; depth++) {
                        const children = await CategoryModel.find({ tenantId, parentId: { $in: frontier } }).select('_id').lean();
                        frontier = children.map((c) => String(c._id)).filter((id) => !ids.includes(id));
                        ids.push(...frontier);
                    }
                    query.categoryId = { $in: ids.map((id) => new mongoose_1.default.Types.ObjectId(id)) };
                }
            }
            // Price range from the shop filter, on the price shoppers actually see.
            const min = Number(minPrice);
            const max = Number(maxPrice);
            const priceBounds = [];
            if (minPrice !== undefined && minPrice !== '' && Number.isFinite(min) && min > 0)
                priceBounds.push({ $gte: [EFFECTIVE_PRICE, min] });
            if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(max) && max >= 0)
                priceBounds.push({ $lte: [EFFECTIVE_PRICE, max] });
            if (priceBounds.length)
                query.$expr = priceBounds.length === 1 ? priceBounds[0] : { $and: priceBounds };
            let products = [];
            let total = 0;
            // Price sorting must reflect actual customer-visible catalogPrice (factoring discounts)
            if (normalizedSort === 'price_asc' || normalizedSort === 'price_desc') {
                const sortDir = normalizedSort === 'price_asc' ? 1 : -1;
                const pipeline = [
                    { $match: query },
                    {
                        $addFields: {
                            effectiveCatalogPrice: EFFECTIVE_PRICE,
                        },
                    },
                    { $sort: { effectiveCatalogPrice: sortDir, _id: 1 } },
                    { $skip: skip },
                    { $limit: parsedLimit },
                    {
                        $project: {
                            costPrice: 0,
                            barcode: 0,
                            taxClassId: 0,
                            isTaxable: 0,
                            tenantId: 0,
                            __v: 0,
                        },
                    },
                ];
                [products, total] = await Promise.all([
                    ProductModel.aggregate(pipeline),
                    ProductModel.countDocuments(query),
                ]);
            }
            else {
                let sortSpec = { createdAt: -1, _id: 1 };
                if (normalizedSort === 'name_asc')
                    sortSpec = { name: 1, _id: 1 };
                else if (normalizedSort === 'name_desc')
                    sortSpec = { name: -1, _id: 1 };
                [products, total] = await Promise.all([
                    ProductModel.find(query)
                        .select('-costPrice -barcode -taxClassId -isTaxable -tenantId -__v')
                        .sort(sortSpec)
                        .skip(skip)
                        .limit(parsedLimit)
                        .lean(),
                    ProductModel.countDocuments(query),
                ]);
            }
            // Read raw discountPercentage for legacy documents if needed
            let rawMap = new Map();
            if (products.length > 0) {
                const productIds = products.map((p) => p._id);
                const rawDocs = await ProductModel.collection
                    .find({ _id: { $in: productIds }, tenantId, status: 'Published' }, { projection: { _id: 1, discountPercentage: 1 } })
                    .toArray();
                for (const r of rawDocs) {
                    if (r.discountPercentage !== undefined) {
                        rawMap.set(String(r._id), Number(r.discountPercentage) || 0);
                    }
                }
            }
            let publicProducts = products.map((p) => toPublicProductDTO(p, rawMap.get(String(p._id))));
            // Preserve explicitly configured selected product order when source was selected and no non-default sort requested
            // Prevent default 'newest' sort from silently overriding configured selected product order
            const isExplicitNonDefaultSort = Boolean(req.query.sort) &&
                ['price_asc', 'price_desc', 'name_asc', 'name_desc'].includes(String(req.query.sort));
            if (validIds.length > 0 && !isExplicitNonDefaultSort) {
                const orderMap = new Map();
                validIds.forEach((id, idx) => orderMap.set(id, idx));
                publicProducts.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
            }
            return res.json({
                success: true,
                products: publicProducts,
                pagination: {
                    total,
                    page: parsedPage,
                    limit: parsedLimit,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load products',
            });
        }
    });
    // 5. Public Product Detail by Slug or ID (Published Only, Safe 404)
    app.get('/storefront/products/:slugOrId', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const slugOrId = String(req.params.slugOrId || '').trim();
            if (!slugOrId) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
            const ProductModel = Product_1.default.getModel();
            const isObjectId = mongoose_1.default.Types.ObjectId.isValid(slugOrId) && slugOrId.length === 24;
            const lookupQuery = {
                tenantId,
                status: 'Published',
                ...(isObjectId
                    ? { $or: [{ slug: slugOrId }, { _id: new mongoose_1.default.Types.ObjectId(slugOrId) }] }
                    : { slug: slugOrId }),
            };
            const product = await ProductModel.findOne(lookupQuery)
                .select('-costPrice -barcode -taxClassId -isTaxable -tenantId -__v')
                .lean();
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found',
                });
            }
            const rawDoc = await ProductModel.collection.findOne({ _id: product._id, tenantId, status: 'Published' }, { projection: { discountPercentage: 1 } });
            const rawDiscount = rawDoc && rawDoc.discountPercentage !== undefined
                ? Number(rawDoc.discountPercentage) || 0
                : undefined;
            return res.json({
                success: true,
                product: toPublicProductDTO(product, rawDiscount),
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load product',
            });
        }
    });
    // 6. Public Storefront Page Blueprint & Configuration (Strictly Read-Only, Published Only)
    app.get('/storefront/pages/:pageType', async (req, res) => {
        try {
            const tenantId = resolveTenantId(req);
            const rawType = String(req.params.pageType || '').trim().toLowerCase();
            if (!StorefrontBlueprintService_1.StorefrontBlueprintService.isValidPageType(rawType)) {
                return res.status(404).json({
                    success: false,
                    message: 'Storefront page not found',
                });
            }
            const publicPage = await StorefrontBlueprintService_1.StorefrontBlueprintService.getPublicPageReadOnly(tenantId, rawType);
            if (!publicPage || !publicPage.isPublished) {
                return res.status(404).json({
                    success: false,
                    message: 'Storefront page is not currently published',
                });
            }
            return res.json({
                success: true,
                page: publicPage,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load storefront page configuration',
            });
        }
    });
    // 7. Admin: List & Ensure All 4 Storefront Pages + Blueprint Definitions (Protected)
    app.get('/storefront/admin/pages', async (req, res) => {
        if (!ensureAdminAuthenticated(req, res))
            return;
        try {
            const tenantId = resolveTenantId(req);
            const pages = await StorefrontBlueprintService_1.StorefrontBlueprintService.ensureProvisionedForTenant(tenantId);
            const blueprints = StorefrontBlueprintService_1.StorefrontBlueprintService.getAllBlueprints();
            return res.json({
                success: true,
                pages,
                blueprints,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load storefront pages',
            });
        }
    });
    // 8. Admin: Provision All Storefront Pages Idempotently (Protected)
    app.post('/storefront/admin/pages/provision', async (req, res) => {
        if (!ensureAdminAuthenticated(req, res))
            return;
        try {
            const tenantId = resolveTenantId(req);
            const pages = await StorefrontBlueprintService_1.StorefrontBlueprintService.ensureProvisionedForTenant(tenantId);
            return res.json({
                success: true,
                pages,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to provision storefront pages',
            });
        }
    });
    // 9. Admin: Get Single Storefront Page Configuration & Blueprint (Protected)
    app.get('/storefront/admin/pages/:pageType', async (req, res) => {
        if (!ensureAdminAuthenticated(req, res))
            return;
        try {
            const tenantId = resolveTenantId(req);
            const rawType = String(req.params.pageType || '').trim().toLowerCase();
            if (!StorefrontBlueprintService_1.StorefrontBlueprintService.isValidPageType(rawType)) {
                return res.status(400).json({
                    success: false,
                    message: `Unsupported storefront page type "${rawType}". Expected one of: ${StorefrontBlueprintService_1.STOREFRONT_PAGE_TYPES.join(', ')}.`,
                });
            }
            const page = await StorefrontBlueprintService_1.StorefrontBlueprintService.ensurePageProvisioned(tenantId, rawType);
            const blueprint = StorefrontBlueprintService_1.StorefrontBlueprintService.getBlueprint(rawType);
            return res.json({
                success: true,
                page,
                blueprint,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to load storefront page',
            });
        }
    });
    // 10. Admin: Update Storefront Page Configuration, Block Order, or Block Settings (Protected)
    app.put('/storefront/admin/pages/:pageType', async (req, res) => {
        if (!ensureAdminAuthenticated(req, res))
            return;
        try {
            const tenantId = resolveTenantId(req);
            const rawType = String(req.params.pageType || '').trim().toLowerCase();
            if (!StorefrontBlueprintService_1.StorefrontBlueprintService.isValidPageType(rawType)) {
                return res.status(400).json({
                    success: false,
                    message: `Unsupported storefront page type "${rawType}". Expected one of: ${StorefrontBlueprintService_1.STOREFRONT_PAGE_TYPES.join(', ')}.`,
                });
            }
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const result = await StorefrontBlueprintService_1.StorefrontBlueprintService.updatePageConfiguration(tenantId, rawType, {
                title: body.title,
                description: body.description,
                isPublished: body.isPublished,
                blocks: body.blocks,
                expectedRevision: body.expectedRevision,
            });
            if (!result.success) {
                return res.status(result.status).json({
                    success: false,
                    message: result.error || 'Failed to update storefront page',
                });
            }
            return res.status(200).json({
                success: true,
                page: result.page,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to update storefront page configuration',
            });
        }
    });
    // 11. Admin: Reset Storefront Page to Default Blueprint (Protected, Requires Explicit Confirmation)
    app.post('/storefront/admin/pages/:pageType/reset', async (req, res) => {
        if (!ensureAdminAuthenticated(req, res))
            return;
        try {
            const tenantId = resolveTenantId(req);
            const rawType = String(req.params.pageType || '').trim().toLowerCase();
            if (!StorefrontBlueprintService_1.StorefrontBlueprintService.isValidPageType(rawType)) {
                return res.status(400).json({
                    success: false,
                    message: `Unsupported storefront page type "${rawType}". Expected one of: ${StorefrontBlueprintService_1.STOREFRONT_PAGE_TYPES.join(', ')}.`,
                });
            }
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const result = await StorefrontBlueprintService_1.StorefrontBlueprintService.resetPageToDefault(tenantId, rawType, body.confirmReset === true);
            if (!result.success) {
                return res.status(result.status).json({
                    success: false,
                    message: result.error || 'Failed to reset storefront page',
                });
            }
            return res.status(200).json({
                success: true,
                page: result.page,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to reset storefront page to default blueprint',
            });
        }
    });
};
registerStorefrontRoutes.resolveTenantId = resolveTenantId;
registerStorefrontRoutes.toPublicCategoryDTO = toPublicCategoryDTO;
registerStorefrontRoutes.toPublicProductDTO = toPublicProductDTO;
registerStorefrontRoutes.toPublicSettingsDTO = toPublicSettingsDTO;
// The price shoppers see (product discount applied); used to sort and to filter by price.
const EFFECTIVE_PRICE = {
    $cond: [
        { $gt: [{ $ifNull: ['$discountPercentage', 0] }, 0] },
        {
            $round: [
                {
                    $multiply: [
                        '$price',
                        { $subtract: [1, { $divide: ['$discountPercentage', 100] }] },
                    ],
                },
                2,
            ],
        },
        {
            $cond: [
                {
                    $and: [
                        { $ne: ['$discountPrice', null] },
                        { $gte: ['$discountPrice', 0] },
                        { $lt: ['$discountPrice', '$price'] },
                    ],
                },
                '$discountPrice',
                '$price',
            ],
        },
    ],
};
module.exports = registerStorefrontRoutes;
