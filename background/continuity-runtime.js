import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { listOperationJournal } from '../core/operation-journal.js';
import {
  CONTINUITY_SCHEMA,
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  resolveAmbiguousWrite,
  recoverExpiredContinuityLeases,
  resumeContinuityTask,
  cancelContinuityTask,
  listContinuityTasks,
  getContinuityTask,
  nextContinuityStep,
  checkpointContinuityStep
} from '../core/continuity-engine.js';

const PORT_NAME = 'ld2-continuity-runtime';
const RECOVERY_ALARM = 'ld67-continuity-recovery';

const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function verifyAmbiguousToolWrite(payload = {}) {
  const taskId = text(payload?.taskId, 160);
  const stepKey = text(payload?.stepId || payload?.idempotencyKey, 240);
  if (!taskId || !stepKey) throw Object.assign(new Error('CONTINUITY_VERIFY_WRITE_CONTEXT_REQUIRED'), { code: 'CONTINUITY_VERIFY_WRITE_CONTEXT_REQUIRED' });
  const task = await getContinuityTask(taskId);
  const step = task.steps.find(item => item.id === stepKey || item.idempotencyKey === stepKey);
  if (!step) throw Object.assign(new Error('CONTINUITY_STEP_NOT_FOUND'), { code: 'CONTINUITY_STEP_NOT_FOUND' });
  if (step.status !== 'verification_required') return { verified: step.status === 'completed', task, step, action: 'none' };

  const journal = await listOperationJournal({
    status: 'ok',
    mode: 'write',
    taskId,
    idempotencyKey: step.idempotencyKey,
    limit: 20
  });
  const successful = journal.find(entry => text(entry?.result?.commitSha, 128) || text(entry?.id, 160));
  if (successful) {
    const resolved = await resolveAmbiguousWrite({
      taskId,
      idempotencyKey: step.idempotencyKey,
      verified: true,
      operationId: successful.id,
      commitSha: successful?.result?.commitSha || ''
    });
    return { verified: true, action: 'mark-completed-from-operation-journal', journalOperationId: successful.id, ...resolved };
  }

  const checkpoint = step?.checkpoint;
  if (checkpoint?.type !== 'git-head-before-write' || !checkpoint?.reference) {
    throw Object.assign(new Error('CONTINUITY_PREWRITE_CHECKPOINT_MISSING'), { code: 'CONTINUITY_PREWRITE_CHECKPOINT_MISSING' });
  }
  const settings = await getSettings();
  const github = activeGithub(settings, task.projectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('CONTINUITY_GITHUB_MAPPING_REQUIRED'), { code: 'CONTINUITY_GITHUB_MAPPING_REQUIRED' });
  const adapter = new GitAdapter({ ...github, branch: task.branch || github.branch || 'main' });
  const ref = await adapter.getRef(task.branch || github.branch || 'main');
  const currentHead = text(ref?.object?.sha || ref?.sha, 128).toLowerCase();
  const beforeHead = text(checkpoint.reference, 128).toLowerCase();
  if (!currentHead) throw Object.assign(new Error('CONTINUITY_CURRENT_HEAD_UNAVAILABLE'), { code: 'CONTINUITY_CURRENT_HEAD_UNAVAILABLE' });
  if (currentHead === beforeHead) {
    const resolved = await resolveAmbiguousWrite({
      taskId,
      idempotencyKey: step.idempotencyKey,
      verifiedAbsent: true
    });
    return { verified: true, action: 'verified-no-write-safe-to-retry', currentHead, beforeHead, ...resolved };
  }

  const error = new Error(`CONTINUITY_WRITE_OUTCOME_AMBIGUOUS_BRANCH_CHANGED:${beforeHead.slice(0,8)}->${currentHead.slice(0,8)}`);
  error.code = 'CONTINUITY_WRITE_OUTCOME_AMBIGUOUS_BRANCH_CHANGED';
  error.details = { beforeHead, currentHead, taskId, stepId: step.id };
  throw error;
}

async function handle(action, payload = {}) {
  const op = text(action || 'status', 80).toLowerCase();
  if (op === 'status') return {
    schema: CONTINUITY_SCHEMA,
    build: 67,
    durableLocalState: true,
    rawPromptPersistence: false,
    rawModelOutputPersistence: false,
    rawFileContentPersistence: false,
    leases: true,
    idempotencyKeys: true,
    writeAmbiguityPolicy: 'operation-journal-or-prewrite-head-verification-before-retry',
    readInferenceRetryPolicy: 'resume-from-last-verified-step',
    restartRecovery: true,
    compactStateReconstruction: true,
    maximumAutomaticFrequency: '1-minute-recovery-alarm'
  };
  if (op === 'create') return { task: await createContinuityTask(payload || {}) };
  if (op === 'define_steps') return { task: await defineContinuitySteps(payload?.taskId, payload?.steps || []) };
  if (op === 'claim') return claimContinuityStep(payload || {});
  if (op === 'complete_step') return completeContinuityStep(payload || {});
  if (op === 'fail_step') return failContinuityStep(payload || {});
  if (op === 'resolve_write') return resolveAmbiguousWrite(payload || {});
  if (op === 'verify_write') return verifyAmbiguousToolWrite(payload || {});
  if (op === 'resume') return { task: await resumeContinuityTask(payload?.taskId) };
  if (op === 'cancel') return { task: await cancelContinuityTask(payload?.taskId) };
  if (op === 'list') return { tasks: await listContinuityTasks(payload || {}) };
  if (op === 'get') return { task: await getContinuityTask(payload?.taskId) };
  if (op === 'next') return nextContinuityStep(payload?.taskId);
  if (op === 'checkpoint') return checkpointContinuityStep(payload || {});
  if (op === 'recover') return recoverExpiredContinuityLeases({ reason: payload?.reason || 'manual-recovery' });
  throw Object.assign(new Error('CONTINUITY_ACTION_INVALID'), { code: 'CONTINUITY_ACTION_INVALID' });
}

async function ensureRecoveryAlarm() {
  try {
    const alarm = await chrome.alarms.get(RECOVERY_ALARM);
    if (!alarm) chrome.alarms.create(RECOVERY_ALARM, { periodInMinutes: 1 });
  } catch (_) {}
}

export function installContinuityRuntime() {
  if (globalThis.__LD67_CONTINUITY_RUNTIME__) return;
  globalThis.__LD67_CONTINUITY_RUNTIME__ = true;

  recoverExpiredContinuityLeases({ reason: 'service-worker-start' }).catch(() => null);
  ensureRecoveryAlarm().catch(() => null);

  chrome.runtime.onStartup?.addListener?.(() => {
    recoverExpiredContinuityLeases({ reason: 'browser-startup' }).catch(() => null);
    ensureRecoveryAlarm().catch(() => null);
  });
  chrome.runtime.onInstalled?.addListener?.(() => {
    recoverExpiredContinuityLeases({ reason: 'extension-installed-or-updated' }).catch(() => null);
    ensureRecoveryAlarm().catch(() => null);
  });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm?.name !== RECOVERY_ALARM) return;
    recoverExpiredContinuityLeases({ reason: 'lease-recovery-alarm' }).catch(() => null);
  });

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try {
        const data = await handle(message?.action || 'status', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'CONTINUITY_RUNTIME_FAILED', details: error?.details || null });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(listener);
  });

  globalThis.LovableDecrypterContinuityRuntime = Object.freeze({
    build: 67,
    schema: CONTINUITY_SCHEMA,
    port: PORT_NAME,
    durable: true,
    failClosedWrites: true,
    writeRetryRequiresVerification: true,
    operationJournalRecovery: true,
    preWriteHeadRecovery: true,
    replayCompletedSteps: true,
    rawContentPersistence: false,
    restartRecovery: true
  });
}
