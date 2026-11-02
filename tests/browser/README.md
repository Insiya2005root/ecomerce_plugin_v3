# Browser walkthroughs (Puppeteer)

`server.cjs` serves the built admin (`plugin/ecommerce-plugin/ui/admin`) and the compiled plugin API on
http://localhost:4317 against a throwaway MongoDB database (`ecommerce_plugin_ui_test`, seeded on start).

1. Build first: `cd web && npm run build && npm run package:plugin`
2. `node tests/browser/server.cjs` (wait for "HARNESS READY")
3. In another terminal: `node tests/browser/e2e-inventory.cjs` (or any `e2e*.cjs`)

Restart the server between walkthroughs so each one starts from fresh data. Paths inside the scripts
point at this machine's project folders; adjust them if the repo lives elsewhere.
