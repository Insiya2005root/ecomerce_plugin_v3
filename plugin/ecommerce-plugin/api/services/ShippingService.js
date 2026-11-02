"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingService = void 0;
const Settings_1 = __importDefault(require("../models/Settings"));
const Location_1 = __importDefault(require("../models/Location"));
const GeoLookup_1 = require("./GeoLookup");
const https = require('https');
class ShippingService {
    static async geocodeAddress(addressStr) {
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
    static async getRouteDistanceKm(origin, dest) {
        const url = `http://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`;
        return new Promise((resolve, reject) => {
            require('http').get(url, { headers: { 'User-Agent': 'NodeJS/ecommerce-plugin' } }, (resp) => {
                let body = '';
                resp.on('data', (chunk) => body += chunk);
                resp.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                            resolve(data.routes[0].distance / 1000);
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
    static applyRounding(distanceKm, rounding) {
        if (rounding === 'Up')
            return Math.ceil(distanceKm);
        if (rounding === 'Nearest')
            return Math.round(distanceKm);
        return distanceKm; // Exact
    }
    static async calculateShipping(cartTotal, reqBody, engineResult) {
        const SettingsModel = Settings_1.default.getModel();
        const settings = await SettingsModel.findOne({ tenantId: 'default_tenant' }) || {
            shippingMethod: 'Flat', shippingRate: 0, freeShippingThreshold: 0,
            locationSelection: 'Nearest', routeFailureBehaviour: 'Fallback', fallbackShippingCost: 0
        };
        // Flat Shipping
        if (settings.shippingMethod === 'Flat') {
            let amount = settings.shippingRate || 0;
            if (settings.freeShippingThreshold > 0 && cartTotal >= settings.freeShippingThreshold)
                amount = 0;
            if (engineResult && engineResult.appliedDiscounts && engineResult.appliedDiscounts.some((d) => d.isFreeShipping))
                amount = 0;
            return {
                amount,
                snapshot: { shippingMethod: 'Flat', rate: settings.shippingRate, freeShippingApplied: amount === 0 }
            };
        }
        // Distance Based
        const LocationModel = Location_1.default.getModel();
        const allActive = await LocationModel.find({ tenantId: 'default_tenant', status: 'Active' });
        // Settings → Shipping can pin one store as the origin (read raw: older cached schemas drop the field).
        const rawSettings = await SettingsModel.collection.findOne({ tenantId: 'default_tenant' }, { projection: { shipFromLocationId: 1 } });
        const fixedOrigin = rawSettings?.shipFromLocationId
            ? allActive.find((l) => String(l._id) === String(rawSettings.shipFromLocationId) && l.latitude && l.longitude)
            : null;
        const activeLocations = fixedOrigin ? [fixedOrigin] : allActive;
        const locationSelection = fixedOrigin ? 'Nearest' : settings.locationSelection;
        let destinationCoords = null;
        let customerAddressStr = '';
        if (reqBody.customerAddress) {
            customerAddressStr = `${reqBody.customerAddress.addressLine1 || ''} ${reqBody.customerAddress.addressLine2 || ''} ${reqBody.customerAddress.city || ''} ${reqBody.customerAddress.state || ''} ${reqBody.customerAddress.postalCode || ''} ${reqBody.customerAddress.country || 'India'}`.trim();
            destinationCoords = await this.geocodeAddress(customerAddressStr);
            // Street addresses often aren't on the map; the PIN code's centre is a good stand-in.
            if (!destinationCoords)
                destinationCoords = await (0, GeoLookup_1.pinCoordinates)(reqBody.customerAddress.postalCode);
        }
        let finalAmount = settings.fallbackShippingCost || 0;
        let snapshot = {
            shippingMethod: 'Distance',
            freeShippingApplied: false,
            destinationAddress: customerAddressStr,
            ratePerKm: settings.shippingRatePerKm
        };
        if (activeLocations.length === 0 || !destinationCoords) {
            // Can't calculate route -> Fallback
            return { amount: finalAmount, snapshot: { ...snapshot, error: 'No locations or invalid destination' } };
        }
        // Customer Selects Mode -> Provide list of locations with distance
        if (locationSelection === 'CustomerSelect') {
            const availableLocations = [];
            for (let loc of activeLocations) {
                if (loc.latitude && loc.longitude) {
                    const distKm = await this.getRouteDistanceKm({ lat: loc.latitude, lon: loc.longitude }, destinationCoords);
                    if (distKm !== null) {
                        const billable = this.applyRounding(distKm, settings.distanceRounding);
                        const cost = billable * (settings.shippingRatePerKm || 0);
                        availableLocations.push({
                            locationId: loc._id,
                            name: loc.name,
                            address: `${loc.addressLine1}, ${loc.city}`,
                            distanceKm: distKm,
                            billableDistance: billable,
                            shippingCost: cost
                        });
                    }
                }
            }
            availableLocations.sort((a, b) => a.distanceKm - b.distanceKm);
            // If user selected a valid location, use it
            let chosenLocInfo = null;
            if (reqBody.selectedLocationId) {
                chosenLocInfo = availableLocations.find(l => String(l.locationId) === String(reqBody.selectedLocationId));
            }
            // Default to nearest if none selected yet but we need to return something
            if (!chosenLocInfo && availableLocations.length > 0) {
                chosenLocInfo = availableLocations[0];
            }
            if (chosenLocInfo) {
                const locObj = activeLocations.find(l => String(l._id) === String(chosenLocInfo.locationId));
                finalAmount = chosenLocInfo.shippingCost;
                snapshot = {
                    ...snapshot,
                    selectedLocationId: locObj._id,
                    originName: locObj.name,
                    originAddress: `${locObj.addressLine1}, ${locObj.city}`,
                    actualDistance: chosenLocInfo.distanceKm,
                    billableDistance: chosenLocInfo.billableDistance,
                    calculatedShipping: finalAmount
                };
            }
            else {
                return { amount: finalAmount, snapshot: { ...snapshot, error: 'Route failed for all locations' } };
            }
            // Apply Free Shipping Threshold
            if (settings.freeShippingThreshold > 0 && cartTotal >= settings.freeShippingThreshold) {
                finalAmount = 0;
                snapshot.freeShippingApplied = true;
            }
            if (engineResult && engineResult.appliedDiscounts && engineResult.appliedDiscounts.some((d) => d.isFreeShipping)) {
                finalAmount = 0;
                snapshot.freeShippingApplied = true;
            }
            return { amount: finalAmount, snapshot, availableLocations };
        }
        // Nearest Mode
        let nearestLoc = null;
        let shortestDist = Infinity;
        for (let loc of activeLocations) {
            if (loc.latitude && loc.longitude) {
                const distKm = await this.getRouteDistanceKm({ lat: loc.latitude, lon: loc.longitude }, destinationCoords);
                if (distKm !== null && distKm < shortestDist) {
                    shortestDist = distKm;
                    nearestLoc = loc;
                }
            }
        }
        if (nearestLoc && shortestDist !== Infinity) {
            const billable = this.applyRounding(shortestDist, settings.distanceRounding);
            finalAmount = billable * (settings.shippingRatePerKm || 0);
            snapshot = {
                ...snapshot,
                selectedLocationId: nearestLoc._id,
                originName: nearestLoc.name,
                originAddress: `${nearestLoc.addressLine1}, ${nearestLoc.city}`,
                actualDistance: shortestDist,
                billableDistance: billable,
                calculatedShipping: finalAmount
            };
        }
        else {
            // Fallback
            snapshot.error = 'Route failed for nearest location search';
        }
        // Apply Free Shipping Threshold
        if (settings.freeShippingThreshold > 0 && cartTotal >= settings.freeShippingThreshold) {
            finalAmount = 0;
            snapshot.freeShippingApplied = true;
        }
        if (engineResult && engineResult.appliedDiscounts && engineResult.appliedDiscounts.some((d) => d.isFreeShipping)) {
            finalAmount = 0;
            snapshot.freeShippingApplied = true;
        }
        return { amount: finalAmount, snapshot };
    }
}
exports.ShippingService = ShippingService;
