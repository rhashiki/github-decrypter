import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  CONTINUITY_SCHEMA, CONTINUITY_STORAGE_KEY, createContinuityTask, defineContinuitySteps,
  claimContinuityStep, completeContinuityStep, failContinuityStep, resolveAmbiguousWrite,
  recoverExpiredContinuityLeases, getContinuityTask, taskNeedsAttention
} from '../core/continuity-engine.js';

const memory = {};
globalThis.chrome = { storage: { local: {
  async get(key) { return typeof key === 'string' ? { [key]: memory[key] } : { ...memory }; },
  async set(values) { Object.assign(memory, structuredClone(values)); }
} } };

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const runtime = read('background/continuity-runtime.js');
const core = read('core/continuity-engine.js');
const toolRuntime = read('background/tool-runtime.js');
const toolClient = read('content/tool-runtime-client.js');
const client = read('content/continuity-runtime-client.js');
const journal = read('core/operation-journal.js');
const ui = read('ui/continuity-engine-v67.js');
const css = read('ui/continuity-engine-v67.css');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');
const currentBuild = Number(String(manifest.version || '').split('.').at(-1));

assert.ok(Number.isInteger(currentBuild) && currentBuild >= 67);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.equal(CONTINUITY_SCHEMA, 'ld-continuity-task/1');
assert.ok(settings.includes("CONTINUITY_ENGINE_SCHEMA = 'ld-continuity-task/1'"));
assert.ok(entry.includes("installContinuityRuntime();"));
assert.ok(manifest.content_scripts[1].js.includes('content/continuity-runtime-client.js'));
assert.ok(manifest.content_scripts[1].js.includes('ui/continuity-engine-v67.js'));
assert.ok(manifest.content_scripts[1].css.includes('ui/continuity-engine-v67.css'));

for (const token of ['verification_required','idempotencyKey','leaseToken','CONTINUITY_WRITE_VERIFICATION_REQUIRED','CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED','recoverExpiredContinuityLeases','compactContinuityTask']) assert.ok(core.includes(token), token);
for (const token of ["RECOVERY_ALARM = 'ld67-continuity-recovery'",'periodInMinutes: 1',"reason: 'service-worker-start'",'mark-completed-from-operation-journal','verified-no-write-safe-to-retry','rawPromptPersistence: false','rawModelOutputPersistence: false','rawFileContentPersistence: false']) assert.ok(runtime.includes(token), token);
for (const token of ['checkpointWriteHead',"type: 'git-head-before-write'",'continuityReplay',"code: 'IDEMPOTENT_REPLAY'",'writeRepeated: false',"writePolicy: 'validated-approval+scope-intelligence-v2+continuity-idempotency'",'ambiguousWriteRetryRequiresVerification: true']) assert.ok(toolRuntime.includes(token), token);
assert.ok(toolClient.includes('options.continuity'));
assert.ok(journal.includes('idempotencyKey: text(context?.idempotencyKey'));
for (const token of ['verifyWrite(taskId','Retomar do último passo verificado','Verificar write ambíguo','Writes ambíguos nunca são repetidos']) assert.ok(`${client}\n${ui}`.includes(token), token);
assert.ok(css.includes('@media(max-width:760px)'));

const secret = 'SUPER_SECRET_COMMAND_SHOULD_NOT_PERSIST';
const task0 = await createContinuityTask({ projectId:'p1', repo:'acme/app', branch:'main', command:secret });
assert.ok(task0.commandDigest && !JSON.stringify(memory).includes(secret));
await defineContinuitySteps(task0.id, [
  { idempotencyKey:'infer:1', label:'Inference', kind:'inference', mode:'inference', maxAttempts:3 },
  { idempotencyKey:'write:1', label:'Write', kind:'tool', mode:'write', retrySafe:true, maxAttempts:2 }
]);
let claim = await claimContinuityStep({ taskId:task0.id, idempotencyKey:'infer:1', workerId:'a' });
await failContinuityStep({ taskId:task0.id, idempotencyKey:'infer:1', leaseToken:claim.leaseToken, errorCode:'MODEL_CRASH', outcomeUnknown:false });
let task = await getContinuityTask(task0.id);
assert.equal(task.status, 'interrupted');
claim = await claimContinuityStep({ taskId:task0.id, idempotencyKey:'infer:1', workerId:'b' });
await completeContinuityStep({ taskId:task0.id, idempotencyKey:'infer:1', leaseToken:claim.leaseToken, outputDigest:'out' });
assert.equal((await claimContinuityStep({ taskId:task0.id, idempotencyKey:'infer:1' })).replay, true);

claim = await claimContinuityStep({ taskId:task0.id, idempotencyKey:'write:1', workerId:'a' });
const stored = memory[CONTINUITY_STORAGE_KEY].find(row => row.id === task0.id).steps.find(step => step.idempotencyKey === 'write:1');
stored.checkpoint = { type:'git-head-before-write', reference:'abc123', digest:'d1', verified:true, createdAt:new Date().toISOString() };
await failContinuityStep({ taskId:task0.id, idempotencyKey:'write:1', leaseToken:claim.leaseToken, errorCode:'NETWORK_LOST', outcomeUnknown:true });
task = await getContinuityTask(task0.id);
assert.equal(task.status, 'verification_required');
assert.equal(taskNeedsAttention(task), true);
await assert.rejects(() => claimContinuityStep({ taskId:task0.id, idempotencyKey:'write:1' }), error => error?.code === 'CONTINUITY_WRITE_VERIFICATION_REQUIRED');
await resolveAmbiguousWrite({ taskId:task0.id, idempotencyKey:'write:1', verifiedAbsent:true });
claim = await claimContinuityStep({ taskId:task0.id, idempotencyKey:'write:1', workerId:'c' });
await assert.rejects(() => completeContinuityStep({ taskId:task0.id, idempotencyKey:'write:1', leaseToken:claim.leaseToken }), error => error?.code === 'CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED');
await completeContinuityStep({ taskId:task0.id, idempotencyKey:'write:1', leaseToken:claim.leaseToken, operationId:'op1', commitSha:'deadbeef', outputDigest:'done' });
const replay = await claimContinuityStep({ taskId:task0.id, idempotencyKey:'write:1' });
assert.equal(replay.replay, true);
assert.equal(replay.resultRef.commitSha, 'deadbeef');

for (const mode of ['read','write']) {
  const crash = await createContinuityTask({ projectId:`crash-${mode}`, repo:'acme/app', branch:'main', command:`${mode} task` });
  await defineContinuitySteps(crash.id, [{ idempotencyKey:`${mode}:crash`, label:'Crash', kind:'tool', mode, retrySafe:true, maxAttempts:2 }]);
  await claimContinuityStep({ taskId:crash.id, idempotencyKey:`${mode}:crash` });
  memory[CONTINUITY_STORAGE_KEY].find(row => row.id === crash.id).steps[0].leaseUntil = '2000-01-01T00:00:00.000Z';
  const recovered = await recoverExpiredContinuityLeases({ reason:'test-crash' });
  assert.ok(recovered.recovered.some(item => item.taskId === crash.id && item.status === (mode === 'write' ? 'verification_required' : 'interrupted')));
}

assert.match(pkg.notes, /Build67/);
assert.match(pkg.notes, /MCP 2026-07-28 Trust Gateway/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap, /Build 67 — Continuity Engine/);
assert.match(roadmap, /Build 68 — Local Agent Orchestrator \+ Model Router/);
if (currentBuild >= 68) {
  const baseline = roadmap.match(/Status baseline: Build (\d+)/);
  assert.ok(baseline && Number(baseline[1]) >= 68, `roadmap baseline must be >=68 for successor builds, got ${baseline?.[1] || 'missing'}`);
}
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build67 Continuity Engine cumulative contract OK on authoritative Build ${currentBuild}`);
