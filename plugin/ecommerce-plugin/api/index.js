"use strict";
function isPublicPluginRoute(method, rawPath) {
    const upperMethod = String(method || 'GET').toUpperCase();
    const normalizedPath = String(rawPath || '')
        .replace(/\/+/g, '/')
        .replace(/^\//, '')
        .replace(/\/$/, '');
    if (upperMethod === 'GET') {
        if (normalizedPath === 'health' ||
            normalizedPath === 'storefront/health' ||
            normalizedPath === 'storefront/settings' ||
            normalizedPath === 'storefront/categories' ||
            normalizedPath === 'storefront/products' ||
            /^storefront\/products\/[^/]+$/.test(normalizedPath) ||
            /^storefront\/pages\/(shop|product|cart|checkout)$/.test(normalizedPath)) {
            return true;
        }
    }
    if (upperMethod === 'POST') {
        if (normalizedPath === 'cart/calculate') {
            return true;
        }
    }
    return false;
}
module.exports = {
    async register({ app, cms }) {
        // Replace default '/health'-only auth middleware with explicit method+path public allowlist
        // while keeping all Admin CRUD and configuration routes strictly protected.
        const strictAuthMiddleware = async (req, res, next) => {
            if (!isPublicPluginRoute(req?.method, req?.path) && !req?.user) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            await next();
        };
        if (Array.isArray(app?.middlewares) && app.middlewares.length > 0) {
            app.middlewares[0] = strictAuthMiddleware;
        }
        else if (typeof app?.use === 'function') {
            app.use(strictAuthMiddleware);
        }
        await require('./models/Product').register(cms);
        await require('./models/Category').register(cms);
        await require('./models/Order').register(cms);
        await require('./models/Settings').register(cms);
        await require('./models/TaxClass').register(cms);
        await require('./models/TaxRule').register(cms);
        await require('./models/Location').register(cms);
        await require('./models/DiscountRule').register(cms);
        await require('./models/StorefrontPage').register(cms);
        require('./routes/products')(app);
        require('./routes/categories')(app);
        require('./routes/settings')(app);
        require('./routes/taxes')(app);
        require('./routes/locations')(app);
        require('./routes/cart')(app);
        require('./routes/checkout')(app);
        require('./routes/orders')(app);
        require('./routes/discounts')(app);
        require('./routes/storefront')(app);
        try {
            const { StorefrontBlueprintService } = require('./services/StorefrontBlueprintService');
            await StorefrontBlueprintService.ensureProvisionedForTenant('default_tenant');
        }
        catch {
            // Provisioning will also run lazily on storefront page requests
        }
    },
    boot({ cms }) {
        cms.logger.info('E-Commerce plugin booted successfully with TypeScript.');
    },
    shutdown() { }
};
