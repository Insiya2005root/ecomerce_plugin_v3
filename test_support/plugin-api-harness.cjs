// Shared harness for API tests: loads the compiled plugin (api/) the way OpenExt does and routes
// requests to its handlers without a server. Needs MongoDB on 127.0.0.1:27017 (override with
// ECOMMERCE_TEST_MONGO_URL) and nextcmsmains/node_modules for mongoose.
const path = require('path');
const Module = require('module');

// The packaged plugin ships without node_modules; resolve mongoose the same way the OpenExt host does.
const hostModules = path.resolve(__dirname, '..', '..', 'nextcmsmains', 'node_modules');
process.env.NODE_PATH = [hostModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const mongoose = require('mongoose');
const MONGO_URL = process.env.ECOMMERCE_TEST_MONGO_URL || 'mongodb://127.0.0.1:27017';
const pluginDir = path.resolve(__dirname, '..', 'plugin', 'ecommerce-plugin');

// Minimal Express-like app: collects route handlers and dispatches calls to them.
function createApp() {
  const routes = [];
  const app = { middlewares: [async () => {}] };
  for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
    app[method] = (routePath, handler) => routes.push({ method: method.toUpperCase(), routePath, handler });
  }
  app.use = () => {};
  app.call = async (method, url, { body, user = { id: 'admin' } } = {}) => {
    const [pathname, qs = ''] = url.split('?');
    for (const r of routes) {
      if (r.method !== method) continue;
      const names = [];
      const re = new RegExp('^' + r.routePath.replace(/:([^/]+)/g, (_, n) => (names.push(n), '([^/]+)')) + '$');
      const m = pathname.match(re);
      if (!m) continue;
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const query = Object.fromEntries(new URLSearchParams(qs));
      const res = {
        statusCode: 200,
        body: undefined,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        send(payload) { this.body = payload; return this; },
        set(k, v) { this.headers[k] = v; return this; },
        setHeader(k, v) { this.headers[k] = v; },
      };
      await r.handler({ method, path: pathname, params, query, body: body || {}, headers: {}, user }, res);
      return res;
    }
    throw new Error(`No route for ${method} ${pathname}`);
  };
  return app;
}

const cms = {
  database: { user: async () => {} },
  // Same naming as OpenExt (`<pluginId>_<Name>`), so code that relies on plain model names fails here too.
  models: {
    register: (name, schema) => {
      const modelName = `ecommerce-plugin_${name}`;
      return mongoose.models[modelName] || mongoose.model(modelName, schema);
    },
  },
  logger: { info() {}, warn() {}, error() {} },
};

/** Connects to a fresh throwaway database and registers the compiled plugin. */
async function startPlugin(dbName) {
  await mongoose.connect(MONGO_URL, { dbName, serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db.dropDatabase();
  const app = createApp();
  await require(path.join(pluginDir, 'api', 'index.js')).register({ app, cms });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // unique indexes before duplicate checks
  return app;
}

async function stopPlugin() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

/** TEST_SOFT=1 (or legacy PRODUCTS_TEST_SOFT=1) reports every check instead of stopping at the first failure. */
function createChecker() {
  const soft = process.env.TEST_SOFT === '1' || process.env.PRODUCTS_TEST_SOFT === '1';
  const stats = { passed: 0, failed: 0 };
  async function check(name, fn) {
    try {
      await fn();
      stats.passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ ${name}${soft ? ` :: ${String(err.message).split('\n')[0]}` : ''}`);
      if (!soft) throw err;
    }
  }
  return { check, stats };
}

module.exports = { mongoose, pluginDir, startPlugin, stopPlugin, createChecker };
