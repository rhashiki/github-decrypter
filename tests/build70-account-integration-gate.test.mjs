import fs from 'node:fs';
import assert from 'node:assert/strict';
import { evaluateAccountIntegrationReadiness, assertAccountIntegrationReadiness } from '../core/account-integration-readiness.js';

const read = path => fs.readFileSync(path,'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settingsSource = read('settings/config.js');
const coreSource = read('core/account-integration-readiness.js');
const runtimeSource = read('background/integration-readiness-runtime.js');
const bootstrapSource = read('background/guarded-commit-bootstrap.js');
const guardedSource = read('core/guarded-commit.js');
const clientSource = read('content/integration-readiness-client.js');
const uiSource = read('ui/account-integration-gate-v70.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version,'2.6.70');
assert.match(manifest.version_name,/Build 70 · Account Integration Gate/);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settingsSource.includes("VERSION = '2.6.70'"));
assert.ok(settingsSource.includes("ACCOUNT_INTEGRATION_SCHEMA = 'ld-account-integration-readiness/1'"));
assert.ok(manifest.content_scripts.some(entry => (entry.js || []).includes('content/integration-readiness-client.js')));
assert.ok(manifest.content_scripts.some(entry => (entry.js || []).includes('ui/account-integration-gate-v70.js')));
assert.ok(manifest.content_scripts.some(entry => (entry.css || []).includes('ui/account-integration-gate-v70.css')));

const settings = {
  auth:{ licenseKey:'LD2.test.signature', deviceId:'device-1' },
  github:{ authMode:'github_app', installationId:42, owner:'', repo:'', branch:'main' },
  supabase:{ authMode:'oauth', projectRef:'', projectName:'' },
  projectMappings:{ p1:{ owner:'acme', repo:'frontend', branch:'main' } },
  supabaseMappings:{ p1:{ projectRef:'abcdefghijklmnopqrst', projectName:'Backend' } }
};
const githubReady = {
  app_configured:true,
  connected:true,
  installation:{ id:42, account_login:'acme' },
  repositories:[{ full_name:'acme/frontend', name:'frontend', owner:'acme' }]
};
const supabaseReady = {
  app_configured:true,
  connected:true,
  reauthorize_required:false,
  missing_scopes:[],
  projects:[{ ref:'abcdefghijklmnopqrst', name:'Backend' }]
};

const ready = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:supabaseReady });
assert.equal(ready.ready,true);
assert.equal(ready.github.repository,'acme/frontend');
assert.equal(ready.supabase.projectRef,'abcdefghijklmnopqrst');
assert.equal(assertAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:supabaseReady }).ready,true);

const onlyGithub = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:{ app_configured:true, connected:false } });
assert.equal(onlyGithub.ready,false);
assert.ok(onlyGithub.reasons.some(item => item.code === 'SUPABASE_ACCOUNT_REQUIRED'));

const onlySupabase = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:{ app_configured:true, connected:false }, supabaseStatus:supabaseReady });
assert.equal(onlySupabase.ready,false);
assert.ok(onlySupabase.reasons.some(item => item.code === 'GITHUB_ACCOUNT_REQUIRED'));

const repoRevoked = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:{ ...githubReady, repositories:[] }, supabaseStatus:supabaseReady });
assert.equal(repoRevoked.ready,false);
assert.ok(repoRevoked.reasons.some(item => item.code === 'GITHUB_REPOSITORY_NOT_AUTHORIZED'));

const installChanged = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:{ ...githubReady, installation:{ id:99, account_login:'acme' } }, supabaseStatus:supabaseReady });
assert.equal(installChanged.ready,false);
assert.ok(installChanged.reasons.some(item => item.code === 'GITHUB_INSTALLATION_CHANGED'));

const missingScope = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:{ ...supabaseReady, reauthorize_required:true, missing_scopes:['database:write'] } });
assert.equal(missingScope.ready,false);
assert.ok(missingScope.reasons.some(item => item.code === 'SUPABASE_REAUTHORIZE_REQUIRED'));

const projectRevoked = evaluateAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:{ ...supabaseReady, projects:[] } });
assert.equal(projectRevoked.ready,false);
assert.ok(projectRevoked.reasons.some(item => item.code === 'SUPABASE_PROJECT_NOT_AUTHORIZED'));

const loggedOut = evaluateAccountIntegrationReadiness({ projectId:'p1', settings:{ ...settings, auth:{ licenseKey:'', deviceId:'' } }, githubStatus:githubReady, supabaseStatus:supabaseReady });
assert.equal(loggedOut.ready,false);
assert.ok(loggedOut.reasons.some(item => item.code === 'DECRYPTER_LOGIN_REQUIRED'));

assert.throws(
  () => assertAccountIntegrationReadiness({ projectId:'p1', settings, githubStatus:githubReady, supabaseStatus:{ app_configured:true, connected:false } }),
  error => error?.code === 'ACCOUNT_INTEGRATIONS_REQUIRED' && error?.readiness?.ready === false
);

for (const token of [
  "ld-github-app','status",
  "ld-supabase-manager','status",
  'assertAccountIntegrationReadiness',
  'ACCOUNT_INTEGRATION_PROJECT_MAPPING_AMBIGUOUS',
  'GITHUB_REPOSITORY_MAPPING_MISMATCH',
  'remoteValidationBeforeWrite:true',
  'secretsInExtension:false'
]) assert.ok(runtimeSource.includes(token),token);

assert.ok(bootstrapSource.includes("Symbol.for('ld2.accountIntegration.required')"));
assert.ok(bootstrapSource.indexOf('installIntegrationWriteGuard()') < bootstrapSource.indexOf('installGuardedCommit()'));
assert.ok(guardedSource.includes("Symbol.for('ld2.accountIntegration.writeGuard')"));
assert.ok(guardedSource.includes('ACCOUNT_INTEGRATION_GUARD_UNAVAILABLE'));
assert.ok(guardedSource.includes('await assertAccountWriteGuard(this, branch, options)'));
assert.ok(guardedSource.indexOf('await assertAccountWriteGuard(this, branch, options)') < guardedSource.indexOf('if (createBranch || createPr)'));
assert.ok(guardedSource.includes('accountIntegrationGuarded: true'));

assert.ok(clientSource.includes("ld2-account-integration-readiness"));
assert.ok(uiSource.includes('Conecte GitHub e Supabase'));
assert.ok(uiSource.includes('window.LovableDecrypterIntegrations'));
assert.ok(uiSource.includes('Nenhum PAT, service_role, senha ou token de instalação é salvo na extensão.'));
assert.ok(coreSource.includes('GITHUB_REPOSITORY_NOT_AUTHORIZED'));
assert.ok(coreSource.includes('SUPABASE_PROJECT_NOT_AUTHORIZED'));

for (const forbidden of ['LD_GITHUB_APP_PRIVATE_KEY','LD_SUPABASE_OAUTH_CLIENT_SECRET','refresh_token']) {
  assert.ok(!clientSource.includes(forbidden),`client must not persist ${forbidden}`);
}

assert.match(pkg.notes,/mandatory Account Integration Gate/i);
assert.match(pkg.notes,/GitHub App/i);
assert.match(pkg.notes,/Supabase OAuth/i);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Status baseline: \*\*Build 70 — Account Integration Gate\*\*/);
assert.match(roadmap,/Build 70 — Account Integration Gate 🟡 Core complete \/ production closeout/);
assert.match(roadmap,/Merge to `main`.*remain separately unauthorized/);

console.log('Build70 Account Integration Gate contract OK');
