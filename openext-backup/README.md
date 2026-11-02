# OpenExt local changes (backup)

Snapshot of uncommitted changes in `nextcmsmains` taken before pulling the "no iframe" OpenExt update.

- `base-commit.txt` – the OpenExt commit these changes sit on.
- `local-changes.patch` – `git diff` of every modified tracked file (ours: nested plugin sidebar in
  `adminNav.ts` / `Sidebar.tsx` / `types/index.ts` / `models/Plugin.ts`, model reload in `sdk.ts`,
  downloads in the plugin runtime page; others' changes: `storage.ts`, `package.json`, compiled theme files).
- `status-at-backup.txt` – `git status --short` at the time (untracked files are listed, not copied).

Restore on the same base commit: `git apply openext-backup/local-changes.patch` (run inside nextcmsmains).
