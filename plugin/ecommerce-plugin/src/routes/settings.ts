import Settings from '../models/Settings';

export = (app: any) => {
  app.get('/settings', async (req: any, res: any) => {
    try {
      const SettingsModel = Settings.getModel();
      let settings = await SettingsModel.findOne({ tenantId: 'default_tenant' });
      if (!settings) {
        settings = await SettingsModel.create({ tenantId: 'default_tenant' });
      }
      res.json({ success: true, settings });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/settings', async (req: any, res: any) => {
    try {
      const SettingsModel = Settings.getModel();
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
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
};

