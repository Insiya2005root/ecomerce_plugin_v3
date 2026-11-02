import Settings from '../models/Settings';
import TaxClass from '../models/TaxClass';
import TaxRule from '../models/TaxRule';
import { TaxEngine } from '../services/TaxEngine';

const POLICIES = ['UseGlobal', 'Taxable', 'NonTaxable'];

/** Checks a tax rule payload; returns the cleaned rule or a list of field errors. */
function cleanRule(body: any): { rule?: any; errors?: Record<string, string> } {
    const errors: Record<string, string> = {};
    const name = String(body?.name || '').trim();
    if (!name) errors.name = 'Enter a tax name.';
    if (!/^[a-f0-9]{24}$/i.test(String(body?.taxClassId?._id || body?.taxClassId || ''))) errors.taxClassId = 'Choose a tax category.';
    const components = Array.isArray(body?.components) ? body.components : [];
    if (!components.length) errors.components = 'Add at least one rate.';
    const cleaned = components.map((c: any) => ({ label: String(c?.label || '').trim(), rate: Number(c?.rate) }));
    if (cleaned.some((c: any) => !c.label)) errors.components = 'Every rate needs a label, like CGST.';
    else if (cleaned.some((c: any) => !Number.isFinite(c.rate) || c.rate < 0 || c.rate > 100)) errors.components = 'Rates must be between 0% and 100%.';
    const priority = Number(body?.priority ?? 0);
    if (!Number.isInteger(priority)) errors.priority = 'Priority must be a whole number.';
    if (Object.keys(errors).length) return { errors };
    const scope = (v: any) => String(v || '').trim() || '*';
    return {
        rule: {
            name,
            taxClassId: String(body.taxClassId?._id || body.taxClassId),
            country: scope(body.country),
            state: scope(body.state),
            postalScope: scope(body.postalScope),
            components: cleaned,
            shippingTaxPolicy: POLICIES.includes(body.shippingTaxPolicy) ? body.shippingTaxPolicy : 'UseGlobal',
            priority,
            status: body.status === 'Inactive' ? 'Inactive' : 'Active',
        },
    };
}

const invalid = (res: any, errors: Record<string, string>) => res.status(400).json({ success: false, message: Object.values(errors)[0], errors });

export = (app: any) => {
    
    // Auto-Migrate old tax setting to the new system if needed
        app.post('/taxes/migrate', async (req: any, res: any) => {
        try {
            const SettingsModel = Settings.getModel();
            const TaxClassModel = TaxClass.getModel();
            const TaxRuleModel = TaxRule.getModel();

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
                } else if (settings) {
                    settings.defaultTaxClassId = standard._id.toString();
                    await settings.save();
                }
                return res.json({ success: true, message: 'Seeded default tax categories.' });
            }

            if (settings && settings.taxRate > 0) {
                let standardClass = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant', code: 'standard' });
                if (!standardClass) standardClass = await TaxClassModel.findOne({ tenantId: req.tenantId || 'default_tenant' });
                
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
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // --- TAX CLASSES ---
    app.get('/taxes/classes', async (req: any, res: any) => {
        try {
            const TaxClassModel = TaxClass.getModel();
            const classes = await TaxClassModel.find({ tenantId: req.tenantId || 'default_tenant' }).sort({ createdAt: -1 });
            // Products per tax category ('Default' = products using the store default).
            const Product = require('../models/Product').getModel();
            const counts = await Product.collection.aggregate([{ $group: { _id: { $ifNull: ['$taxClassId', 'Default'] }, n: { $sum: 1 } } }]).toArray();
            const productCounts = Object.fromEntries(counts.map((c: any) => [String(c._id || 'Default'), c.n]));
            res.json({ success: true, classes, productCounts });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.post('/taxes/classes', async (req: any, res: any) => {
        try {
            const TaxClassModel = TaxClass.getModel();
            
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
        } catch (e: any) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
            }
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.get('/taxes/classes/:id', async (req: any, res: any) => {
        try {
            const TaxClassModel = TaxClass.getModel();
            const doc = await TaxClassModel.findById(req.params.id);
            if (!doc) return res.status(404).json({ success: false, message: 'Tax category not found.' });
            res.json({ success: true, class: doc });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.put('/taxes/classes/:id', async (req: any, res: any) => {
        try {
            const TaxClassModel = TaxClass.getModel();
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
        } catch (e: any) {
            if (e.code === 11000) {
                return res.status(400).json({ success: false, message: 'A tax category with this name already exists.' });
            }
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.delete('/taxes/classes/:id', async (req: any, res: any) => {
        try {
            // Safely archive instead of hard delete
            const TaxClassModel = TaxClass.getModel();
            await TaxClassModel.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
            res.json({ success: true, message: 'Archived safely' });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // --- TAX RULES ---
    app.get('/taxes/rules', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            const tenantId = req.tenantId || 'default_tenant';
            const rules = await TaxRuleModel.find({ tenantId }).sort({ priority: -1, createdAt: -1 }).lean();
            // Attach each rule's tax class by hand: OpenExt registers models under prefixed names,
            // so populate('taxClassId') can't find 'EcommerceTaxClass' there.
            const classes = await TaxClass.getModel().find({ tenantId }).lean();
            const byId = new Map(classes.map((c: any) => [String(c._id), c]));
            res.json({ success: true, rules: rules.map((r: any) => ({ ...r, taxClassId: byId.get(String(r.taxClassId)) || r.taxClassId })) });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.post('/taxes/rules', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            const { rule, errors } = cleanRule(req.body);
            if (errors) return invalid(res, errors);
            const doc = await TaxRuleModel.create({ ...rule, tenantId: req.tenantId || 'default_tenant' });
            res.json({ success: true, rule: doc });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.get('/taxes/rules/:id', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            const doc = await TaxRuleModel.findById(req.params.id);
            res.json({ success: true, rule: doc });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.put('/taxes/rules/:id', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            const { rule, errors } = cleanRule(req.body);
            if (errors) return invalid(res, errors);
            const doc = await TaxRuleModel.findByIdAndUpdate(req.params.id, rule, { new: true });
            if (!doc) return res.status(404).json({ success: false, message: 'Tax rate not found.' });
            res.json({ success: true, rule: doc });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.delete('/taxes/rules/:id', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            await TaxRuleModel.findByIdAndUpdate(req.params.id, { status: 'Inactive' });
            res.json({ success: true, message: 'Archived safely' });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    // Read-only: which rate the engine would use for a category and address, and the tax on an amount.
    app.post('/taxes/preview', async (req: any, res: any) => {
        try {
            const { taxClassId, country, state, postalCode } = req.body || {};
            const amount = Math.max(0, Number(req.body?.amount) || 0);
            const settings = await Settings.getModel().collection.findOne({ tenantId: 'default_tenant' });
            const classId = !taxClassId || taxClassId === 'Default' ? settings?.defaultTaxClassId || 'NonTaxable' : String(taxClassId);
            const enabled = settings?.taxesEnabled !== false;
            const rule = enabled && classId !== 'NonTaxable' ? await TaxEngine.resolveRule(classId, { country, state, postalCode }) : null;
            const rate = rule ? (rule.components || []).reduce((s: number, c: any) => s + (Number(c.rate) || 0), 0) : 0;
            const inclusive = settings?.pricesIncludeTax === true;
            const tax = inclusive ? amount - amount / (1 + rate / 100) : amount * (rate / 100);
            res.json({
                success: true,
                preview: {
                    taxesEnabled: enabled,
                    taxClassId: classId,
                    pricesIncludeTax: inclusive,
                    rule: rule ? { _id: rule._id, name: rule.name, country: rule.country, state: rule.state, postalScope: rule.postalScope, components: rule.components, priority: rule.priority } : null,
                    rate,
                    amount,
                    tax: Math.round(tax * 100) / 100,
                },
            });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
