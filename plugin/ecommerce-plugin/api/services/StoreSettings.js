"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILE_DEFAULTS = exports.STORE_DEFAULTS = void 0;
exports.getStoreSettings = getStoreSettings;
exports.currentUser = currentUser;
exports.getAdminProfile = getAdminProfile;
const TENANT = 'default_tenant';
exports.STORE_DEFAULTS = {
    name: '',
    legalName: '',
    email: '',
    phone: '',
    gstin: '',
    address: { addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India' },
    orderPrefix: 'ORD-',
    lowStockThreshold: 5,
};
exports.PROFILE_DEFAULTS = { displayName: '', phone: '', jobTitle: '', dashboardDays: 30 };
/** Store details live in a `store` object on the settings document; read raw so a cached schema can't hide them. */
async function getStoreSettings() {
    const Settings = require('../models/Settings').getModel();
    const doc = await Settings.collection.findOne({ tenantId: TENANT }, { projection: { store: 1 } });
    const store = doc?.store || {};
    return { ...exports.STORE_DEFAULTS, ...store, address: { ...exports.STORE_DEFAULTS.address, ...(store.address || {}) } };
}
/** The signed-in OpenExt user (from the host's session token) as the plugin sees it. */
function currentUser(req) {
    const u = req?.user || {};
    const id = String(u.userId || u.id || '');
    return id ? { id, email: u.email ? String(u.email) : '', role: u.role ?? null } : null;
}
async function getAdminProfile(userId) {
    const Profile = require('../models/AdminProfile').getModel();
    const doc = await Profile.collection.findOne({ tenantId: TENANT, userId });
    return { ...exports.PROFILE_DEFAULTS, ...(doc ? { displayName: doc.displayName, phone: doc.phone, jobTitle: doc.jobTitle, dashboardDays: doc.dashboardDays } : {}) };
}
