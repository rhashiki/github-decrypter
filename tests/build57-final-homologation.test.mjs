import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const homologation = JSON.parse(read('release/homologation-v2.5.57.json'));
const settings = read('settings/config.js');
const ui = read('ui/ui.js');
const kernel = read('ui/ui-kernel-v48.js');
const kernelCss = read('ui/ui-kernel-v48.css');
const chat = read('content/decrypter-chat.js');
const chatCss = read('ui/chat-activation-premium-v45.css');
const skillRouter = read('content/skill-router.js');
const zeroGuard = read('content/zero-cost-runtime-guard.js');
const gatewayBootstrap = read('background/model-gateway-bootstrap.js');
const gateway = read('supabase/functions/ld-model-gateway/index.ts');
const githubRuntime = read('background/github-app-runtime.js');
const supabaseRuntime = read('background/supabase-oauth-runtime.js');
const integrations = read('ui/integrations-v49.js');
const messagingRuntime = read('background/messaging-runtime.js');
const messagingClient = read('ui/backend-messaging-v55.js');
const messagingBackend = read('supabase/functions/ld-messaging/index.ts');
const updateCenter = read('ui/update-center-v54.js');
const updateRuntime = read('background/update-recovery-runtime.js');
const projectTools = read('ui/project-tools-v52.js');
const content = read('content/content.js');
const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/ui-kernel-v48.js'));

const gates = [];
const gate = (id, name, fn) => {
  fn();
  gates.push({ id, name });
};

// 1 — version/package coherence
gate(1, 'version-package-coherence', () => {
  assert.equal(manifest.version, '2.5.57');
  assert.match(manifest.version_name, /Build 57 · Final Homologation RC/);
  assert.equal(pkg.candidate, '2.5.57');
  assert.ok(settings.includes("VERSION = '2.5.57'"));
  assert.equal(homologation.version, '2.5.57');
  assert.equal(homologation.release_authorized, false);
  assert.equal(homologation.ota_authorized, false);
});

// 2 — permissions/host boundary
gate(2, 'permissions-and-host-boundary', () => {
  assert.deepEqual(manifest.permissions, ['storage','tabs','downloads','unlimitedStorage','alarms']);
  assert.ok(manifest.host_permissions.every(host => /^https:\/\//.test(host)));
  assert.ok(!manifest.permissions.includes('debugger'));
  assert.ok(!manifest.permissions.includes('webRequestBlocking'));
});

// 3 — activation gate remains fail-closed
gate(3, 'activation-gate-fail-closed', () => {
  assert.ok(ui.includes('data-license-gate hidden'));
  assert.ok(ui.includes('const licensed = await ensureLicense(root)'));
  assert.ok(ui.includes('if (licensed) await refresh(root)'));
});

// 4 — one authoritative UI kernel
gate(4, 'single-ui-kernel-authority', () => {
  assert.ok(app);
  assert.ok(app.js.includes('ui/ui-kernel-v48.js'));
  assert.ok(kernel.includes('LovableDecrypterUIActions'));
  for (const legacy of ['ui/unified-launcher.js','ui/launcher-rail-v3.js','ui/premium-engineering-ux.js','ui/premium-project-tools.js']) assert.ok(!app.js.includes(legacy));
});

// 5 — legacy files physically absent
gate(5, 'legacy-artifacts-physically-absent', () => {
  for (const path of ['ui/voice-feedback.js','ui/unified-launcher.js','ui/launcher-rail-v3.js','ui/premium-engineering-ux.js','ui/premium-project-tools.js','ui/nexus-parity-v47.css']) assert.equal(fs.existsSync(path), false, path);
});

// 6 — approved FAB/cascade/responsive visual contract
gate(6, 'fab-cascade-responsive-visual-contract', () => {
  for (const token of ['conic-gradient','rotate(360deg)','ld48-cascade','@media(max-width:760px)','font-family:Arial']) assert.ok(kernelCss.includes(token), token);
});

// 7 — monitor enabled/disabled visual state
gate(7, 'monitor-visual-state-contract', () => {
  assert.ok(kernelCss.includes('.ld48-monitor[data-enabled="0"] .ld48-dot'));
  assert.ok(kernelCss.includes('background:#ff637d'));
  assert.ok(kernelCss.includes('.ld48-monitor .ld48-dot'));
});

// 8 — Decrypter Chat isolates native bridge when active
gate(8, 'decrypter-chat-native-bridge-isolation', () => {
  assert.ok(chatCss.includes('html[data-ld45-chat-active="1"] .ld2-native-bridge{display:none!important}'));
  assert.ok(chat.includes('lockNativeShell'));
  assert.ok(chat.includes("shell.inert = true"));
});

// 9 — protected chat runtime
gate(9, 'decrypter-chat-protected-runtime', () => {
  for (const token of ['LD2_PLAN_ONLY','LD2_BUILD_EXECUTE','MAX_ATTACHMENTS','MAX_TOTAL_BYTES','routingEnabled']) assert.ok(chat.includes(token), token);
  assert.ok(!/XMLHttpRequest\.prototype|sendBeacon\s*=/.test(chat));
});

// 10 — Auto Skill plus Project Rules ordering
gate(10, 'auto-skill-and-project-rules-order', () => {
  assert.ok(app.js.indexOf('content/skill-router.js') < app.js.indexOf('content/project-rules-cache.js'));
  assert.ok(skillRouter.includes('Project Rules hydrate first'));
  assert.ok(skillRouter.includes('NÃO alteram o pedido original do usuário'));
  assert.ok(skillRouter.includes('MAX_SKILLS = 8'));
});

// 11 — GitHub App backend authority
gate(11, 'github-app-oauth-backend-contract', () => {
  for (const token of ["PORT_NAME = 'ld2-github-app'",'/ld-github-app','x-license-key','x-device-id']) assert.ok(githubRuntime.includes(token), token);
  assert.ok(integrations.includes("portCall('ld2-github-app'"));
});

// 12 — Supabase OAuth backend authority
gate(12, 'supabase-oauth-backend-contract', () => {
  for (const token of ["PORT_NAME = 'ld2-supabase-oauth'",'ld-supabase-oauth','ld-supabase-manager']) assert.ok(supabaseRuntime.includes(token), token);
  assert.ok(integrations.includes("portCall('ld2-supabase-oauth'"));
});

// 13 — messaging is server-authoritative
gate(13, 'server-authoritative-messaging', () => {
  for (const token of ['LD2_MESSAGE_RESOLVE','LD2_MESSAGE_NORMALIZE','/ld-messaging']) assert.ok(messagingRuntime.includes(token), token);
  assert.ok(messagingClient.includes('backendAuthority:true'));
  assert.ok(messagingClient.includes('localCatalog:false'));
  assert.ok(messagingBackend.includes("authority: 'backend'"));
  assert.ok(!messagingClient.includes('const MESSAGES'));
});

// 14 — natural pt-BR voice remains client renderer only
gate(14, 'natural-ptbr-voice-contract', () => {
  for (const token of ['SpeechSynthesisUtterance','pickNaturalVoice']) assert.ok(messagingClient.includes(token), token);
  assert.ok(messagingBackend.includes('preferNatural: true'));
});

// 15 — zero paid model policy at UI/runtime/agent gateway/server gateway
gate(15, 'zero-paid-model-policy', () => {
  assert.ok(app.js.includes('content/zero-cost-runtime-guard.js'));
  assert.ok(app.js.indexOf('content/zero-cost-runtime-guard.js') > app.js.indexOf('ui/ui.js'));
  for (const token of ["billingMode: 'free'",'zeroCost: true','paidModeAllowed: false']) assert.ok(zeroGuard.includes(token), token);
  assert.ok(gatewayBootstrap.includes("this.billingMode = 'free'"));
  assert.ok(gatewayBootstrap.includes("gemini_billing_mode: 'free'"));
  assert.ok(gatewayBootstrap.includes('paidModeAllowed: false'));
  assert.ok(gateway.includes("code:'ZERO_COST_PAID_MODE_FORBIDDEN'"));
  assert.ok(gateway.includes('paid_mode_allowed:false'));
  assert.ok(gateway.includes("const billingMode='free'"));
  assert.ok(settings.includes("merged.gemini.billingMode='free'"));
  assert.ok(settings.includes('merged.gemini.zeroCost=true'));
});

// 16 — no invasive global network monkeypatch introduced
gate(16, 'no-invasive-network-monkeypatch', () => {
  const sources = [zeroGuard,gatewayBootstrap,kernel,integrations,messagingClient,content];
  for (const source of sources) {
    assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source));
  }
});

// 17 — signed update / stable rollback authority
gate(17, 'signed-update-rollback-stable-only', () => {
  for (const token of ['verified','rollback','stable']) assert.ok((updateCenter + updateRuntime).toLowerCase().includes(token), token);
  assert.ok(updateRuntime.includes('sha256') || updateRuntime.includes('SHA-256'));
});

// 18 — direct project ZIP export
gate(18, 'direct-project-zip-export', () => {
  for (const token of ["registry.register('zip'","type:'LD2_GITHUB_ZIP_BYTES'",'application/zip','URL.createObjectURL(blob)']) assert.ok(projectTools.includes(token), token);
});

// 19 — event-driven project detection + homologation/preflight boundary
gate(19, 'event-driven-performance-and-release-preflight', () => {
  assert.ok(!/setInterval\s*\(/.test(content));
  assert.ok(content.includes("window.navigation?.addEventListener?.('navigate', scheduleAnnounce)"));
  assert.ok(content.includes('queueMicrotask(announce)'));
  assert.equal(homologation.gates.length, 19);
  assert.deepEqual(homologation.gates.map(item => item.id), Array.from({length:19}, (_,i)=>i+1));
});

assert.equal(gates.length, 19);
for (const expected of homologation.gates) {
  const actual = gates.find(item => item.id === expected.id);
  assert.equal(actual?.name, expected.name, `homologation gate mismatch ${expected.id}`);
}

console.log(`Build57 Final Homologation RC OK · ${gates.length}/19 gates passed`);
