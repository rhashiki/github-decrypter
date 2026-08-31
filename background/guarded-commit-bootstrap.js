import { installIntegrationWriteGuard } from './integration-readiness-runtime.js';
import { installGuardedCommit } from '../core/guarded-commit.js';

// Build70: install the remote GitHub + Supabase account guard before the
// authoritative Git adapter is patched. No mutating commit may execute without it.
installIntegrationWriteGuard();

// Side-effect bootstrap: this module is imported before service-worker.js so
// GitAdapter is guarded before the authoritative runtime registers handlers.
installGuardedCommit();
