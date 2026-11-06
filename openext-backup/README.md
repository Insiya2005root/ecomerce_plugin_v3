# OpenExt local changes (backup)

Snapshot of uncommitted changes in `nextcmsmains` taken before pulling the "no iframe" OpenExt update.

- `base-commit.txt` – the OpenExt commit these changes sit on.
- `local-changes.patch` – `git diff` of every modified tracked file (ours: nested plugin sidebar in
  `adminNav.ts` / `Sidebar.tsx` / `types/index.ts` / `models/Plugin.ts`, model reload in `sdk.ts`,
  downloads in the plugin runtime page; others' changes: `storage.ts`, `package.json`, compiled theme files).
- `status-at-backup.txt` – `git status --short` at the time (untracked files are listed, not copied).

- `nested-sidebar.patch` – the nested plugin sidebar (adminNav `parent`) re-done on the new no-iframe OpenExt
  (commit 3e8bc1b). Apply inside nextcmsmains with `git apply`; this is the change to hand to the OpenExt team.

- `public-plugin-blocks.patch` – plugin blocks on public pages (and Preview) re-render once the plugin list
  loads; without it they stay blank. Apply inside nextcmsmains with `git apply`.

Restore on the same base commit: `git apply openext-backup/local-changes.patch` (run inside nextcmsmains).

## public-and-page-builder.patch
- `get-plugins` route: logged-out visitors get the active plugins' public block fields only, so plugin blocks render on public pages. Logged-in behaviour unchanged.
- Page builder: plugin blocks whose script exposes `getSettingsSchema()` get a settings form (`PluginSchemaSettings.tsx`) instead of the raw JSON box; the JSON stays under "Advanced".
