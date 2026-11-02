"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Location_1 = __importDefault(require("../models/Location"));
const GeoLookup_1 = require("../services/GeoLookup");
const InventoryService_1 = require("../services/InventoryService");
const http = require('http');
const https = require('https');
async function geocodeAddress(addressStr) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}`;
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/ecommerce-plugin' } }, (resp) => {
            let body = '';
            resp.on('data', (chunk) => body += chunk);
            resp.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data && data.length > 0) {
                        resolve({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
                    }
                    else {
                        resolve(null);
                    }
                }
                catch (err) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}
const REQUIRED = { name: 'Enter a location name.', addressLine1: 'Enter the street address.', city: 'Enter a city.', state: 'Enter a state.', postalCode: 'Enter a PIN code.' };
/** Field errors for a location payload (partial updates only check the fields they send). */
function locationErrors(body, partial) {
    const errors = {};
    for (const [field, message] of Object.entries(REQUIRED)) {
        if (partial && body?.[field] === undefined)
            continue;
        if (!String(body?.[field] ?? '').trim())
            errors[field] = message;
    }
    for (const field of ['latitude', 'longitude']) {
        const v = body?.[field];
        if (v === undefined || v === null || v === '')
            continue;
        const n = Number(v);
        const max = field === 'latitude' ? 90 : 180;
        if (!Number.isFinite(n) || Math.abs(n) > max)
            errors[field] = `Enter a ${field} between -${max} and ${max}.`;
    }
    if (body?.priority !== undefined && !Number.isInteger(Number(body.priority)))
        errors.priority = 'Priority must be a whole number.';
    return Object.keys(errors).length ? errors : null;
}
const invalid = (res, errors) => res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
module.exports = (app) => {
    // City, state and map coordinates for a PIN code (fills the location form).
    app.get('/geo/pincode', async (req, res) => {
        try {
            const pin = String(req.query.pin || '').trim();
            if (!/^[1-9]\d{5}$/.test(pin))
                return res.status(400).json({ success: false, message: 'Enter a 6-digit PIN code.' });
            const { lookupPincode } = require('../services/GeoLookup');
            const info = await lookupPincode(pin);
            if (!info)
                return res.status(404).json({ success: false, message: `PIN code ${pin} wasn't found.` });
            res.json({ success: true, place: info });
        }
        catch (e) {
            res.status(502).json({ success: false, message: e.message });
        }
    });
    app.get('/locations', async (req, res) => {
        try {
            const LocationModel = Location_1.default.getModel();
            const locations = await LocationModel.find({ tenantId: 'default_tenant' }).sort({ priority: -1, createdAt: -1 });
            res.json({ success: true, locations });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.post('/locations', async (req, res) => {
        try {
            const LocationModel = Location_1.default.getModel();
            const errors = locationErrors(req.body, false);
            if (errors)
                return invalid(res, errors);
            const data = { ...req.body, tenantId: 'default_tenant' };
            if (!data.latitude || !data.longitude) {
                const addressStr = `${data.addressLine1} ${data.city} ${data.state} ${data.postalCode} ${data.country}`;
                const coords = (await geocodeAddress(addressStr)) || (await (0, GeoLookup_1.pinCoordinates)(data.postalCode));
                if (coords) {
                    data.latitude = coords.lat;
                    data.longitude = coords.lon;
                }
            }
            const loc = await LocationModel.create(data);
            // Stock recorded before the store had any location moves to the first one.
            if ((await LocationModel.countDocuments({ tenantId: 'default_tenant' })) === 1)
                await InventoryService_1.InventoryService.adoptUnassigned(String(loc._id));
            res.json({ success: true, location: loc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.get('/locations/:id', async (req, res) => {
        try {
            const LocationModel = Location_1.default.getModel();
            const loc = await LocationModel.findById(req.params.id);
            if (!loc)
                return res.status(404).json({ success: false, message: 'Location not found.' });
            // Orders whose shipping was priced from this location.
            const Order = require('../models/Order').getModel();
            const orderCount = await Order.collection.countDocuments({ 'pricing.shippingSnapshot.selectedLocationId': { $in: [loc._id, String(loc._id)] } });
            const [stock] = await InventoryService_1.InventoryService.Level()
                .aggregate([{ $match: { locationId: String(loc._id) } }, { $group: { _id: null, items: { $sum: 1 }, stocked: { $sum: '$stocked' }, reserved: { $sum: '$reserved' }, incoming: { $sum: '$incoming' } } }]);
            res.json({ success: true, location: loc, orderCount, stock: { items: stock?.items || 0, stocked: stock?.stocked || 0, reserved: stock?.reserved || 0, incoming: stock?.incoming || 0 } });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.put('/locations/:id', async (req, res) => {
        try {
            const LocationModel = Location_1.default.getModel();
            const loc = await LocationModel.findById(req.params.id);
            if (!loc)
                return res.status(404).json({ success: false, message: 'Location not found.' });
            const errors = locationErrors(req.body, true);
            if (errors)
                return invalid(res, errors);
            const oldAddress = `${loc.addressLine1} ${loc.city} ${loc.state} ${loc.postalCode} ${loc.country}`;
            Object.assign(loc, req.body);
            const newAddress = `${loc.addressLine1} ${loc.city} ${loc.state} ${loc.postalCode} ${loc.country}`;
            // Coordinates sent with the edit (from the PIN code or typed by hand) are kept; otherwise look the address up.
            const sentCoords = req.body.latitude != null && req.body.latitude !== '' && req.body.longitude != null && req.body.longitude !== '';
            if (!sentCoords && (oldAddress !== newAddress || !loc.latitude || !loc.longitude)) {
                const coords = (await geocodeAddress(newAddress)) || (await (0, GeoLookup_1.pinCoordinates)(loc.postalCode));
                if (coords) {
                    loc.latitude = coords.lat;
                    loc.longitude = coords.lon;
                }
            }
            await loc.save();
            res.json({ success: true, location: loc });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    app.delete('/locations/:id', async (req, res) => {
        try {
            const LocationModel = Location_1.default.getModel();
            // Stock can't disappear with its location: it has to be moved or zeroed first.
            const held = await InventoryService_1.InventoryService.Level().countDocuments({ locationId: String(req.params.id), $or: [{ stocked: { $ne: 0 } }, { reserved: { $ne: 0 } }, { incoming: { $ne: 0 } }] });
            if (held)
                return res.status(409).json({ success: false, message: `This location still holds stock for ${held} item${held === 1 ? '' : 's'}. Move or clear that stock first, or deactivate the location instead.` });
            await InventoryService_1.InventoryService.Level().deleteMany({ locationId: String(req.params.id) });
            await LocationModel.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
};
