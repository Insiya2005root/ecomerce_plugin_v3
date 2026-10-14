"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Settings_1 = __importDefault(require("../models/Settings"));
const TaxClass_1 = __importDefault(require("../models/TaxClass"));
const TaxRule_1 = __importDefault(require("../models/TaxRule"));
module.exports = (app) => {
    // Auto-Migrate old tax setting to the new system if needed
    app.post('/taxes/migrate', async (req, res) => {
        try {
            const SettingsModel = Settings_1.default.getModel();
            const TaxClassModel = TaxClass_1.default.getModel();
            const TaxRuleModel = TaxRule_1.default.getModel();
            const settings = await SettingsModel.findOne({ tenantId: req.tenantId || 'default_tenant' });
            const classCount = await TaxClassModel.countDocuments({ tenantId: req.tenantId || 'default_tenant' });
            if (classCount === 0) {
                const standard = await TaxClassModel.create({ tenantId: req.tenantId || 'default_tenant', name: 'Standard', code: 'standard', description: 'Regular taxable products', status: 'Active', shippingTaxPolicy: 'UseGlobal' });
                await TaxClassModel.create({ tenantId: req.tenantId || 'default_tenant', name: 'Reduced', code: 'reduced', description: 'Products with reduced tax rate', status: 'Active', shippingTaxPolicy: 'UseGlobal' });
                await TaxClassModel.create({ tenantId: req.tenantId || 'default_tenant', name: 'Zero Rated', code: 'zero-rated', description: 'Products with 0% tax', status: 'Active', shippingTaxPolicy: 'UseGlobal' });
                if (settings && settings.taxRate > 0) {
                    await TaxRuleModel.create({
                        tenantId: req.tenantId || 'default_tenant',
                        name: 'Global Standard Rate',
                        taxClassId: standard._id,
                        country: '*',
                        state: '*',
                        postalScope: '*',
                        components: [{ label: 'Tax', rate: settings.taxRate }],
                        priority: 0,
                        status: 'Active'
                    });
                    settings.defaultTaxClassId = standard._id.toString();
                    settings.taxRate = 0;
                    await settings.save();
                }
                else if (settings) {
                    settings.defaultTaxClassId = standard._id.toString();
                    await settings.save();
                }
                return res.json({ success: true, message: 'Seeded default tax categories.' });
            }
            if (settings && settings.taxRate > 0) {
                let standardClass = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant', code: 'standard' });
                if (!standardClass)
                    standardClass = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant' });
                if (standardClass) {
                    await TaxRuleModel.create({
                        tenantId: req.tenantId || 'default_tenant',
                        name: 'Global Standard Rate',
                        taxClassId: standardClass._id,
                        country: '*',
                        state: '*',
                        postalScope: '*',
                        components: [{ label: 'Tax', rate: settings.taxRate }],
                        priority: 0,
                        status: 'Active'
                    });
                    settings.defaultTaxClassId = standardClass._id.toString();
                    settings.taxRate = 0;
                    await settings.save();
                    return res.json({ success: true, message: 'Migrated old tax rate.' });
                }
            }
            res.json({ success: true, message: 'Nothing to migrate.' });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // --- TAX CLASSES ---
    app.get('/taxes/classes', async (req, res) => {
        try {
            const TaxClassModel = TaxClass_1.default.getModel();
            const classes = await TaxClassModel.find({ tenantId: req.tenantId || 'default_tenant' }).sort({ createdAt: -1 });
            res.json({ success: true, classes });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.post('/taxes/classes', async (req, res) => {
        try {
            const TaxClassModel = TaxClass_1.default.getModel();
            if (!req.body.name || !req.body.name.trim()) {
                return res.status(400).json({ success: false, message: 'Category Name is required.' });
            }
            const name = req.body.name.trim();
            const code = req.body.code || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            if (!code) {
                return res.status(400).json({ success: false, message: 'Category Name is invalid.' });
            }
            const existing = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant', code });
            if (existing) {
                return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
            }
            const data = {
                tenantId: req.tenantId || 'default_tenant',
                name: name,
                code: code,
                description: req.body.description || '',
                status: req.body.status === 'Inactive' ? 'Inactive' : 'Active',
                shippingTaxPolicy: 'UseGlobal'
            };
            const doc = await TaxClassModel.create(data);
            res.json({ success: true, class: doc });
        }
        catch (e) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
            }
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.get('/taxes/classes/:id', async (req, res) => {
        try {
            const TaxClassModel = TaxClass_1.default.getModel();
            const doc = await TaxClassModel.findById(req.params.id);
            res.json({ success: true, class: doc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/taxes/classes/:id', async (req, res) => {
        try {
            const TaxClassModel = TaxClass_1.default.getModel();
            if (req.body.name && !req.body.name.trim()) {
                return res.status(400).json({ success: false, message: 'Category Name cannot be empty.' });
            }
            if (req.body.name) {
                req.body.name = req.body.name.trim();
                if (!req.body.code) {
                    req.body.code = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                }
            }
            if (req.body.code) {
                const existing = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant', code: req.body.code, _id: { $ne: req.params.id } });
                if (existing) {
                    return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
                }
            }
            const doc = await TaxClassModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json({ success: true, class: doc });
        }
        catch (e) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
            }
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.delete('/taxes/classes/:id', async (req, res) => {
        try {
            // Safely archive instead of hard delete
            const TaxClassModel = TaxClass_1.default.getModel();
            await TaxClassModel.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
            res.json({ success: true, message: 'Archived safely' });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // --- TAX RULES ---
    app.get('/taxes/rules', async (req, res) => {
        try {
            const TaxRuleModel = TaxRule_1.default.getModel();
            const rules = await TaxRuleModel.find({ tenantId: req.tenantId || 'default_tenant' }).populate('taxClassId').sort({ priority: -1, createdAt: -1 });
            res.json({ success: true, rules });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.post('/taxes/rules', async (req, res) => {
        try {
            const TaxRuleModel = TaxRule_1.default.getModel();
            const data = { ...req.body, tenantId: req.tenantId || 'default_tenant' };
            const doc = await TaxRuleModel.create(data);
            res.json({ success: true, rule: doc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.get('/taxes/rules/:id', async (req, res) => {
        try {
            const TaxRuleModel = TaxRule_1.default.getModel();
            const doc = await TaxRuleModel.findById(req.params.id);
            res.json({ success: true, rule: doc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/taxes/rules/:id', async (req, res) => {
        try {
            const TaxRuleModel = TaxRule_1.default.getModel();
            const doc = await TaxRuleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json({ success: true, rule: doc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.delete('/taxes/rules/:id', async (req, res) => {
        try {
            const TaxRuleModel = TaxRule_1.default.getModel();
            await TaxRuleModel.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
            res.json({ success: true, message: 'Archived safely' });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
