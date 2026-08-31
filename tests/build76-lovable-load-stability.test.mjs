import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const agentUi = read('ui/multi-agent-runtime-v74.js');
const accountGate = read('ui/account-integration-gate-v70.js');

assert.equal(manifest.version, '2.6.76');
assert.match(manifest.version_name, /Build 76 · Lovable Load Stability Hotfix/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.76'"));

// Regression guard for the previously observed Lovable freeze class:
// content/UI modules must not observe the entire React document tree.
assert.ok(!agentUi.includes('new MutationObserver'), 'Build74 UI must not create a MutationObserver');
assert.ok(!agentUi.includes('observe(document.documentElement'), 'Build74 UI must not observe documentElement subtree');
assert.ok(agentUi.includes('scheduleTriggerMount'));
assert.ok(agentUi.includes("window.addEventListener('ld2:ui-mounted'"));
assert.ok(agentUi.includes('globalDomObserver:false'));

// Account readiness is security-critical before write, but visual status must not
// hammer two remote providers forever when the account is already ready.
assert.ok(!accountGate.includes('setInterval('), 'Account gate must not use unconditional interval polling');
assert.ok(accountGate.includes('PENDING_POLL_MS = 20000'));
assert.ok(accountGate.includes('shouldPoll = accountReady && !status?.ready'));
assert.ok(accountGate.includes('shouldPoll = false'));
assert.ok(accountGate.includes("document.addEventListener('visibilitychange'"));
assert.ok(accountGate.includes('lastRenderFingerprint'));

assert.match(pkg.notes, /removes the Build74 documentElement-wide MutationObserver/);
assert.match(pkg.notes, /polling stops entirely when integrations are ready/);
console.log('Build76 Lovable Load Stability regression contract OK');
