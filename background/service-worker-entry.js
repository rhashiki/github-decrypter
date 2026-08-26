import { installGuardedCommit } from '../core/guarded-commit.js';
import { installCheckpointRuntime } from './checkpoint-runtime.js';
import { installSuggestionsRuntime } from './suggestions-runtime.js';

installGuardedCommit();
installCheckpointRuntime();
installSuggestionsRuntime();
await import('./service-worker.js');
