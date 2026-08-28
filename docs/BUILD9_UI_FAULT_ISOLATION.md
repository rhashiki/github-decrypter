# Build 9 Hotfix 3 — UI Fault Isolation

The launcher shell must boot before feature modules. A feature failure must never prevent the FAB from appearing.

Required boot order:
1. ui-shell-bootstrap
2. core content runtime
3. UI mount guardian
4. main UI
5. feature modules

The fallback shell remains visible until the full FAB is confirmed visible.
