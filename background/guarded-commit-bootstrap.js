import { installGuardedCommit } from '../core/guarded-commit.js';

// Side-effect bootstrap: this module is imported before service-worker.js so
// GitAdapter is guarded before the authoritative runtime registers handlers.
installGuardedCommit();
