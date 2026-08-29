import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const coreSource = fs.readFileSync('content/hardening-core.js', 'utf8');
const registrySource = fs.readFileSync('content/capability-registry.js', 'utf8');
const sentinelSource = fs.readFileSync('content/hardening-sentinel.js', 'utf8');
const chatSource = fs.readFileSync('content/decrypter-chat.js', 'utf8');
const approvalRuntime = fs.readFileSync('background/approval-runtime.js', 'utf8');
const approvalUi = fs.readFileSync('content/approval-auto-repair.js', 'utf8');

assert.equal(manifest.version, '2.4.31');
assert.equal(manifest.version_name, '2.4 Build 31 · Hardening Regression');
assert.match(manifest.action.default_title, /Build 31 · Hardening Regression/);
assert.match(config, /export const VERSION = '2\.4\.31'/);
assert.match(config, /TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const boot = manifest.content_scripts?.[0]?.js || [];
const approvalIndex = boot.indexOf('content/approval-auto-repair.js');
const coreIndex = boot.indexOf('content/hardening-core.js');
const registryIndex = boot.indexOf('content/capability-registry.js');
const sentinelIndex = boot.indexOf('content/hardening-sentinel.js');
assert.ok(approvalIndex >= 0 && coreIndex > approvalIndex && registryIndex > coreIndex && sentinelIndex > registryIndex, 'Build 31 hardening boot order invalid');

const context = { window: {}, console };
context.window.window = context.window;
vm.runInNewContext(coreSource, context, { filename: 'hardening-core.js' });
const core = context.window.LovableDecrypterHardeningCore;
assert.ok(core);
assert.equal(core.build, 31);
assert.equal(core.schema, 'ld-hardening-core/1');
assert.deepEqual([...core.capabilityIds], [
  'workspace.tree',
  'workspace.file',
  'workspace.metadata',
  'workspace.download',
  'project.state_graph',
  'recovery.scan',
  'composer.mount',
  'chat.host',
  'plan.surface',
  'approval.transaction'
]);

const capabilities = core.capabilityIds.map(id => ({ id, required: !['workspace.download', 'recovery.scan'].includes(id), status: 'ready' }));
const ready = core.summarizeCapabilities(capabilities, { routingEnabled: true });
assert.equal(ready.status, 'ready');
const broken = core.summarizeCapabilities(capabilities.map(item => item.id === 'project.state_graph' ? { ...item, status: 'unavailable' } : item), { routingEnabled: true });
assert.equal(broken.status, 'broken');
assert.ok(broken.requiredUnavailable.includes('project.state_graph'));

assert.deepEqual({ ...core.evaluateHardening({ online: true, routingEnabled: false, chat: null, capabilitySummary: ready }) }, { phase: 'READY', reason: 'native_mode', failClosed: false });
assert.equal(core.evaluateHardening({ online: false, routingEnabled: true, chat: { mounted: true, phase: 'READY' }, capabilitySummary: ready }).phase, 'LOCKED');
assert.equal(core.evaluateHardening({ online: true, routingEnabled: true, chat: { mounted: false, phase: 'DEGRADED' }, capabilitySummary: ready }).phase, 'DEGRADED');
assert.equal(core.evaluateHardening({ online: true, routingEnabled: true, chat: { mounted: true, phase: 'BUSY' }, capabilitySummary: ready }).phase, 'BUSY');
assert.equal(core.evaluateHardening({ online: true, routingEnabled: true, chat: { mounted: true, phase: 'READY' }, capabilitySummary: ready }).phase, 'READY');
assert.equal(core.evaluateHardening({ online: true, routingEnabled: true, chat: { mounted: true, phase: 'READY' }, capabilitySummary: broken }).phase, 'DEGRADED');

// Final fail-closed matrix.
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: true, ownSurface: false, kind: 'keydown', composer: true, key: 'Enter' }), true, '1. Enter with Decrypter ON must be blocked from native Lovable');
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: true, ownSurface: false, kind: 'click', composer: true, sendLike: true }), true, '2. Native send click must be blocked');
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: true, ownSurface: false, kind: 'keydown', composer: true, key: 'Enter', shiftKey: true }), false);
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: true, ownSurface: true, kind: 'click', composer: true, sendLike: true }), false, 'Own Decrypter surface must remain usable');
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: false, ownSurface: false, kind: 'submit', composer: true }), false, 'Native mode intentionally restores Lovable');
assert.equal(core.shouldBlockNativeIntent({ routingEnabled: true, ownSurface: false, kind: 'submit', composer: true }), true, '6. Native form submit must be blocked');

for (const name of core.capabilityIds) assert.ok(registrySource.includes(`'${name}'`), `Capability registry missing ${name}`);
assert.match(registrySource, /ld-capability-registry\/1/);
assert.match(sentinelSource, /ld-hardening-state\/1/);
assert.match(sentinelSource, /window\.addEventListener\('online'/);
assert.match(sentinelSource, /window\.addEventListener\('offline'/);
assert.match(sentinelSource, /window\.addEventListener\('popstate'/);
assert.match(sentinelSource, /window\.addEventListener\('hashchange'/);
assert.match(sentinelSource, /ld2:project/);
assert.match(sentinelSource, /ld2:decrypter-chat-state/);
assert.match(sentinelSource, /ld2:composer-guardian-state/);
assert.match(sentinelSource, /safeRemount/);
assert.match(sentinelSource, /native_enter_blocked/);
assert.match(sentinelSource, /native_send_click_blocked/);
assert.match(sentinelSource, /native_form_submit_blocked/);

// 3/4/5/10. Remount/failure/offline never dispatch or transfer a prompt to Lovable.
assert.doesNotMatch(sentinelSource, /new\s+KeyboardEvent|dispatchEvent\(new\s+KeyboardEvent/);
assert.doesNotMatch(sentinelSource, /\.click\(\)|requestSubmit\(|\.submit\(\)/);
assert.doesNotMatch(sentinelSource, /window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);
assert.doesNotMatch(sentinelSource, /new\s+MutationObserver/);
assert.match(chatSource, /LD2_LICENSE_STATUS/);
assert.match(chatSource, /Fail-closed/);
assert.match(chatSource, /nativeFallback:\s*false/);

// 7/8/9. Duplicate Apply/Approve/Skip stays exactly-once at transaction authority.
assert.match(approvalRuntime, /APPROVAL_ALREADY_APPLIED/);
assert.match(approvalRuntime, /APPROVAL_VALIDATION_HASH_CHANGED/);
assert.match(approvalRuntime, /assertHead/);
assert.match(approvalRuntime, /assertRevision/);
assert.match(approvalRuntime, /validatePreparedFiles/);
assert.match(approvalRuntime, /atomicCommit/);
assert.match(approvalUi, /Pular aprovação, não proteções/);
assert.match(approvalUi, /skipHumanApprovalOnly:\s*true/);
assert.match(approvalUi, /scopeWhitelist:\s*true/);
assert.match(approvalUi, /guardedCommit:\s*true/);

console.log(JSON.stringify({
  ok: true,
  build: 31,
  version: manifest.version,
  trust_protocol: '2.4.21',
  capability_registry: true,
  fail_closed_matrix: 10,
  offline_lock: true,
  spa_remount: true,
  exactly_once_apply: true,
  native_fallback: false,
  invasive_network_patch: false,
  automatic_release: false
}, null, 2));
