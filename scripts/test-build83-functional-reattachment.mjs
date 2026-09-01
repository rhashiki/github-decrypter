import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const fail = message => { throw new Error(`BUILD83_GATE: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const manifest = json('manifest.json');
const packageSpec = json('release/runtime-package.json');
const bridge = read('background/canonical-runtime-entry.js');
const client = read('launcher/canonical-runtime-client.js');
const launcher = read('launcher/launcher-runtime.js');

assert(manifest.version === '2.6.83', 'manifest must be 2.6.83');
assert(manifest.background?.service_worker === 'background/canonical-runtime-entry.js', 'canonical service worker must be the only background entry');
assert(manifest.background?.type === 'module', 'canonical service worker must be module type');
assert(Array.isArray(manifest.permissions) && manifest.permissions.length === 1 && manifest.permissions[0] === 'storage', 'Build83 permissions must be storage-only');
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 1, 'exactly one content-script declaration required');
const scripts = manifest.content_scripts[0]?.js || [];
assert(JSON.stringify(scripts) === JSON.stringify(['launcher/launcher-runtime.js','launcher/canonical-runtime-client.js']), 'only canonical visual launcher + nonvisual runtime client may be injected');

assert(/data-ld-ui-authority['"],\s*['"]canonical-v11/.test(launcher), 'canonical-v11 visual authority must remain intact');
assert(!/MutationObserver|setInterval\s*\(|setTimeout\s*\(/.test(client), 'canonical runtime client cannot poll, observe or schedule timers');
assert(!/MutationObserver|setInterval\s*\(|setTimeout\s*\(|chrome\.alarms|onStartup|onInstalled/.test(bridge), 'canonical bridge cannot poll, observe, schedule timers or alarms');
assert(!/service-worker-entry/.test(bridge), 'old service-worker entry cannot be referenced');
assert(/explicit-user-action-only/.test(bridge), 'bridge must declare explicit-user-action-only activation');
assert(/automaticActivation:\s*false/.test(bridge), 'automatic activation must remain disabled');

const allowedModules = ['tool-runtime','context-pack','scope-intelligence'];
for (const id of allowedModules) assert(bridge.includes(`'${id}'`), `allowed module missing: ${id}`);
for (const forbidden of ['continuity-runtime','local-agent','mcp-runtime','agent-sandbox','native-agent-session','portable-skills']) {
  assert(!new RegExp(`module:\\s*['\"][^'\"]*${forbidden}`).test(bridge), `forbidden phase-1 runtime activation: ${forbidden}`);
}

const requiredPackagePaths = [
  'launcher/launcher-runtime.js',
  'launcher/canonical-runtime-client.js',
  'background/canonical-runtime-entry.js',
  'background/tool-runtime.js',
  'background/context-engine-runtime.js',
  'background/scope-intelligence-runtime.js',
  'core/tool-runtime.js',
  'core/context-engine-v2.js',
  'core/scope-intelligence-v2.js',
  'storage/settings-store.js',
  'github/git-adapter.js',
  'settings/config.js'
];
const packaged = new Set(packageSpec.paths || []);
for (const item of requiredPackagePaths) assert(packaged.has(item), `runtime package missing ${item}`);
assert(!(packageSpec.paths || []).includes('background'), 'whole background root cannot be packaged');
assert(!(packageSpec.paths || []).includes('core'), 'whole core root cannot be packaged');
assert((packageSpec.forbidden_paths || []).includes('background/service-worker-entry.js'), 'old service-worker entry must be explicitly forbidden');

const forbiddenVisualRoots = ['ui','content','diagnostic'];
for (const item of packageSpec.paths || []) {
  const top = String(item).split('/')[0];
  assert(!forbiddenVisualRoots.includes(top), `legacy visual root packaged: ${top}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build83-functional-reattachment-gate/1',
  version: manifest.version,
  visualAuthority: 'canonical-v11',
  backgroundEntry: manifest.background.service_worker,
  automaticActivation: false,
  activeAtBoot: 0,
  lazyModules: allowedModules,
  injectedScripts: scripts,
  packagePaths: packageSpec.paths.length
}, null, 2));
