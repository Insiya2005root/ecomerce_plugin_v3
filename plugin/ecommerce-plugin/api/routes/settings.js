"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Settings_1 = __importDefault(require("../models/Settings"));
module.exports = (app) => {
    app.get('/settings', async (req, res) => {
        try {
            const SettingsModel = Settings_1.default.getModel();
            let settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
            if (!settings) {
                settings = await SettingsModel.create({ tenantId: 'default_tenant' });
            }
            res.json({ success: true, settings });
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
            for (const field of updatableFields) {
                if (req.body[field] !== undefined) {
                    settings[field] = req.body[field];
                }
            }
            await settings.save();
            res.json({ success: true, settings });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
