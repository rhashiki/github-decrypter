import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  CONTINUITY_SCHEMA,
  CONTINUITY_STORAGE_KEY,
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  resolveAmbiguousWrite,
  recoverExpiredContinuityLeases,
  getContinuityTask,
  taskNeedsAttention
} from '../core/continuity-engine.js';

const memory = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: memory[key] };
        return { ...memory };
      },
      async set(values) { Object.assign(memory, structuredClone(values)); }
    }
  }
};

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

assert.ok(Number.isInteger(currentBuild) && currentBuild >= 67, `Build67 contract requires authoritative Build >=67, received ${manifest.version}`);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("CONTINUITY_ENGINE_SCHEMA = 'ld-continuity-task/1'"));
assert.equal(CONTINUITY_SCHEMA, 'ld-continuity-task/1');

assert.ok(entry.includes("import { installContinuityRuntime } from './continuity-runtime.js';"));
assert.ok(entry.includes('installContinuityRuntime();'));
const scripts = manifest.content_scripts[1].js;
const styles = manifest.content_scripts[1].css;
assert.ok(scripts.includes('content/continuity-runtime-client.js'));
assert.ok(scripts.includes('ui/continuity-engine-v67.js'));
assert.ok(scripts.indexOf('content/continuity-runtime-client.js') < scripts.indexOf('ui/continuity-engine-v67.js'));
assert.ok(styles.includes('ui/continuity-engine-v67.css'));

for (const token of [
  "CONTINUITY_STORAGE_KEY = 'ld67_continuity_tasks_v1'",
  "'verification_required'",
  'idempotencyKey',
  'leaseToken',
  'leaseUntil',
  'CONTINUITY_WRITE_VERIFICATION_REQUIRED',
  'CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED',
  'write-outcome-unknown-after-interruption',
  'write-verified-absent-safe-to-retry',
  'recoverExpiredContinuityLeases',
  'compactContinuityTask'
]) assert.ok(core.includes(token), token);

for (const token of [
  "PORT_NAME = 'ld2-continuity-runtime'",
  "RECOVERY_ALARM = 'ld67-continuity-recovery'",
  'periodInMinutes: 1',
  "reason: 'service-worker-start'",
  "reason: 'browser-startup'",
  "reason: 'lease-recovery-alarm'",
  "writeAmbiguityPolicy: 'operation-journal-or-prewrite-head-verification-before-retry'",
  "op === 'verify_write'",
  'mark-completed-from-operation-journal',
  'verified-no-write-safe-to-retry',
  'CONTINUITY_WRITE_OUTCOME_AMBIGUOUS_BRANCH_CHANGED',
  'rawPromptPersistence: false',
  'rawModelOutputPersistence: false',
  'rawFileContentPersistence: false'
]) assert.ok(runtime.includes(token), token);

for (const token of [
  'checkpointWriteHead',
  "type: 'git-head-before-write'",
  'claimContinuityStep',
  'completeContinuityStep',
  'failContinuityStep',
  'continuityReplay',
  "code: 'IDEMPOTENT_REPLAY'",
  'writeRepeated: false',
  'idempotencyKey: text(continuity?.idempotencyKey)',
  "writePolicy: 'validated-approval+scope-intelligence-v2+continuity-idempotency'",
  'ambiguousWriteRetryRequiresVerification: true'
]) assert.ok(toolRuntime.includes(token), token);
assert.ok(toolClient.includes('options.continuity'));
assert.ok(toolClient.includes('idempotencyKey'));
assert.ok(journal.includes('idempotencyKey: text(context?.idempotencyKey'));
assert.ok(journal.includes("if (idempotencyKey && entry?.context?.idempotencyKey !== idempotencyKey)"));

for (const token of ['verifyWrite(taskId','Retomar do último passo verificado','Verificar write ambíguo','Writes ambíguos nunca são repetidos','Conteúdo bruto persistido <b>NÃO</b>']) assert.ok(`${client}\n${ui}`.includes(token), token);
assert.ok(css.includes('@media(max-width:760px)'));
assert.ok(css.includes('font-family:Arial'));

const secretCommand = 'SUPER_SECRET_COMMAND_SHOULD_NOT_PERSIST';
const created = await createContinuityTask({ projectId:'p1', repo:'acme/app', branch:'main', command:secretCommand, contextDigest:'ctx123' });
assert.ok(created.commandDigest);
assert.ok(!JSON.stringify(memory).includes(secretCommand));
assert.ok(Array.isArray(memory[CONTINUITY_STORAGE_KEY]));

let task = await defineContinuitySteps(created.id, [
  { idempotencyKey:'infer:1', label:'Reasoning', kind:'inference', mode:'inference', maxAttempts:3 },
  { idempotencyKey:'write:1', label:'Apply patch', kind:'tool', mode:'write', retrySafe:true, paths:['src/App.tsx'], maxAttempts:2 }
]);
assert.equal(task.steps.length, 2);

let claim = await claimContinuityStep({ taskId:created.id, idempotencyKey:'infer:1', workerId:'worker-a', inputDigest:'in1' });
assert.equal(claim.claimed, true);
assert.equal(claim.step.attempts, 1);
await failContinuityStep({ taskId:created.id, idempotencyKey:'infer:1', leaseToken:claim.leaseToken, errorCode:'MODEL_CRASH', outcomeUnknown:false });
task = await getContinuityTask(created.id);
assert.equal(task.steps[0].status, 'interrupted');
assert.equal(task.status, 'interrupted');
claim = await claimContinuityStep({ taskId:created.id, idempotencyKey:'infer:1', workerId:'worker-b' });
assert.equal(claim.claimed, true);
assert.equal(claim.step.attempts, 2);
await completeContinuityStep({ taskId:created.id, idempotencyKey:'infer:1', leaseToken:claim.leaseToken, outputDigest:'out1' });
const inferReplay = await claimContinuityStep({ taskId:created.id, idempotencyKey:'infer:1' });
assert.equal(inferReplay.replay, true);
assert.equal(inferReplay.resultRef.outputDigest, 'out1');

claim = await claimContinuityStep({ taskId:created.id, idempotencyKey:'write:1', workerId:'worker-a' });
assert.equal(claim.claimed, true);
const writeLease = claim.leaseToken;
const rawTask = memory[CONTINUITY_STORAGE_KEY].find(row => row.id === created.id);
const rawWrite = rawTask.steps.find(step => step.idempotencyKey === 'write:1');
rawWrite.checkpoint = { type:'git-head-before-write', reference:'abc123', digest:'d1', verified:true, createdAt:new Date().toISOString() };
rawWrite.checkpointId = 'abc123';
await failContinuityStep({ taskId:created.id, idempotencyKey:'write:1', leaseToken:writeLease, errorCode:'NETWORK_LOST_AFTER_DISPATCH', outcomeUnknown:true });
task = await getContinuityTask(created.id);
assert.equal(task.steps[1].status, 'verification_required');
assert.equal(task.status, 'verification_required');
assert.equal(taskNeedsAttention(task), true);
await assert.rejects(() => claimContinuityStep({ taskId:created.id, idempotencyKey:'write:1' }), error => error?.code === 'CONTINUITY_WRITE_VERIFICATION_REQUIRED');

await resolveAmbiguousWrite({ taskId:created.id, idempotencyKey:'write:1', verifiedAbsent:true });
task = await getContinuityTask(created.id);
assert.equal(task.steps[1].status, 'interrupted');
claim = await claimContinuityStep({ taskId:created.id, idempotencyKey:'write:1', workerId:'worker-c' });
await assert.rejects(() => completeContinuityStep({ taskId:created.id, idempotencyKey:'write:1', leaseToken:claim.leaseToken }), error => error?.code === 'CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED');
await completeContinuityStep({ taskId:created.id, idempotencyKey:'write:1', leaseToken:claim.leaseToken, operationId:'op-write-1', commitSha:'deadbeef', outputDigest:'out-write' });
task = await getContinuityTask(created.id);
assert.equal(task.status, 'completed');
assert.equal(task.steps[1].commitSha, 'deadbeef');
const writeReplay = await claimContinuityStep({ taskId:created.id, idempotencyKey:'write:1' });
assert.equal(writeReplay.replay, true);
assert.equal(writeReplay.resultRef.commitSha, 'deadbeef');

const crashTask = await createContinuityTask({ projectId:'p2', repo:'acme/app', branch:'main', command:'read task' });
await defineContinuitySteps(crashTask.id, [{ idempotencyKey:'read:crash', label:'Read', kind:'context', mode:'read', maxAttempts:2 }]);
claim = await claimContinuityStep({ taskId:crashTask.id, idempotencyKey:'read:crash' });
let storedCrash = memory[CONTINUITY_STORAGE_KEY].find(row => row.id === crashTask.id).steps[0];
storedCrash.leaseUntil = '2000-01-01T00:00:00.000Z';
let recovered = await recoverExpiredContinuityLeases({ reason:'test-crash' });
assert.ok(recovered.recovered.some(item => item.taskId === crashTask.id && item.status === 'interrupted'));

const crashWriteTask = await createContinuityTask({ projectId:'p3', repo:'acme/app', branch:'main', command:'write task' });
await defineContinuitySteps(crashWriteTask.id, [{ idempotencyKey:'write:crash', label:'Write', kind:'tool', mode:'write', retrySafe:true, maxAttempts:2 }]);
claim = await claimContinuityStep({ taskId:crashWriteTask.id, idempotencyKey:'write:crash' });
storedCrash = memory[CONTINUITY_STORAGE_KEY].find(row => row.id === crashWriteTask.id).steps[0];
storedCrash.leaseUntil = '2000-01-01T00:00:00.000Z';
const recovered = await recoverExpiredContinuityLeases({ reason:'test-crash' });
assert.ok(recovered.recovered.some(item => item.taskId === crashWriteTask.id && item.status === 'verification_required'));

assert.match(pkg.notes, /Build67/);
assert.match(pkg.notes, /idempotency/i);
assert.match(pkg.notes, /MCP 2026-07-28 Trust Gateway/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap, /Build 67 — Continuity Engine/);
assert.match(roadmap, /Build 68 — Local Agent Orchestrator \+ Model Router/);
if (currentBuild >= 68) assert.match(roadmap, /Status baseline: Build 68/);
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build67 Continuity Engine cumulative contract OK on authoritative Build ${currentBuild}`);
