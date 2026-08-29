export const APPROVAL_SCHEMA = 'ld-approval-transaction/1';
export const APPROVAL_TTL_MS = 30 * 60 * 1000;

const text = value => String(value ?? '').trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export function normalizeApprovalPlan(plan = {}) {
  const files = (Array.isArray(plan?.files) ? plan.files : [])
    .map(file => ({
      path: text(file?.path || file).replace(/^\/+/, ''),
      reason: text(file?.reason || file?.explanation).slice(0, 2000)
    }))
    .filter(file => file.path)
    .slice(0, 30);
  return Object.freeze({
    summary: text(plan?.summary || '').slice(0, 12000),
    plan: (Array.isArray(plan?.plan) ? plan.plan : []).map(value => text(value).slice(0, 4000)).filter(Boolean).slice(0, 30),
    files,
    warnings: (Array.isArray(plan?.warnings) ? plan.warnings : []).map(value => text(value).slice(0, 4000)).filter(Boolean).slice(0, 30)
  });
}

export function approvalFileWhitelist(plan = {}) {
  return unique(normalizeApprovalPlan(plan).files.map(file => file.path)).slice(0, 30);
}

export function canonicalApprovalPayload({ projectId = '', command = '', plan = {}, baseHeadSha = '', stateRevision = '', decision = 'approve', source = 'decrypter-chat' } = {}) {
  const normalized = normalizeApprovalPlan(plan);
  return {
    schema: APPROVAL_SCHEMA,
    projectId: text(projectId).slice(0, 120),
    command: text(command).slice(0, 50000),
    plan: normalized,
    baseHeadSha: text(baseHeadSha).toLowerCase(),
    stateRevision: text(stateRevision).slice(0, 160),
    decision: decision === 'skip' ? 'skip' : 'approve',
    source: text(source).slice(0, 120) || 'decrypter-chat'
  };
}

export function validatePreparedFiles(files = [], authorizedPaths = []) {
  const allowed = new Set(unique(authorizedPaths));
  const seen = new Set();
  const violations = [];
  const normalized = [];
  for (const file of Array.isArray(files) ? files : []) {
    const path = text(file?.path).replace(/^\/+/, '');
    const action = text(file?.action).toLowerCase();
    if (!path) { violations.push('prepared_file_without_path'); continue; }
    if (seen.has(path)) violations.push(`duplicate:${path}`);
    seen.add(path);
    if (!allowed.has(path)) violations.push(`outside_plan:${path}`);
    if (!['create', 'update', 'delete'].includes(action)) violations.push(`invalid_action:${path}`);
    normalized.push({ path, action });
  }
  if (!normalized.length) violations.push('prepared_files_empty');
  return Object.freeze({ ok: violations.length === 0, violations, files: normalized });
}

export function assertRevision(frozenRevision = '', currentRevision = '') {
  const frozen = text(frozenRevision);
  const current = text(currentRevision);
  if (!frozen || !current || frozen !== current) throw new Error('APPROVAL_STATE_REVISION_CHANGED');
  return true;
}

export function assertHead(frozenHead = '', currentHead = '') {
  const frozen = text(frozenHead).toLowerCase();
  const current = text(currentHead).toLowerCase();
  if (!frozen || !current || frozen !== current) throw new Error('APPROVAL_BASE_HEAD_CHANGED');
  return true;
}

export function publicApproval(tx = {}) {
  return Object.freeze({
    schema: APPROVAL_SCHEMA,
    id: text(tx.id),
    planId: text(tx.planId || tx.id),
    hash: text(tx.hash),
    decision: tx.decision === 'skip' ? 'skip' : 'approve',
    source: text(tx.source),
    projectId: text(tx.projectId),
    baseHeadSha: text(tx.baseHeadSha),
    stateRevision: text(tx.stateRevision),
    authorizedFiles: unique(tx.authorizedFiles || []),
    status: text(tx.status || 'frozen'),
    createdAt: text(tx.createdAt),
    expiresAt: text(tx.expiresAt),
    bundleId: text(tx.bundleId),
    protections: Object.freeze({
      humanApprovalSkipped: tx.decision === 'skip',
      scopeWhitelist: true,
      shadowBuild: true,
      validationGate: true,
      scopeLock: true,
      guardedCommit: true,
      baseHeadLock: true,
      stateRevisionLock: true,
      trustProtocol: '2.4.21'
    })
  });
}
