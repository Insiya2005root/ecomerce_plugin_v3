import Settings from '../models/Settings';
import TaxClass from '../models/TaxClass';
import TaxRule from '../models/TaxRule';

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
            res.json({ success: true, classes });
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
            const rules = await TaxRuleModel.find({ tenantId: req.tenantId || 'default_tenant' }).populate('taxClassId').sort({ priority: -1, createdAt: -1 });
            res.json({ success: true, rules });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.post('/taxes/rules', async (req: any, res: any) => {
        try {
            const TaxRuleModel = TaxRule.getModel();
            const data = { ...req.body, tenantId: req.tenantId || 'default_tenant' };
            const doc = await TaxRuleModel.create(data);
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
            const doc = await TaxRuleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
};
