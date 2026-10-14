import { Request, Response } from 'express';

export = (app: any) => {
  app.get('/campaigns/active', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const now = new Date();
      
      const activeCampaigns = await DiscountRule.find({
        tenantId: 'default_tenant',
        type: 'campaign',
        status: 'Active',
        $or: [{ startDate: null }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: null }, { endDate: { $gt: now } }] }]
      });

      const responseCampaigns = [];

      for (const camp of activeCampaigns) {
        if (!camp.campaign?.storefrontDisplay) continue;

        // Fetch child rules to find the max percentage
        let maxPercentage = 0;
        if (camp.campaign?.childRuleIds && camp.campaign.childRuleIds.length > 0) {
          const childRules = await DiscountRule.find({
            _id: { $in: camp.campaign.childRuleIds },
            status: 'Active',
            $or: [{ startDate: null }, { startDate: { $lte: now } }],
            $and: [{ $or: [{ endDate: null }, { endDate: { $gt: now } }] }]
          });

          for (const rule of childRules) {
            if (rule.type === 'percentage' && rule.value > maxPercentage) {
              maxPercentage = rule.value;
            }
          }
        }

        responseCampaigns.push({
          id: camp._id,
          name: camp.name,
          marketingHeading: camp.campaign?.marketingHeading || camp.name,
          description: camp.campaign?.description,
          upToPercentage: maxPercentage,
          startDate: camp.startDate,
          endDate: camp.endDate
        });
      }

      res.json({ success: true, campaigns: responseCampaigns });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/discounts', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const rules = await DiscountRule.find({ tenantId: 'default_tenant', status: { $ne: 'Archived' } }).sort({ createdAt: -1 });
      res.json({ success: true, rules });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/discounts', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const newRule = new DiscountRule(req.body);
      await newRule.save();
      res.json({ success: true, rule: newRule });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  app.get('/discounts/:id', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const rule = await DiscountRule.findById(req.params.id);
      if (!rule) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, rule });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/discounts/:id', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const updated = await DiscountRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json({ success: true, rule: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/discounts/:id', async (req: Request, res: Response) => {
    try {
      const DiscountRule = require('../models/DiscountRule').getModel();
      const Order = require('../models/Order').getModel();
      
      const inUse = await Order.exists({ "pricing.appliedDiscounts.ruleId": req.params.id });
      if (inUse) {
        await DiscountRule.findByIdAndUpdate(req.params.id, { status: 'Archived' });
        return res.json({ success: true, archived: true, message: 'Discount has order history and was safely archived.' });
      } else {
        await DiscountRule.findByIdAndDelete(req.params.id);
        return res.json({ success: true, archived: false, message: 'Discount permanently deleted.' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};
