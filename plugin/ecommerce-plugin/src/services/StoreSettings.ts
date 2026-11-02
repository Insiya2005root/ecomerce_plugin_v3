const TENANT = 'default_tenant';

export const STORE_DEFAULTS = {
  name: '',
  legalName: '',
  email: '',
  phone: '',
  gstin: '',
  address: { addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India' },
  orderPrefix: 'ORD-',
  lowStockThreshold: 5,
};

export const PROFILE_DEFAULTS = { displayName: '', phone: '', jobTitle: '', dashboardDays: 30 };

/** Store details live in a `store` object on the settings document; read raw so a cached schema can't hide them. */
export async function getStoreSettings() {
  const Settings = require('../models/Settings').getModel();
  const doc = await Settings.collection.findOne({ tenantId: TENANT }, { projection: { store: 1 } });
  const store = doc?.store || {};
  return { ...STORE_DEFAULTS, ...store, address: { ...STORE_DEFAULTS.address, ...(store.address || {}) } };
}

/** The signed-in OpenExt user (from the host's session token) as the plugin sees it. */
export function currentUser(req: any) {
  const u = req?.user || {};
  const id = String(u.userId || u.id || '');
  return id ? { id, email: u.email ? String(u.email) : '', role: u.role ?? null } : null;
}

export async function getAdminProfile(userId: string) {
  const Profile = require('../models/AdminProfile').getModel();
  const doc = await Profile.collection.findOne({ tenantId: TENANT, userId });
  return { ...PROFILE_DEFAULTS, ...(doc ? { displayName: doc.displayName, phone: doc.phone, jobTitle: doc.jobTitle, dashboardDays: doc.dashboardDays } : {}) };
}
