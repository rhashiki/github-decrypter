import './guarded-commit-bootstrap.js';
import { installCheckpointRuntime } from './checkpoint-runtime.js';
import { installSuggestionsRuntime } from './suggestions-runtime.js';
import './service-worker.js';

installCheckpointRuntime();
installSuggestionsRuntime();
