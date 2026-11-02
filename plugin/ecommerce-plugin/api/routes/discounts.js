"use strict";
module.exports = (app) => {
    app.get('/campaigns/active', async (req, res) => {
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
                if (!camp.campaign?.storefrontDisplay)
                    continue;
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
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.get('/discounts', async (req, res) => {
        try {
            const DiscountRule = require('../models/DiscountRule').getModel();
            const rules = await DiscountRule.find({ tenantId: 'default_tenant', status: { $ne: 'Archived' } }).sort({ createdAt: -1 });
            res.json({ success: true, rules });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    const sendRuleError = (res, error) => {
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'Another discount already uses this code.', field: 'code' });
        }
        if (error?.name === 'ValidationError' || error?.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: error.message });
    };
    app.post('/discounts', async (req, res) => {
        try {
            const DiscountRule = require('../models/DiscountRule').getModel();
            const newRule = new DiscountRule(req.body);
            await newRule.save();
            res.json({ success: true, rule: newRule });
        }
        catch (error) {
            sendRuleError(res, error);
        }
    });
    // Read-only usage report: how often a rule (or a campaign's rules) appears on orders and what it gave away.
    app.get('/discounts/:id/usage', async (req, res) => {
        try {
            const mongoose = require('mongoose');
            const DiscountRule = require('../models/DiscountRule').getModel();
            const Order = require('../models/Order').getModel();
            if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
                return res.status(400).json({ success: false, message: 'Invalid discount id.' });
            }
            const rule = await DiscountRule.findById(req.params.id).lean();
            if (!rule)
                return res.status(404).json({ success: false, message: 'Not found' });
            const ruleIds = rule.type === 'campaign' ? (rule.campaign?.childRuleIds || []).map(String) : [String(rule._id)];
            const idForms = ruleIds.flatMap((rid) => (mongoose.Types.ObjectId.isValid(rid) ? [rid, new mongoose.Types.ObjectId(rid)] : [rid]));
            const orders = await Order.collection
                .find({ tenantId: 'default_tenant', 'pricing.appliedDiscounts.ruleId': { $in: idForms } })
                .project({ orderNumber: 1, createdAt: 1, status: 1, paymentStatus: 1, customerDetails: 1, 'pricing.totalAmount': 1, 'pricing.appliedDiscounts': 1 })
                .sort({ createdAt: -1 })
                .toArray();
            let totalDiscount = 0;
            let revenue = 0;
            let cancelled = 0;
            const recent = [];
            for (const order of orders) {
                const discount = (order.pricing?.appliedDiscounts || [])
                    .filter((d) => ruleIds.includes(String(d.ruleId)))
                    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                if (order.status === 'Cancelled')
                    cancelled++;
                else {
                    totalDiscount += discount;
                    revenue += Number(order.pricing?.totalAmount) || 0;
                }
                if (recent.length < 10) {
                    recent.push({
                        _id: order._id,
                        orderNumber: order.orderNumber,
                        createdAt: order.createdAt,
                        status: order.status,
                        paymentStatus: order.paymentStatus || 'Not paid',
                        customerName: order.customerDetails?.name,
                        total: order.pricing?.totalAmount,
                        discount,
                    });
                }
            }
            res.json({
                success: true,
                usage: {
                    usedCount: Number(rule.usedCount) || 0,
                    usageLimit: rule.usageLimit || null,
                    orderCount: orders.length - cancelled,
                    cancelledOrderCount: cancelled,
                    totalDiscount: Math.round(totalDiscount * 100) / 100,
                    revenue: Math.round(revenue * 100) / 100,
                    recentOrders: recent,
                },
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.get('/discounts/:id', async (req, res) => {
        try {
            const DiscountRule = require('../models/DiscountRule').getModel();
            const rule = await DiscountRule.findById(req.params.id);
            if (!rule)
                return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, rule });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    app.put('/discounts/:id', async (req, res) => {
        try {
            const DiscountRule = require('../models/DiscountRule').getModel();
            const updated = await DiscountRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updated)
                return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, rule: updated });
        }
        catch (error) {
            sendRuleError(res, error);
        }
    });
    app.delete('/discounts/:id', async (req, res) => {
        try {
            const DiscountRule = require('../models/DiscountRule').getModel();
            const Order = require('../models/Order').getModel();
            const inUse = await Order.exists({ "pricing.appliedDiscounts.ruleId": req.params.id });
            if (inUse) {
                await DiscountRule.findByIdAndUpdate(req.params.id, { status: 'Archived' });
                return res.json({ success: true, archived: true, message: 'Discount has order history and was safely archived.' });
            }
            else {
                await DiscountRule.findByIdAndDelete(req.params.id);
                return res.json({ success: true, archived: false, message: 'Discount permanently deleted.' });
            }
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
};
