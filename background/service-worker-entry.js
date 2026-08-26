import { installGuardedCommit } from '../core/guarded-commit.js';
import { installCheckpointRuntime } from './checkpoint-runtime.js';

installGuardedCommit();
installCheckpointRuntime();
await import('./service-worker.js');
