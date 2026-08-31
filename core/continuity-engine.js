export const CONTINUITY_SCHEMA = 'ld-continuity-task/1';
export const CONTINUITY_STORAGE_KEY = 'ld67_continuity_tasks_v1';
export const CONTINUITY_DEFAULT_LEASE_MS = 90_000;
export const CONTINUITY_MAX_TASKS = 120;
export const CONTINUITY_MAX_STEPS = 80;

const TASK_STATUSES = new Set(['created','running','interrupted','verification_required','completed','failed','cancelled']);
const STEP_STATUSES = new Set(['queued','running','interrupted','verification_required','completed','failed','cancelled']);
const STEP_KINDS = new Set(['context','inference','tool','diagnostics','approval','checkpoint','verification','other']);
const STEP_MODES = new Set(['read','write','inference']);
let writeQueue = Promise.resolve();

const nowIso = () => new Date().toISOString();
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const uniq = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 1000)).filter(Boolean))];

function storageApi() {
  const api = globalThis.chrome?.storage?.local;
  if (!api) throw Object.assign(new Error('CONTINUITY_STORAGE_UNAVAILABLE'), { code: 'CONTINUITY_STORAGE_UNAVAILABLE' });
  return api;
}

async function sha256(value = '') {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value ?? '')));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function continuityDigest(value = '') { return sha256(value); }

function normalizeTaskStatus(value = 'created') {
  const status = String(value || 'created');
  return TASK_STATUSES.has(status) ? status : 'created';
}
function normalizeStepStatus(value = 'queued') {
  const status = String(value || 'queued');
  return STEP_STATUSES.has(status) ? status : 'queued';
}
function normalizeStepKind(value = 'other') {
  const kind = String(value || 'other');
  return STEP_KINDS.has(kind) ? kind : 'other';
}
function normalizeStepMode(value = 'read') {
  const mode = String(value || 'read');
  return STEP_MODES.has(mode) ? mode : 'read';
}

function normalizeCheckpoint(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    type: text(value.type, 80),
    reference: text(value.reference, 500),
    digest: text(value.digest, 128),
    verified: value.verified === true,
    createdAt: text(value.createdAt, 80) || nowIso()
  };
}

export function normalizeContinuityStep(input = {}, index = 0) {
  const mode = normalizeStepMode(input?.mode);
  const key = text(input?.idempotencyKey || input?.key, 240);
  if (!key) throw Object.assign(new Error('CONTINUITY_IDEMPOTENCY_KEY_REQUIRED'), { code: 'CONTINUITY_IDEMPOTENCY_KEY_REQUIRED' });
  const maxAttempts = Math.max(1, Math.min(8, Number(input?.maxAttempts || (mode === 'write' ? 2 : 4))));
  return {
    id: text(input?.id, 160) || crypto.randomUUID(),
    index: Math.max(0, Number.isFinite(Number(input?.index)) ? Number(input.index) : index),
    idempotencyKey: key,
    label: text(input?.label, 240) || `step-${index + 1}`,
    kind: normalizeStepKind(input?.kind),
    mode,
    status: normalizeStepStatus(input?.status || 'queued'),
    attempts: Math.max(0, Number(input?.attempts || 0) || 0),
    maxAttempts,
    resumable: input?.resumable !== false,
    retrySafe: mode === 'write' ? input?.retrySafe === true : input?.retrySafe !== false,
    createdAt: text(input?.createdAt, 80) || nowIso(),
    updatedAt: text(input?.updatedAt, 80) || nowIso(),
    startedAt: text(input?.startedAt, 80),
    completedAt: text(input?.completedAt, 80),
    interruptedAt: text(input?.interruptedAt, 80),
    leaseOwner: '',
    leaseToken: '',
    leaseUntil: '',
    inputDigest: text(input?.inputDigest, 128),
    outputDigest: text(input?.outputDigest, 128),
    operationId: text(input?.operationId, 160),
    commitSha: text(input?.commitSha, 128),
    checkpointId: text(input?.checkpointId, 160),
    checkpoint: normalizeCheckpoint(input?.checkpoint),
    lastErrorCode: text(input?.lastErrorCode, 160),
    verificationReason: text(input?.verificationReason, 240),
    paths: uniq(input?.paths).slice(0, 80)
  };
}

export function taskNeedsAttention(task = {}) {
  return (Array.isArray(task?.steps) ? task.steps : []).some(step => ['interrupted','verification_required','failed'].includes(step?.status));
}

export function compactContinuityTask(task = {}) {
  return {
    schema: CONTINUITY_SCHEMA,
    id: text(task?.id, 160),
    projectId: text(task?.projectId, 160),
    repo: text(task?.repo, 300),
    branch: text(task?.branch, 240),
    status: normalizeTaskStatus(task?.status),
    commandDigest: text(task?.commandDigest, 128),
    contextDigest: text(task?.contextDigest, 128),
    createdAt: text(task?.createdAt, 80),
    updatedAt: text(task?.updatedAt, 80),
    completedAt: text(task?.completedAt, 80),
    resumeCount: Math.max(0, Number(task?.resumeCount || 0) || 0),
    lastErrorCode: text(task?.lastErrorCode, 160),
    needsAttention: taskNeedsAttention(task),
    steps: (Array.isArray(task?.steps) ? task.steps : []).map(step => ({
      id: text(step?.id, 160),
      index: Number(step?.index || 0),
      idempotencyKey: text(step?.idempotencyKey, 240),
      label: text(step?.label, 240),
      kind: normalizeStepKind(step?.kind),
      mode: normalizeStepMode(step?.mode),
      status: normalizeStepStatus(step?.status),
      attempts: Math.max(0, Number(step?.attempts || 0) || 0),
      maxAttempts: Math.max(1, Number(step?.maxAttempts || 1) || 1),
      resumable: step?.resumable !== false,
      retrySafe: step?.retrySafe === true,
      startedAt: text(step?.startedAt, 80),
      completedAt: text(step?.completedAt, 80),
      interruptedAt: text(step?.interruptedAt, 80),
      inputDigest: text(step?.inputDigest, 128),
      outputDigest: text(step?.outputDigest, 128),
      operationId: text(step?.operationId, 160),
      commitSha: text(step?.commitSha, 128),
      checkpointId: text(step?.checkpointId, 160),
      checkpoint: normalizeCheckpoint(step?.checkpoint),
      lastErrorCode: text(step?.lastErrorCode, 160),
      verificationReason: text(step?.verificationReason, 240),
      paths: uniq(step?.paths).slice(0, 80)
    }))
  };
}

async function loadTasks() {
  const data = await storageApi().get(CONTINUITY_STORAGE_KEY);
  const rows = Array.isArray(data[CONTINUITY_STORAGE_KEY]) ? data[CONTINUITY_STORAGE_KEY] : [];
  return rows;
}
async function saveTasks(tasks) {
  await storageApi().set({ [CONTINUITY_STORAGE_KEY]: (Array.isArray(tasks) ? tasks : []).slice(0, CONTINUITY_MAX_TASKS) });
}
function enqueueMutation(mutator) {
  const run = async () => {
    const tasks = await loadTasks();
    const result = await mutator(tasks);
    await saveTasks(tasks);
    return result;
  };
  const pending = writeQueue.then(run, run);
  writeQueue = pending.then(() => undefined, () => undefined);
  return pending;
}
function findTask(tasks, taskId) {
  const task = tasks.find(row => row?.id === taskId);
  if (!task) throw Object.assign(new Error('CONTINUITY_TASK_NOT_FOUND'), { code: 'CONTINUITY_TASK_NOT_FOUND' });
  return task;
}
function findStep(task, stepIdOrKey) {
  const step = (Array.isArray(task?.steps) ? task.steps : []).find(row => row?.id === stepIdOrKey || row?.idempotencyKey === stepIdOrKey);
  if (!step) throw Object.assign(new Error('CONTINUITY_STEP_NOT_FOUND'), { code: 'CONTINUITY_STEP_NOT_FOUND' });
  return step;
}
function refreshTaskStatus(task) {
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  if (task.status === 'cancelled') return;
  if (steps.length && steps.every(step => step.status === 'completed')) {
    task.status = 'completed';
    task.completedAt = task.completedAt || nowIso();
    task.lastErrorCode = '';
    return;
  }
  if (steps.some(step => step.status === 'verification_required')) task.status = 'verification_required';
  else if (steps.some(step => step.status === 'running')) task.status = 'running';
  else if (steps.some(step => step.status === 'interrupted')) task.status = 'interrupted';
  else if (steps.some(step => step.status === 'failed' && step.resumable !== true)) task.status = 'failed';
  else if (steps.some(step => step.status === 'failed')) task.status = 'interrupted';
  else task.status = steps.length ? 'created' : normalizeTaskStatus(task.status);
}

export async function createContinuityTask({ projectId = '', repo = '', branch = 'main', commandDigest = '', command = '', contextDigest = '', metadata = {} } = {}) {
  const digest = text(commandDigest, 128) || (command ? await sha256(command) : '');
  const task = {
    schema: CONTINUITY_SCHEMA,
    id: crypto.randomUUID(),
    projectId: text(projectId, 160),
    repo: text(repo, 300),
    branch: text(branch, 240) || 'main',
    status: 'created',
    commandDigest: digest,
    contextDigest: text(contextDigest, 128),
    metadata: {
      mode: text(metadata?.mode, 40),
      source: text(metadata?.source, 80),
      parentTaskId: text(metadata?.parentTaskId, 160)
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: '',
    resumeCount: 0,
    lastErrorCode: '',
    steps: []
  };
  await enqueueMutation(tasks => { tasks.unshift(task); return task; });
  return compactContinuityTask(task);
}

export async function defineContinuitySteps(taskId, descriptors = []) {
  if (!Array.isArray(descriptors) || !descriptors.length) throw Object.assign(new Error('CONTINUITY_STEPS_REQUIRED'), { code: 'CONTINUITY_STEPS_REQUIRED' });
  if (descriptors.length > CONTINUITY_MAX_STEPS) throw Object.assign(new Error('CONTINUITY_TOO_MANY_STEPS'), { code: 'CONTINUITY_TOO_MANY_STEPS' });
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    if (['completed','cancelled'].includes(task.status)) throw Object.assign(new Error('CONTINUITY_TASK_CLOSED'), { code: 'CONTINUITY_TASK_CLOSED' });
    const existingKeys = new Set((task.steps || []).map(step => step.idempotencyKey));
    for (const [index, descriptor] of descriptors.entries()) {
      const normalized = normalizeContinuityStep(descriptor, task.steps.length + index);
      if (existingKeys.has(normalized.idempotencyKey)) continue;
      existingKeys.add(normalized.idempotencyKey);
      task.steps.push(normalized);
    }
    task.steps.sort((a,b) => Number(a.index || 0) - Number(b.index || 0));
    task.updatedAt = nowIso();
    refreshTaskStatus(task);
    return compactContinuityTask(task);
  });
}

export async function claimContinuityStep({ taskId, stepId = '', idempotencyKey = '', workerId = 'local', leaseMs = CONTINUITY_DEFAULT_LEASE_MS, inputDigest = '' } = {}) {
  const key = text(stepId || idempotencyKey, 240);
  if (!taskId || !key) throw Object.assign(new Error('CONTINUITY_CLAIM_CONTEXT_REQUIRED'), { code: 'CONTINUITY_CLAIM_CONTEXT_REQUIRED' });
  const safeLease = Math.max(15_000, Math.min(10 * 60_000, Number(leaseMs || CONTINUITY_DEFAULT_LEASE_MS)));
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    if (task.status === 'cancelled') throw Object.assign(new Error('CONTINUITY_TASK_CANCELLED'), { code: 'CONTINUITY_TASK_CANCELLED' });
    const step = findStep(task, key);
    if (step.status === 'completed') {
      return { claimed: false, replay: true, task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0], resultRef: { operationId: step.operationId || '', commitSha: step.commitSha || '', checkpointId: step.checkpointId || '', outputDigest: step.outputDigest || '' } };
    }
    if (step.status === 'verification_required') throw Object.assign(new Error('CONTINUITY_WRITE_VERIFICATION_REQUIRED'), { code: 'CONTINUITY_WRITE_VERIFICATION_REQUIRED', stepId: step.id });
    if (step.status === 'cancelled' || step.resumable === false && step.status === 'failed') throw Object.assign(new Error('CONTINUITY_STEP_CLOSED'), { code: 'CONTINUITY_STEP_CLOSED' });
    const leaseLive = step.status === 'running' && Date.parse(step.leaseUntil || '') > Date.now();
    if (leaseLive) return { claimed: false, busy: true, replay: false, task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
    if (step.attempts >= step.maxAttempts) {
      step.status = 'failed';
      step.lastErrorCode = 'CONTINUITY_MAX_ATTEMPTS_EXCEEDED';
      refreshTaskStatus(task);
      throw Object.assign(new Error('CONTINUITY_MAX_ATTEMPTS_EXCEEDED'), { code: 'CONTINUITY_MAX_ATTEMPTS_EXCEEDED' });
    }
    const token = crypto.randomUUID();
    step.status = 'running';
    step.attempts += 1;
    step.startedAt = step.startedAt || nowIso();
    step.updatedAt = nowIso();
    step.leaseOwner = text(workerId, 160) || 'local';
    step.leaseToken = token;
    step.leaseUntil = new Date(Date.now() + safeLease).toISOString();
    step.inputDigest = text(inputDigest, 128) || step.inputDigest || '';
    step.lastErrorCode = '';
    step.verificationReason = '';
    task.status = 'running';
    task.updatedAt = nowIso();
    return { claimed: true, busy: false, replay: false, leaseToken: token, leaseUntil: step.leaseUntil, task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
  });
}

function assertLease(step, leaseToken) {
  if (!step?.leaseToken || step.leaseToken !== leaseToken) throw Object.assign(new Error('CONTINUITY_LEASE_MISMATCH'), { code: 'CONTINUITY_LEASE_MISMATCH' });
  if (Date.parse(step.leaseUntil || '') <= Date.now()) throw Object.assign(new Error('CONTINUITY_LEASE_EXPIRED'), { code: 'CONTINUITY_LEASE_EXPIRED' });
}

export async function completeContinuityStep({ taskId, stepId = '', idempotencyKey = '', leaseToken = '', outputDigest = '', operationId = '', commitSha = '', checkpointId = '', checkpoint = null } = {}) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    const step = findStep(task, text(stepId || idempotencyKey, 240));
    if (step.status === 'completed') return { replay: true, task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
    assertLease(step, leaseToken);
    if (step.mode === 'write' && !text(commitSha, 128) && !text(operationId, 160)) {
      throw Object.assign(new Error('CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED'), { code: 'CONTINUITY_WRITE_RESULT_REFERENCE_REQUIRED' });
    }
    step.status = 'completed';
    step.completedAt = nowIso();
    step.updatedAt = nowIso();
    step.outputDigest = text(outputDigest, 128);
    step.operationId = text(operationId, 160);
    step.commitSha = text(commitSha, 128);
    step.checkpointId = text(checkpointId, 160);
    step.checkpoint = normalizeCheckpoint(checkpoint);
    step.leaseOwner = '';
    step.leaseToken = '';
    step.leaseUntil = '';
    step.lastErrorCode = '';
    step.verificationReason = '';
    task.updatedAt = nowIso();
    refreshTaskStatus(task);
    return { replay: false, task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
  });
}

export async function failContinuityStep({ taskId, stepId = '', idempotencyKey = '', leaseToken = '', errorCode = 'CONTINUITY_STEP_FAILED', outcomeUnknown = false } = {}) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    const step = findStep(task, text(stepId || idempotencyKey, 240));
    if (step.status === 'completed') return { ignored: true, task: compactContinuityTask(task) };
    if (leaseToken) assertLease(step, leaseToken);
    const unknownWrite = step.mode === 'write' && outcomeUnknown === true;
    step.status = unknownWrite ? 'verification_required' : (step.resumable && step.attempts < step.maxAttempts ? 'interrupted' : 'failed');
    step.interruptedAt = nowIso();
    step.updatedAt = nowIso();
    step.lastErrorCode = text(errorCode, 160) || 'CONTINUITY_STEP_FAILED';
    step.verificationReason = unknownWrite ? 'write-outcome-unknown-after-interruption' : '';
    step.leaseOwner = '';
    step.leaseToken = '';
    step.leaseUntil = '';
    task.lastErrorCode = step.lastErrorCode;
    task.updatedAt = nowIso();
    refreshTaskStatus(task);
    return { task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
  });
}

export async function resolveAmbiguousWrite({ taskId, stepId = '', idempotencyKey = '', verified = false, verifiedAbsent = false, operationId = '', commitSha = '', outputDigest = '' } = {}) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    const step = findStep(task, text(stepId || idempotencyKey, 240));
    if (step.status !== 'verification_required') throw Object.assign(new Error('CONTINUITY_STEP_NOT_AWAITING_VERIFICATION'), { code: 'CONTINUITY_STEP_NOT_AWAITING_VERIFICATION' });
    if (verified === true) {
      if (!text(operationId, 160) && !text(commitSha, 128)) throw Object.assign(new Error('CONTINUITY_VERIFIED_WRITE_REFERENCE_REQUIRED'), { code: 'CONTINUITY_VERIFIED_WRITE_REFERENCE_REQUIRED' });
      step.status = 'completed';
      step.completedAt = nowIso();
      step.operationId = text(operationId, 160);
      step.commitSha = text(commitSha, 128);
      step.outputDigest = text(outputDigest, 128);
      step.verificationReason = 'write-result-verified-after-interruption';
      step.lastErrorCode = '';
    } else if (verifiedAbsent === true) {
      if (step.retrySafe !== true) throw Object.assign(new Error('CONTINUITY_WRITE_RETRY_NOT_SAFE'), { code: 'CONTINUITY_WRITE_RETRY_NOT_SAFE' });
      step.status = 'interrupted';
      step.verificationReason = 'write-verified-absent-safe-to-retry';
    } else {
      throw Object.assign(new Error('CONTINUITY_VERIFICATION_DECISION_REQUIRED'), { code: 'CONTINUITY_VERIFICATION_DECISION_REQUIRED' });
    }
    step.updatedAt = nowIso();
    task.updatedAt = nowIso();
    refreshTaskStatus(task);
    return { task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
  });
}

export async function recoverExpiredContinuityLeases({ reason = 'runtime-restart' } = {}) {
  return enqueueMutation(tasks => {
    const recovered = [];
    const now = Date.now();
    for (const task of tasks) {
      let touched = false;
      for (const step of Array.isArray(task?.steps) ? task.steps : []) {
        if (step.status !== 'running' || Date.parse(step.leaseUntil || '') > now) continue;
        step.interruptedAt = nowIso();
        step.updatedAt = nowIso();
        step.leaseOwner = '';
        step.leaseToken = '';
        step.leaseUntil = '';
        step.lastErrorCode = 'CONTINUITY_LEASE_EXPIRED';
        if (step.mode === 'write') {
          step.status = 'verification_required';
          step.verificationReason = `write-outcome-unknown:${text(reason, 80)}`;
        } else {
          step.status = step.resumable && step.attempts < step.maxAttempts ? 'interrupted' : 'failed';
          step.verificationReason = '';
        }
        recovered.push({ taskId: task.id, stepId: step.id, mode: step.mode, status: step.status });
        touched = true;
      }
      if (touched) {
        task.resumeCount = Math.max(0, Number(task.resumeCount || 0)) + 1;
        task.updatedAt = nowIso();
        task.lastErrorCode = 'CONTINUITY_RUNTIME_INTERRUPTED';
        refreshTaskStatus(task);
      }
    }
    return { recovered, taskCount: new Set(recovered.map(item => item.taskId)).size };
  });
}

export async function resumeContinuityTask(taskId) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    if (task.status === 'cancelled' || task.status === 'completed') throw Object.assign(new Error('CONTINUITY_TASK_CLOSED'), { code: 'CONTINUITY_TASK_CLOSED' });
    if ((task.steps || []).some(step => step.status === 'verification_required')) throw Object.assign(new Error('CONTINUITY_VERIFICATION_REQUIRED_BEFORE_RESUME'), { code: 'CONTINUITY_VERIFICATION_REQUIRED_BEFORE_RESUME' });
    for (const step of task.steps || []) if (step.status === 'failed' && step.resumable && step.attempts < step.maxAttempts) step.status = 'interrupted';
    task.status = 'running';
    task.resumeCount = Math.max(0, Number(task.resumeCount || 0)) + 1;
    task.updatedAt = nowIso();
    task.lastErrorCode = '';
    return compactContinuityTask(task);
  });
}

export async function cancelContinuityTask(taskId) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    task.status = 'cancelled';
    task.updatedAt = nowIso();
    for (const step of task.steps || []) {
      if (!['completed','cancelled'].includes(step.status)) step.status = 'cancelled';
      step.leaseOwner = '';
      step.leaseToken = '';
      step.leaseUntil = '';
    }
    return compactContinuityTask(task);
  });
}

export async function listContinuityTasks({ projectId = '', status = '', limit = 50 } = {}) {
  const rows = await loadTasks();
  const safeLimit = Math.max(1, Math.min(CONTINUITY_MAX_TASKS, Number(limit || 50)));
  return rows.filter(task => {
    if (projectId && task?.projectId !== projectId) return false;
    if (status && task?.status !== status) return false;
    return true;
  }).slice(0, safeLimit).map(compactContinuityTask);
}

export async function getContinuityTask(taskId) {
  const rows = await loadTasks();
  return compactContinuityTask(findTask(rows, taskId));
}

export async function nextContinuityStep(taskId) {
  const task = await getContinuityTask(taskId);
  const step = task.steps.find(item => ['queued','interrupted'].includes(item.status)) || null;
  return { task, step };
}

export async function checkpointContinuityStep({ taskId, stepId = '', idempotencyKey = '', checkpoint = {} } = {}) {
  return enqueueMutation(tasks => {
    const task = findTask(tasks, taskId);
    const step = findStep(task, text(stepId || idempotencyKey, 240));
    step.checkpoint = normalizeCheckpoint(checkpoint);
    step.checkpointId = text(checkpoint?.id || checkpoint?.reference, 160);
    step.updatedAt = nowIso();
    task.updatedAt = nowIso();
    return { task: compactContinuityTask(task), step: compactContinuityTask({ steps:[step] }).steps[0] };
  });
}

export { TASK_STATUSES, STEP_STATUSES, STEP_KINDS, STEP_MODES };
