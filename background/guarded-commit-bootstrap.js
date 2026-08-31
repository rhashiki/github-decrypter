import { installIntegrationWriteGuard } from './integration-readiness-runtime.js';
import { installGuardedCommit } from '../core/guarded-commit.js';

// Build70: production service-worker boot marks the account gate mandatory.
// Isolated unit tests can exercise Guarded Commit without network by omitting
// this bootstrap, but the real extension fails closed if the guard is absent.
globalThis[Symbol.for('ld2.accountIntegration.required')] = true;
installIntegrationWriteGuard();

// Side-effect bootstrap: this module is imported before service-worker.js so
// GitAdapter is guarded before the authoritative runtime registers handlers.
installGuardedCommit();
