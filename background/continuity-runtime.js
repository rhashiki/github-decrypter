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
    writeAmbiguityPolicy: 'verification-required-before-retry',
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
    replayCompletedSteps: true,
    rawContentPersistence: false,
    restartRecovery: true
  });
}
