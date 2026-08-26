const CHECKPOINT_KEY = 'ld2_checkpoints_v1';
const MAX_CHECKPOINTS = 80;

function nowIso() { return new Date().toISOString(); }

async function loadCheckpoints() {
  const data = await chrome.storage.local.get(CHECKPOINT_KEY);
  return Array.isArray(data[CHECKPOINT_KEY]) ? data[CHECKPOINT_KEY] : [];
}

async function saveCheckpoints(list) {
  await chrome.storage.local.set({ [CHECKPOINT_KEY]: (Array.isArray(list) ? list : []).slice(0, MAX_CHECKPOINTS) });
}

async function updateCheckpoint(id, patch = {}) {
  const list = await loadCheckpoints();
  const index = list.findIndex(item => item?.id === id);
  if (index < 0) return null;
  list[index] = { ...list[index], ...patch, updatedAt: nowIso() };
  await saveCheckpoints(list);
  return list[index];
}

export async function createCheckpoint({ adapter, bundle, shadow } = {}) {
  if (!adapter || !bundle?.github?.branch || !shadow?.baseCommitSha) throw new Error('CHECKPOINT_CONTEXT_REQUIRED');
  const baseCommit = await adapter.getCommit(shadow.baseCommitSha);
  const baseTreeSha = String(baseCommit?.tree?.sha || shadow.baseTreeSha || '');
  if (!baseTreeSha) throw new Error('CHECKPOINT_BASE_TREE_REQUIRED');

  const checkpoint = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'prepared',
    repo: `${bundle.github.owner}/${bundle.github.repo}`,
    owner: bundle.github.owner,
    repository: bundle.github.repo,
    branch: bundle.github.branch,
    command: bundle.command || '',
    summary: bundle.plan?.summary || bundle.plan?.commit_message || '',
    baseHeadSha: String(shadow.baseCommitSha),
    baseTreeSha,
    shadowCommitSha: String(shadow.commitSha || ''),
    appliedCommitSha: '',
    rollbackCommitSha: '',
    rollbackMode: '',
    note: ''
  };
  const list = await loadCheckpoints();
  list.unshift(checkpoint);
  await saveCheckpoints(list);
  return checkpoint;
}

export async function markCheckpointPublished(checkpoint, appliedCommitSha) {
  if (!checkpoint?.id) return null;
  return updateCheckpoint(checkpoint.id, {
    status: 'published',
    publishedAt: nowIso(),
    appliedCommitSha: String(appliedCommitSha || checkpoint.shadowCommitSha || '')
  });
}

export async function markCheckpointAborted(checkpoint, error) {
  if (!checkpoint?.id) return null;
  return updateCheckpoint(checkpoint.id, {
    status: 'aborted',
    note: error?.message || String(error || 'Falha antes da publicação.')
  });
}

export async function verifyPublishedCheckpoint({ adapter, checkpoint, expectedCommitSha } = {}) {
  if (!adapter || !checkpoint?.branch) throw new Error('CHECKPOINT_VERIFY_CONTEXT_REQUIRED');
  const ref = await adapter.getRef(checkpoint.branch);
  const currentHeadSha = String(ref?.object?.sha || '');
  const expected = String(expectedCommitSha || checkpoint.appliedCommitSha || checkpoint.shadowCommitSha || '');
  if (!currentHeadSha || !expected) {
    return { ok: false, definitive: false, reason: 'missing-head', currentHeadSha, expectedCommitSha: expected };
  }
  if (currentHeadSha !== expected) {
    return { ok: false, definitive: false, reason: 'branch-advanced-or-diverged', currentHeadSha, expectedCommitSha: expected };
  }

  const commit = await adapter.getCommit(currentHeadSha);
  const parentSha = String(commit?.parents?.[0]?.sha || '');
  const treeSha = String(commit?.tree?.sha || '');
  const parentOk = parentSha === String(checkpoint.baseHeadSha || '');
  const shadowTreeOk = checkpoint.shadowCommitSha ? String(checkpoint.shadowCommitSha) === currentHeadSha : true;
  if (!parentOk || !shadowTreeOk || !treeSha) {
    return {
      ok: false,
      definitive: true,
      reason: !parentOk ? 'unexpected-parent' : (!shadowTreeOk ? 'unexpected-commit' : 'missing-tree'),
      currentHeadSha,
      expectedCommitSha: expected,
      parentSha,
      treeSha
    };
  }
  return { ok: true, definitive: true, currentHeadSha, expectedCommitSha: expected, parentSha, treeSha };
}

export async function rollbackCheckpoint({ adapter, checkpoint, reason = 'manual', expectedCurrentHeadSha = '' } = {}) {
  if (!adapter || !checkpoint?.id || !checkpoint?.branch || !checkpoint?.baseTreeSha) throw new Error('ROLLBACK_CONTEXT_REQUIRED');
  const ref = await adapter.getRef(checkpoint.branch);
  const currentHeadSha = String(ref?.object?.sha || '');
  const expected = String(expectedCurrentHeadSha || checkpoint.appliedCommitSha || checkpoint.shadowCommitSha || '');
  if (!currentHeadSha) throw new Error('ROLLBACK_HEAD_MISSING');
  if (expected && currentHeadSha !== expected) {
    const error = new Error(`ROLLBACK_REFUSED_BRANCH_CHANGED: ${checkpoint.branch} está em ${currentHeadSha.slice(0, 8)}, esperado ${expected.slice(0, 8)}.`);
    error.code = 'ROLLBACK_REFUSED_BRANCH_CHANGED';
    throw error;
  }

  const rollbackCommit = await adapter.createCommit(
    `revert: Lovable Decrypter checkpoint ${String(checkpoint.id).slice(0, 8)}`,
    checkpoint.baseTreeSha,
    currentHeadSha
  );
  await adapter.updateBranch(checkpoint.branch, rollbackCommit.sha);
  const updated = await updateCheckpoint(checkpoint.id, {
    status: reason === 'automatic' ? 'rolled-back-auto' : 'rolled-back-manual',
    rolledBackAt: nowIso(),
    rollbackMode: reason,
    rollbackCommitSha: rollbackCommit.sha,
    note: reason === 'automatic' ? 'Rollback automático após falha definitiva de verificação pós-publicação.' : 'Rollback solicitado pelo usuário.'
  });
  return {
    branch: checkpoint.branch,
    restoredTreeSha: checkpoint.baseTreeSha,
    previousHeadSha: currentHeadSha,
    rollbackCommitSha: rollbackCommit.sha,
    checkpoint: updated || checkpoint
  };
}

export async function autoRollbackIfDefinitiveFailure({ adapter, checkpoint, verification } = {}) {
  if (!verification || verification.ok || !verification.definitive) return { rolledBack: false, verification };
  const result = await rollbackCheckpoint({
    adapter,
    checkpoint,
    reason: 'automatic',
    expectedCurrentHeadSha: verification.currentHeadSha
  });
  return { rolledBack: true, verification, result };
}

export async function listCheckpoints({ owner = '', repo = '', branch = '' } = {}) {
  const list = await loadCheckpoints();
  return list.filter(item => {
    if (owner && item.owner !== owner) return false;
    if (repo && item.repository !== repo) return false;
    if (branch && item.branch !== branch) return false;
    return true;
  });
}

export { CHECKPOINT_KEY };
