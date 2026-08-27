import './guarded-commit-bootstrap.js';
import { installCheckpointRuntime } from './checkpoint-runtime.js';
import { installSuggestionsRuntime } from './suggestions-runtime.js';
import { installGithubAppRuntime } from './github-app-runtime.js';
import { installGithubAutoSyncRuntime } from './github-autosync-runtime.js';
import { installSupabaseOAuthRuntime } from './supabase-oauth-runtime.js';
import { installProjectMigrationRuntime } from './project-migration-runtime.js';
import { installLovableProjectRuntime } from './lovable-project-runtime.js';
import './service-worker.js';

installCheckpointRuntime();
installSuggestionsRuntime();
installGithubAppRuntime();
installGithubAutoSyncRuntime();
installSupabaseOAuthRuntime();
installProjectMigrationRuntime();
installLovableProjectRuntime();
