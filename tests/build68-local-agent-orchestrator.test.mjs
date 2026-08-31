import fs from 'node:fs';
import assert from 'node:assert/strict';
import { routeLocalModel, classifyLocalTask, LOCAL_MODEL_ROUTER_SCHEMA } from '../core/local-model-router.js';
import {
  localAgentProposalDigest,
  localAgentProposalPaths,
  localAgentProposalPublic,
  normalizeLocalAgentWriteProposal
} from '../core/local-agent-approval.js';
import { mergeSettings } from '../settings/config.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const router = read('core/local-model-router.js');
const approval = read('core/local-agent-approval.js');
const localRuntime = read('background/local-model-runtime.js');
const orchestrator = read('background/local-agent-orchestrator.js');
const toolRuntime = read('background/tool-runtime.js');
const client = read('content/local-agent-orchestrator-client.js');
const ui = read('ui/local-agent-orchestrator-v68.js');
const css = read('ui/local-agent-orchestrator-v68.css');
const gateway = read('runtime/decrypter-local/ollama-gateway.py');
const compose = read('runtime/decrypter-local/compose.yaml');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');
const currentBuild = Number(String(manifest.version || '').split('.').at(-1));

assert.ok(Number.isInteger(currentBuild) && currentBuild >= 68, `Build68 contract requires authoritative build >=68, got ${manifest.version}`);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("LOCAL_MODEL_ROUTER_SCHEMA = 'ld-local-model-router/1'"));
assert.ok(settings.includes("LOCAL_AGENT_SCHEMA = 'ld-local-agent/1'"));
assert.equal(LOCAL_MODEL_ROUTER_SCHEMA, 'ld-local-model-router/1');

assert.deepEqual(manifest.optional_host_permissions, ['https://*/*','http://localhost/*','http://127.0.0.1/*']);
const scripts = manifest.content_scripts[1].js;
const styles = manifest.content_scripts[1].css;
assert.ok(scripts.includes('content/local-agent-orchestrator-client.js'));
assert.ok(scripts.includes('ui/local-agent-orchestrator-v68.js'));
assert.ok(scripts.indexOf('content/local-agent-orchestrator-client.js') < scripts.indexOf('ui/local-agent-orchestrator-v68.js'));
assert.ok(styles.includes('ui/local-agent-orchestrator-v68.css'));
assert.ok(entry.includes("import { installLocalModelRuntime } from './local-model-runtime.js';"));
assert.ok(entry.includes("import { installLocalAgentOrchestrator } from './local-agent-orchestrator.js';"));
assert.ok(entry.includes('installLocalModelRuntime();'));
assert.ok(entry.includes('installLocalAgentOrchestrator();'));

const tiers = { large:'qwen3-coder:30b', medium:'qwen2.5-coder:14b', small:'qwen2.5-coder:7b' };
const loaded = Object.values(tiers);
const complex = routeLocalModel({ command:'Refactor the architecture and authentication security across multiple files', contextFileCount:12, tiers, loadedModels:loaded });
assert.equal(complex.ok, true);
assert.equal(complex.tier, 'large');
assert.equal(complex.model, tiers.large);
assert.equal(complex.paidFallbackAllowed, false);
assert.equal(complex.remoteFallbackAllowed, false);

const degraded = routeLocalModel({ command:'Refactor the architecture and authentication security across multiple files', contextFileCount:12, tiers, loadedModels:[tiers.medium, tiers.small] });
assert.equal(degraded.ok, true);
assert.equal(degraded.tier, 'medium');
assert.equal(degraded.degraded, true);

const pressure = routeLocalModel({ command:'Refactor the architecture and authentication security across multiple files', contextFileCount:12, tiers, loadedModels:loaded, metrics:{inflight:2} });
assert.equal(pressure.ok, true);
assert.equal(pressure.tier, 'medium');
assert.equal(pressure.pressureDegraded, true);

const onlySmall = routeLocalModel({ command:'Implement a feature', desiredTier:'large', tiers, loadedModels:[tiers.small] });
assert.equal(onlySmall.ok, true);
assert.equal(onlySmall.tier, 'small');
const unavailable = routeLocalModel({ command:'Implement a feature', tiers, loadedModels:[] });
assert.equal(unavailable.ok, false);
assert.equal(unavailable.code, 'LOCAL_MODEL_UNAVAILABLE');
assert.equal(unavailable.paidFallbackAllowed, false);
assert.equal(unavailable.remoteFallbackAllowed, false);
assert.equal(classifyLocalTask({ role:'router' }).tier, 'small');

const proposal = normalizeLocalAgentWriteProposal('repo.patch_apply', {
  branch:'main', message:'fix: width', patches:[{ path:'src/App.tsx', expectedBlobSha:'abc123', edits:[{ search:'const width = 360;', replace:'const width = 420;' }] }]
});
const digest1 = await localAgentProposalDigest(proposal);
const digest2 = await localAgentProposalDigest(proposal);
assert.equal(digest1, digest2);
assert.equal(digest1.length, 64);
assert.deepEqual(localAgentProposalPaths(proposal), ['src/App.tsx']);
assert.equal(localAgentProposalPublic(proposal).destructive, false);
const changed = normalizeLocalAgentWriteProposal('repo.patch_apply', {
  branch:'main', patches:[{ path:'src/App.tsx', expectedBlobSha:'abc123', edits:[{ search:'const width = 360;', replace:'const width = 500;' }] }]
});
assert.notEqual(await localAgentProposalDigest(changed), digest1);
await assert.rejects(async () => localAgentProposalDigest({ tool:'repo.write_file', input:{ path:'../secret.txt', action:'update', content:'x', expectedBlobSha:'abc' } }));

const merged = mergeSettings({ localAI:{ endpoint:'https://remote.example.com/v1', paidFallbackAllowed:true, remoteFallbackAllowed:true, maxIterations:99 } });
assert.equal(merged.localAI.endpoint, 'http://127.0.0.1:8000');
assert.equal(merged.localAI.localOnly, true);
assert.equal(merged.localAI.paidFallbackAllowed, false);
assert.equal(merged.localAI.remoteFallbackAllowed, false);
assert.equal(merged.localAI.maxIterations, 12);
const localhost = mergeSettings({ localAI:{ endpoint:'http://localhost:9000' } });
assert.equal(localhost.localAI.endpoint, 'http://localhost:9000');

for (const token of [
  "SESSION_TOKEN_KEY = 'ld68_local_runtime_token_v1'", 'chrome.storage.session.set', "credentials: 'omit'", "redirect: 'error'",
  "provider: 'decrypter-local'", "modelRouter: 'large->medium->small'", 'paidFallbackAllowed: false', 'remoteFallbackAllowed: false',
  'rawPromptPersistence: false', 'rawResponsePersistence: false', "LOCAL_RUNTIME_LOOPBACK_REQUIRED"
]) assert.ok(localRuntime.includes(token), token);

for (const token of [
  'DEFAULT_LOCAL_MODEL_TIERS','qwen3-coder:30b','qwen2.5-coder:14b','qwen2.5-coder:7b',"degradation: 'large->medium->small'",
  "code: 'LOCAL_MODEL_UNAVAILABLE'",'paidFallbackAllowed: false','remoteFallbackAllowed: false'
]) assert.ok(router.includes(token), token);

for (const token of [
  "PORT_NAME = 'ld2-local-agent-orchestrator'", "loop:'plan->context->local-model->tools->approval->write->diff->diagnostics->repair'",
  'buildProjectContextV2','executeLocalChat','materializeProposal','applyTextPatch','assertScopeIntelligence','scopeIntelligenceFingerprint',
  'localAgentProposalDigest',"source:'local-agent-v68'",'humanDecision!==true',"kind:'approval',mode:'read'", "tool:'repo.git_diff'",
  "tool:'diagnostics.run'","LOCAL_AGENT_REHYDRATION_REQUIRED",'rawPromptDurablePersistence:false','rawModelOutputDurablePersistence:false',
  'noPaidFallback:true','noRemoteFallback:true'
]) assert.ok(orchestrator.includes(token), token);

for (const token of [
  'localAgentProposalDigest: text(tx.localAgentProposalDigest)','assertLocalAgentProposalBinding','LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH',
  'localAgentProposalDigestBinding: true',"writePolicy: 'validated-approval+scope-intelligence-v2+continuity-idempotency'"
]) assert.ok(toolRuntime.includes(token), token);

for (const token of ['normalizeLocalAgentWriteProposal','localAgentProposalDigest','repo.patch_apply','repo.write_file']) assert.ok(approval.includes(token), token);

const localSources = `${router}\n${localRuntime}\n${orchestrator}`.toLowerCase();
for (const forbidden of ['api.openai.com','anthropic.com','generativelanguage.googleapis.com','together.ai','runpod.io']) assert.ok(!localSources.includes(forbidden), forbidden);
assert.ok(!localSources.includes('paidfallbackallowed:true'));
assert.ok(!localSources.includes('remotefallbackallowed:true'));

for (const token of ['setRuntimeToken','requestRuntimePermission','approveWrite','humanDecision: true','proposalDigest']) assert.ok(client.includes(token), token);
for (const token of ['Decrypter Local Agent','Aprovar exatamente esta proposta','RUNTIME_TOKEN (somente nesta sessão)','Fallback pago/remoto','data-human-override']) assert.ok(ui.includes(token), token);
assert.ok(css.includes('font-family:Arial'));
assert.ok(css.includes('@media(max-width:760px)'));

for (const token of ['DecrypterOllamaGateway/2.6.68','OLLAMA_MODELS','MODEL_NOT_SERVED','MODEL_NOT_LOADED','local_only']) assert.ok(gateway.includes(token), token);
for (const token of ['OLLAMA_MODEL_LARGE','OLLAMA_MODEL_MEDIUM','OLLAMA_MODEL_SMALL','DECRYPTER_PRELOAD_TIERS','qwen2.5-coder:14b','qwen2.5-coder:7b']) assert.ok(compose.includes(token), token);

assert.match(pkg.notes, /Build68/);
assert.match(pkg.notes, /paid\/remote fallback|paid and remote fallback|zero paid\/remote fallback/i);
assert.match(pkg.notes, /proposal digest/i);
assert.match(pkg.notes, /MCP 2026-07-28 Trust Gateway/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap, /Build 68 — Local Agent Orchestrator \+ Model Router/);
if (currentBuild >= 68) {
  const baseline = roadmap.match(/Status baseline:\s*(?:\*\*)?Build\s+(\d+)/);
  assert.ok(baseline && Number(baseline[1]) >= 68, `roadmap baseline must be >=68, got ${baseline?.[1] || 'missing'}`);
}
if (currentBuild === 68) assert.match(roadmap, /Build 69 — DecrypterBench v2 \/ Hardening is next/);
else assert.match(roadmap, /Build 69 — DecrypterBench v2 \/ Hardening/);
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build68 Local Agent Orchestrator + Model Router cumulative contract OK on authoritative Build ${currentBuild}`);
