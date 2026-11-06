# Browser walkthroughs (Puppeteer)

`server.cjs` is a local stand-in for OpenExt's no-iframe plugin runtime on http://localhost:4317:
`/dashboard/plugins/runtime/ecommerce-plugin/<navId>` renders a sidebar from `manifest.json` adminNav and a
`div#plugin-root`, imports `ui/admin/mount.js` and calls `mount(el, ctx)` the way OpenExt does (including
`manifest.styles` under `@scope (#plugin-root)`, OpenExt's own global CSS rules, and `window.next.router`).
It also serves the compiled plugin API against a throwaway MongoDB database (`ecommerce_plugin_ui_test`,
seeded on start). Old page URLs (`/plugins/ecommerce-plugin/ui/admin/<page>/index.html`) redirect to the
matching runtime URL.

1. Build first: `cd web && npm run build` (and `npm run package:plugin` for the ZIP)
2. Run everything: `node tests/browser/run-all.cjs` — or a subset: `node tests/browser/run-all.cjs e2e-inventory.cjs`

`run-all.cjs` restarts the server before each walkthrough so each one starts from fresh data. To poke around
by hand, run `node tests/browser/server.cjs` and open the URL it prints. Paths inside the scripts point at
this machine's project folders; adjust them if the repo lives elsewhere.
