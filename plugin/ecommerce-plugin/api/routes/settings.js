"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Settings_1 = __importDefault(require("../models/Settings"));
const StoreSettings_1 = require("../services/StoreSettings");
const TENANT = 'default_tenant';
const ROLE_LABELS = { '0': 'Super admin', '1': 'Admin', '2': 'Editor', '3': 'Author' };
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d][\d\s()-]{5,19}$/;
const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
function sendValidation(res, errors) {
    res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
}
module.exports = (app) => {
    app.get('/settings', async (req, res) => {
        try {
            const SettingsModel = Settings_1.default.getModel();
            let settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
            if (!settings) {
                settings = await SettingsModel.create({ tenantId: 'default_tenant' });
            }
            // Raw read so fields the cached schema may not know (e.g. shipFromLocationId) are included.
            res.json({ success: true, settings: await SettingsModel.collection.findOne({ tenantId: TENANT }) });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.post('/settings', async (req, res) => {
        try {
            const SettingsModel = Settings_1.default.getModel();
            let settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
            if (!settings) {
                settings = new SettingsModel({ tenantId: 'default_tenant' });
            }
            const updatableFields = [
                'taxRate', 'taxesEnabled', 'defaultTaxClassId', 'pricesIncludeTax', 'taxShippingByDefault', 'displayTaxBreakdown', 'shippingMethod', 'shippingRate', 'freeShippingThreshold',
                'shippingRatePerKm', 'locationSelection', 'distanceRounding',
                'routeFailureBehaviour', 'fallbackShippingCost'
            ];
            const amounts = ['shippingRate', 'freeShippingThreshold', 'shippingRatePerKm', 'fallbackShippingCost'];
            const errors = {};
            for (const field of amounts) {
                if (req.body[field] === undefined)
                    continue;
                const n = Number(req.body[field]);
                if (!Number.isFinite(n) || n < 0)
                    errors[field] = 'Amounts must be zero or more.';
            }
            // The store every distance is measured from ('' = nearest active location).
            const shipFrom = req.body.shipFromLocationId;
            if (shipFrom !== undefined && shipFrom !== '' && shipFrom !== null) {
                const Location = require('../models/Location').getModel();
                const ok = /^[a-f0-9]{24}$/i.test(String(shipFrom)) && (await Location.exists({ _id: shipFrom, tenantId: TENANT }));
                if (!ok)
                    errors.shipFromLocationId = 'Choose one of your locations.';
            }
            if (Object.keys(errors).length)
                return sendValidation(res, errors);
            for (const field of updatableFields) {
                if (req.body[field] !== undefined) {
                    settings[field] = req.body[field];
                }
            }
            await settings.save();
            if (shipFrom !== undefined) {
                await SettingsModel.collection.updateOne({ tenantId: TENANT }, { $set: { shipFromLocationId: shipFrom ? String(shipFrom) : '' } });
            }
            res.json({ success: true, settings: await SettingsModel.collection.findOne({ tenantId: TENANT }) });
        }
        catch (e) {
            if (e?.name === 'ValidationError' || e?.name === 'CastError')
                return res.status(400).json({ success: false, message: e.message });
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // --- General (store details) ---
    app.get('/settings/store', async (req, res) => {
        try {
            res.json({ success: true, store: await (0, StoreSettings_1.getStoreSettings)(), currency: { code: 'INR', symbol: '₹' } });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/settings/store', async (req, res) => {
        try {
            const body = req.body || {};
            const current = await (0, StoreSettings_1.getStoreSettings)();
            const input = { ...current, ...body, address: { ...current.address, ...(body.address || {}) } };
            const errors = {};
            const store = {
                name: text(input.name, 120),
                legalName: text(input.legalName, 160),
                email: text(input.email, 160).toLowerCase(),
                phone: text(input.phone, 30),
                gstin: text(input.gstin, 15).toUpperCase(),
                address: Object.fromEntries(Object.keys(StoreSettings_1.STORE_DEFAULTS.address).map((k) => [k, text(input.address[k])])),
                orderPrefix: text(input.orderPrefix, 10).toUpperCase(),
                lowStockThreshold: Number(input.lowStockThreshold),
            };
            if (!store.name)
                errors.name = 'Enter a store name.';
            if (store.email && !EMAIL.test(store.email))
                errors.email = 'Enter a valid email address.';
            if (store.phone && !PHONE.test(store.phone))
                errors.phone = 'Enter a valid phone number.';
            if (store.gstin && !GSTIN.test(store.gstin))
                errors.gstin = 'A GSTIN has 15 characters, like 27AAPFU0939F1ZV.';
            if (!/^[A-Z0-9-]{1,10}$/.test(store.orderPrefix))
                errors.orderPrefix = 'Use 1–10 letters, numbers or dashes.';
            if (!Number.isInteger(store.lowStockThreshold) || store.lowStockThreshold < 0 || store.lowStockThreshold > 10000) {
                errors.lowStockThreshold = 'Enter a whole number from 0 to 10,000.';
            }
            if (Object.keys(errors).length)
                return sendValidation(res, errors);
            const SettingsModel = Settings_1.default.getModel();
            await SettingsModel.collection.updateOne({ tenantId: TENANT }, { $set: { store, updatedAt: new Date() } }, { upsert: true });
            res.json({ success: true, store: await (0, StoreSettings_1.getStoreSettings)() });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // --- Profile (the signed-in OpenExt user) ---
    app.get('/profile', async (req, res) => {
        try {
            const user = (0, StoreSettings_1.currentUser)(req);
            if (!user)
                return res.status(401).json({ success: false, message: 'Sign in to OpenExt to see your profile.' });
            res.json({
                success: true,
                user: { ...user, roleLabel: user.role === null ? null : ROLE_LABELS[String(user.role)] || String(user.role) },
                profile: await (0, StoreSettings_1.getAdminProfile)(user.id),
            });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/profile', async (req, res) => {
        try {
            const user = (0, StoreSettings_1.currentUser)(req);
            if (!user)
                return res.status(401).json({ success: false, message: 'Sign in to OpenExt to update your profile.' });
            const body = req.body || {};
            const current = await (0, StoreSettings_1.getAdminProfile)(user.id);
            const profile = {
                displayName: text(body.displayName ?? current.displayName, 80),
                phone: text(body.phone ?? current.phone, 30),
                jobTitle: text(body.jobTitle ?? current.jobTitle, 80),
                dashboardDays: Number(body.dashboardDays ?? current.dashboardDays),
            };
            const errors = {};
            if (profile.phone && !PHONE.test(profile.phone))
                errors.phone = 'Enter a valid phone number.';
            if (![7, 30, 90].includes(profile.dashboardDays))
                errors.dashboardDays = 'Choose 7, 30 or 90 days.';
            if (Object.keys(errors).length)
                return sendValidation(res, errors);
            const Profile = require('../models/AdminProfile').getModel();
            await Profile.collection.updateOne({ tenantId: TENANT, userId: user.id }, { $set: { ...profile, updatedAt: new Date() }, $setOnInsert: { tenantId: TENANT, userId: user.id, createdAt: new Date() } }, { upsert: true });
            res.json({ success: true, profile: { ...StoreSettings_1.PROFILE_DEFAULTS, ...profile } });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // One read for the Settings overview cards.
    app.get('/settings/overview', async (req, res) => {
        try {
            const SettingsModel = Settings_1.default.getModel();
            const TaxClass = require('../models/TaxClass').getModel();
            const TaxRule = require('../models/TaxRule').getModel();
            const Location = require('../models/Location').getModel();
            const user = (0, StoreSettings_1.currentUser)(req);
            const [raw, store, taxClasses, taxRules, locations, activeLocations, profile] = await Promise.all([
                SettingsModel.collection.findOne({ tenantId: TENANT }),
                (0, StoreSettings_1.getStoreSettings)(),
                TaxClass.countDocuments({ tenantId: TENANT, status: 'Active' }),
                TaxRule.countDocuments({ tenantId: TENANT, status: 'Active' }),
                Location.countDocuments({ tenantId: TENANT }),
                Location.countDocuments({ tenantId: TENANT, status: 'Active' }),
                user ? (0, StoreSettings_1.getAdminProfile)(user.id) : null,
            ]);
            res.json({
                success: true,
                overview: {
                    store: { name: store.name, email: store.email, gstin: store.gstin, orderPrefix: store.orderPrefix },
                    profile: user ? { email: user.email, displayName: profile?.displayName || '' } : null,
                    tax: { enabled: raw?.taxesEnabled !== false, pricesIncludeTax: raw?.pricesIncludeTax === true, classes: taxClasses, rules: taxRules },
                    shipping: {
                        method: raw?.shippingMethod === 'Distance' ? 'Distance' : 'Flat',
                        rate: raw?.shippingRate || 0,
                        ratePerKm: raw?.shippingRatePerKm || 0,
                        freeShippingThreshold: raw?.freeShippingThreshold || 0,
                    },
                    locations: { total: locations, active: activeLocations },
                },
            });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
