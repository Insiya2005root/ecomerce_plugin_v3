const https = require('https');

const USER_AGENT = 'NodeJS/ecommerce-plugin';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const CACHE_MAX = 500;

export type PincodeInfo = {
  pin: string;
  city: string;
  state: string;
  country: string;
  /** Post office / area names inside this PIN, e.g. "Athwa", "Adajan". */
  areas: string[];
  latitude: number | null;
  longitude: number | null;
};

// PIN codes rarely change, so successful lookups are kept in memory (avoids hammering the free services).
const cache = new Map<string, { at: number; value: PincodeInfo }>();

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, timeout: TIMEOUT_MS }, (resp: any) => {
      let body = '';
      resp.on('data', (chunk: any) => (body += chunk));
      resp.on('end', () => {
        if (resp.statusCode < 200 || resp.statusCode >= 300) return reject(new Error(`Lookup service answered ${resp.statusCode}`));
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Lookup service sent an unreadable answer'));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Lookup service timed out')));
    req.on('error', reject);
  });
}

/**
 * City, state and map coordinates for an Indian PIN code.
 * India Post gives the district/state and area names; OpenStreetMap gives the PIN's centre point.
 * Returns null when the PIN does not exist; throws when neither service can be reached.
 */
export async function lookupPincode(pin: string): Promise<PincodeInfo | null> {
  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const [post, osm] = await Promise.allSettled([
    getJson(`https://api.postalpincode.in/pincode/${pin}`),
    getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=1&postalcode=${pin}`),
  ]);
  if (post.status === 'rejected' && osm.status === 'rejected') throw new Error('Could not reach the PIN code lookup. Enter the details by hand.');

  const offices: any[] = post.status === 'fulfilled' && post.value?.[0]?.Status === 'Success' ? post.value[0].PostOffice || [] : [];
  const place = osm.status === 'fulfilled' && Array.isArray(osm.value) ? osm.value[0] : null;
  if (!offices.length && !place) return null;

  const first = offices[0] || {};
  const lat = place ? Number(place.lat) : NaN;
  const lon = place ? Number(place.lon) : NaN;
  const value: PincodeInfo = {
    pin,
    city: String(first.District || place?.address?.state_district || place?.address?.city || '').trim(),
    state: String(first.State || place?.address?.state || '').trim(),
    country: 'India',
    areas: [...new Set(offices.map((o) => String(o.Name || '').trim()).filter(Boolean))].slice(0, 30),
    latitude: Number.isFinite(lat) ? Math.round(lat * 1e6) / 1e6 : null,
    longitude: Number.isFinite(lon) ? Math.round(lon * 1e6) / 1e6 : null,
  };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(pin, { at: Date.now(), value });
  return value;
}

/** Map point for a PIN code, or null (never throws) — the fallback when a full street address can't be found. */
export async function pinCoordinates(pin: unknown): Promise<{ lat: number; lon: number } | null> {
  const value = String(pin || '').trim();
  if (!/^[1-9]\d{5}$/.test(value)) return null;
  try {
    const info = await lookupPincode(value);
    return info && info.latitude !== null && info.longitude !== null ? { lat: info.latitude, lon: info.longitude } : null;
  } catch {
    return null;
  }
}
