import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(String(value||'').match(/^0\.0\.(\d+)$/)?.[1]||-1);

for(const file of [
  'packages/preview/src/index.ts',
  'apps/local/src/preview-browser-adapter.ts',
  'apps/local/src/preview-browser-runtime.ts',
  'docs/architecture/PREVIEW_BROWSER_RUNTIME.md',
  'docs/builds/BUILD_68_PREVIEW_RUNTIME.md',
  'scripts/architecture-guardian-preview-runtime.mjs',
  'scripts/test-build68-preview-runtime-runtime.ts',
  'scripts/test-build68-preview-runtime-guardian-negative.mjs',
  'scripts/tsconfig.build68-tests.json',
  '.github/workflows/build68-preview-runtime.yml',
]) assert.ok(fs.existsSync(file),'Build 68 artifact missing: '+file);

const policy=json('architecture.guardian.json');
const root=json('package.json');
const previewPkg=json('packages/preview/package.json');
const localPkg=json('apps/local/package.json');
const contract=read('packages/preview/src/index.ts');
const adapter=read('apps/local/src/preview-browser-adapter.ts');
const runtime=read('apps/local/src/preview-browser-runtime.ts');
const daemon=read('apps/local/src/daemon.ts');
const roadmap=read('docs/product/ROADMAP_V1.md');

assert.ok(policy.currentBuild>=68);
assert.ok(versionBuild(root.version)>=68);
assert.ok(versionBuild(previewPkg.version)>=68);
assert.ok(versionBuild(localPkg.version)>=68);
assert.equal(policy.phaseGates.previewRuntimeBuild,68);
assert.equal(previewPkg.name,'@github-decrypter/preview');
assert.equal(previewPkg.exports,'./src/index.ts');
assert.deepEqual(previewPkg.dependencies??{},{});
assert.equal(policy.packageRules['@github-decrypter/preview'].environmentNeutral,true);
assert.deepEqual(policy.packageRules['@github-decrypter/preview'].allowedWorkspaceDependencies,[]);
for(const dep of ['@github-decrypter/preview','@github-decrypter/scope','@github-decrypter/tools']) assert.equal(localPkg.dependencies[dep],'workspace:*');

const rule=policy.previewRuntimeAuthority;
assert.equal(rule.minimumBuild,68);
assert.equal(rule.browserFamily,'chromium');
assert.equal(rule.protocol,'cdp');
assert.equal(rule.localBrowserOnly,true);
assert.equal(rule.isolatedProfiles,true);
assert.equal(rule.profilePersistence,false);
assert.equal(rule.sessionTabLifecycle,true);
assert.equal(rule.deterministicCleanup,true);
assert.equal(rule.structuredPageState,true);
assert.equal(rule.visualEvidenceReadOnly,true);
assert.equal(rule.uploadDownloadSupported,true);
assert.equal(rule.transferMode,'ephemeral-inline');
assert.equal(rule.projectFilesystemWrites,false);
assert.equal(rule.toolRuntimeRequired,true);
assert.equal(rule.scopeLockRequiredForMutation,true);
assert.equal(rule.exactScopeResourceBinding,true);
assert.equal(rule.networkCapabilityRequiredForNavigation,true);
assert.equal(rule.systemProfileReuse,false);
assert.equal(rule.credentialExtraction,false);
assert.equal(rule.cloudBrowserRequired,false);
assert.equal(rule.vortexManagedBrowserServiceRequired,false);
assert.equal(rule.vortexManagedPaidInferenceRequired,false);
assert.equal(rule.legacyBrowserRuntimeDependencyAllowed,false);

for(const marker of [
  'PREVIEW_RUNTIME_BUILD = 68',
  "PREVIEW_SESSION_SCHEMA = 'gd-preview-session/1'",
  "PREVIEW_PAGE_STATE_SCHEMA = 'gd-preview-page-state/1'",
  "VISUAL_EVIDENCE_SCHEMA = 'gd-visual-evidence/1'",
  'normalizePreviewUrl(',
  'previewUrlScopeResource(',
  'normalizeVisualEvidenceRequest(',
]) assert.ok(contract.includes(marker),'Missing Preview contract marker: '+marker);

assert.equal(/\bnode:|\bprocess\.|\bfetch\s*\(|\bWebSocket\b|\bchild_process\b|\bfs\./.test(contract),false);

for(const marker of [
  'createChromiumCdpAdapter(',
  '--headless=new',
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=0',
  '--user-data-dir=',
  'DevToolsActivePort',
  "Page.captureScreenshot",
  "Accessibility.getFullAXTree",
  "DOM.setFileInputFiles",
  "Browser.setDownloadBehavior",
]) assert.ok(adapter.includes(marker),'Missing CDP adapter marker: '+marker);

for(const marker of [
  'createPreviewBrowserRuntime(',
  'createToolRegistrations(scopeLock',
  'ensureToolContext(',
  'assertScopedResource(',
  'previewUrlScopeResource(url)',
  'directBrowserAuthorityExposed: false',
  'visualEvidenceReadOnly: true',
]) assert.ok(runtime.includes(marker),'Missing Preview runtime marker: '+marker);

assert.equal(read('apps/local/src/index.ts').includes('preview-browser-adapter'),false);
assert.ok(daemon.includes('get previewBrowser(): PreviewBrowserRuntime'));
assert.ok(daemon.includes('await this.#previewBrowser.shutdown()'));
assert.ok(roadmap.includes('68. **Preview Runtime** — ✅ —'));

assert.ok(root.scripts.guardian.includes('architecture-guardian-preview-runtime.mjs'));
assert.ok(root.scripts['check:build68']);
assert.ok(root.scripts.ci.includes('check:build68'));

console.log(JSON.stringify({
  ok:true,
  schema:'gd-build68-preview-runtime-static/1',
  build:68,
  localChromium:true,
  toolRuntimeGated:true,
  scopeLockedMutations:true,
  visualEvidenceReadOnly:true,
  nextBuild:69,
},null,2));
