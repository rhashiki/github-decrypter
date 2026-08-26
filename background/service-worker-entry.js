import { installGuardedCommit } from '../core/guarded-commit.js';

installGuardedCommit();
await import('./service-worker.js');
