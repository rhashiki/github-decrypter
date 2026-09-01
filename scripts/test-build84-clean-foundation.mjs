import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const exists = p => fs.existsSync(path.join(root, p));

const manifest = json('manifest.json');
const pkg = json('release/runtime-package.json');
const inventory = json('docs/functional-capabilities-v84.json');
const launcher = read('launcher/launcher-runtime.js');
const client = read('launcher/runtime-client-v84.js');
const account = read('launcher/account-controller-v84.js');
const runtime = read('background/runtime-entry-v84.js');

assert.equal(manifest.version, '2.6.84');
assert.equal(pkg.candidate, '2.6.84');
assert.equal(manifest.background?.service_worker, 'background/runtime-entry-v84.js');
assert.ok(!manifest.background?.type, 'foundation service worker is classic script and must not claim module type');
assert.deepEqual(manifest.permissions || [], ['storage']);
assert.deepEqual(manifest.host_permissions, ['https://lovable.dev/*','https://*.lovable.dev/*','https://kkzxxnfxgrouhkzyszxs.supabase.co/*']);

const app = (manifest.content_scripts || []).find(item => Array.isArray(item.js) && item.js.includes('launcher/launcher-runtime.js'));
assert.ok(app, 'canonical launcher content script missing');
assert.deepEqual(app.js, ['launcher/launcher-runtime.js','launcher/runtime-client-v84.js','launcher/account-controller-v84.js']);
assert.equal(app.run_at, 'document_start');
assert.equal(app.all_frames, false);

assert.match(launcher, /data-ld-ui-authority[^\n]*canonical-v11|canonical-v11/);
assert.ok(client.includes("shadow.addEventListener('click'"));
assert.ok(client.includes("type: 'ld84.runtime.command'"));
assert.ok(client.includes("new CustomEvent('ld84:module-action'"));
assert.ok(runtime.includes("chrome.runtime.onMessage.addListener"));
assert.ok(runtime.includes("mode: 'event-driven'"));
assert.ok(runtime.includes('activeHeavyRuntimes: 0'));
assert.ok(runtime.includes("type === 'ld84.account.status'"));
assert.ok(runtime.includes("type === 'ld84.account.activate'"));
assert.ok(runtime.includes("type === 'ld84.account.clear'"));
assert.ok(runtime.includes("const LICENSE_ENDPOINT = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-license-validate'"));
assert.ok(runtime.includes("id === 'account'"));
assert.ok(account.includes("window.addEventListener('ld84:module-action'"));
assert.ok(account.includes("type: 'ld84.account.activate'"));
assert.ok(account.includes('Este modal pertence à única UI da extensão'));
assert.ok(account.includes('O Lovable continua funcionando normalmente'));

for (const [name, source] of [['launcher', launcher], ['runtime-client', client], ['account-controller', account], ['runtime-entry', runtime]]) {
  assert.ok(!/MutationObserver\s*\(/.test(source), `${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source), `${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source), `${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source), `${name}: network monkeypatch forbidden`);
}

assert.ok(!account.includes('document.body'), 'account controller must not attach to Lovable document body');
assert.ok(account.includes('shadow.appendChild(modal)'), 'account modal must stay inside the single launcher Shadow DOM');
assert.ok(!runtime.includes('setTimeout('), 'runtime bus must not schedule timers at boot');
assert.ok(!runtime.includes('chrome.alarms'), 'runtime bus must not schedule alarms at boot');

const forbiddenRuntimeTokens = [
  'ui-mount-guardian',
  'composer-guardian',
  'composer-bridge-v3',
  'decrypter-chat.js',
  'approval-auto-repair',
  'service-worker-entry.js',
  'canonical-runtime-entry.js'
];
const manifestText = JSON.stringify(manifest);
for (const token of forbiddenRuntimeTokens) assert.ok(!manifestText.includes(token), `legacy runtime leaked into manifest: ${token}`);

assert.equal(inventory.schema, 'ld-functional-capabilities/1');
assert.equal(inventory.build, 84);
assert.equal(inventory.baseline, '2.6.82');
assert.equal(inventory.policy.functional_loss_allowed, false);
assert.equal(inventory.policy.replacement_before_deletion, true);
assert.equal(inventory.policy.single_visual_authority, true);
assert.equal(inventory.policy.global_dom_observers_allowed, false);
assert.equal(inventory.policy.continuous_content_polling_allowed, false);
assert.equal(inventory.policy.lovable_shell_inert_allowed, false);
assert.equal(inventory.policy.heavy_runtime_boot_allowed, false);
assert.ok(Array.isArray(inventory.capabilities) && inventory.capabilities.length >= 45, `capability inventory unexpectedly small: ${inventory.capabilities?.length || 0}`);
const ids = inventory.capabilities.map(item => item.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate capability ids');
for (const item of inventory.capabilities) {
  assert.equal(item.must_preserve, true, `${item.id}: must_preserve must remain true`);
  assert.ok(item.target_authority, `${item.id}: target authority missing`);
  assert.ok(['foundation','planned','reattached','validated'].includes(item.status), `${item.id}: invalid migration status`);
}

for (const required of [
  'license.activation','integration.github','integration.supabase','ai.gateway','ai.local-model','ai.memory','context.pack','scope.intelligence','tools.read','tools.write','mcp.core','mcp.marketplace','recovery.undo-redo','continuity.engine','agent.local','agent.registry','skills.portable','agent.sandbox','agent.native-sessions','updates.center','project.zip-export'
]) assert.ok(ids.includes(required), `functional parity capability missing: ${required}`);

const packagePaths = new Set(pkg.paths || []);
for (const required of ['manifest.json','assets','launcher/launcher-runtime.js','launcher/runtime-client-v84.js','launcher/account-controller-v84.js','background/runtime-entry-v84.js']) {
  assert.ok(packagePaths.has(required), `package path missing: ${required}`);
  assert.ok(exists(required), `package file missing: ${required}`);
}
for (const forbiddenRoot of ['content','ui','core','github','storage','supabase','tools','updates']) {
  assert.ok((pkg.forbidden_roots || []).includes(forbiddenRoot), `forbidden root missing: ${forbiddenRoot}`);
}
for (const forbidden of ['background/service-worker-entry.js','background/canonical-runtime-entry.js','launcher/canonical-runtime-client.js']) {
  assert.ok((pkg.forbidden_paths || []).includes(forbidden), `forbidden path missing: ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build84-clean-foundation/2',
  version: manifest.version,
  capabilitiesLocked: inventory.capabilities.length,
  visualAuthorities: 1,
  globalObservers: 0,
  continuousPolling: 0,
  activeHeavyRuntimesAtBoot: 0,
  legacyDomStackShipped: false,
  functionalLossAllowed: false,
  reattached: ['license.activation'],
  lovableShellBlockedByLicense: false
}, null, 2));
