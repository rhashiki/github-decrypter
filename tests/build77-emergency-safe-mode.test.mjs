import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const pkg=JSON.parse(read('release/runtime-package.json'));
const settings=read('settings/config.js');
const sw=read('background/service-worker-entry.js');
const pageJs=manifest.content_scripts.flatMap(x=>x.js||[]);
const pageCss=manifest.content_scripts.flatMap(x=>x.css||[]);

assert.equal(manifest.version,'2.6.77');
assert.match(manifest.version_name,/Build 77 · Emergency Safe Mode/);
assert.equal(pkg.candidate,'2.6.77');
assert.ok(settings.includes("VERSION = '2.6.77'"));

const disabledPageModules=[
  'content/integration-callback-bridge.js',
  'content/agent-runtime-registry-client.js',
  'content/portable-skills-client.js',
  'content/agent-sandbox-client.js',
  'content/native-agent-session-client.js',
  'content/integration-readiness-client.js',
  'ui/portable-skills-v72.js',
  'ui/account-integration-gate-v70.js',
  'ui/multi-agent-runtime-v74.js'
];
for(const file of disabledPageModules)assert.ok(!pageJs.includes(file),`safe mode must not inject ${file}`);
assert.ok(!pageCss.includes('ui/account-integration-gate-v70.css'));
assert.ok(!pageCss.includes('ui/multi-agent-runtime-v74.css'));

const disabledBackground=[
  'installIntegrationReadinessRuntime',
  'installIntegrationCallbackRuntime',
  'installAgentRuntimeRegistryRuntime',
  'installPortableSkillsRuntime',
  'installAgentSandboxRuntime',
  'installNativeAgentSessionRuntime'
];
for(const token of disabledBackground)assert.ok(!sw.includes(token),`safe mode must not install ${token}`);

const requiredBuild69=[
  'content/tool-runtime-client.js',
  'content/mcp-runtime-client.js',
  'content/context-engine-client.js',
  'content/reversible-operations-client.js',
  'content/continuity-runtime-client.js',
  'content/local-agent-orchestrator-client.js',
  'ui/local-agent-orchestrator-v68.js'
];
for(const file of requiredBuild69)assert.ok(pageJs.includes(file),`Build69 core missing ${file}`);
for(const token of ['installToolRuntime','installMcpRuntime','installContextEngineRuntime','installReversibleOperationsRuntime','installContinuityRuntime','installLocalModelRuntime','installLocalAgentOrchestrator'])assert.ok(sw.includes(token),`Build69 background core missing ${token}`);

assert.match(pkg.notes,/containment release/i);
assert.match(pkg.notes,/not a claim that the exact leak source is fully isolated/i);
console.log('Build77 Emergency Safe Mode containment contract OK');
