function normalizeAction(value) {
  const action = String(value || 'update').toLowerCase();
  return ['create', 'update', 'delete'].includes(action) ? action : '';
}

function entryMap(entries = []) {
  return new Map((Array.isArray(entries) ? entries : [])
    .filter(entry => entry && entry.path && entry.type !== 'tree')
    .map(entry => [String(entry.path), {
      sha: entry.sha == null ? null : String(entry.sha),
      mode: String(entry.mode || ''),
      type: String(entry.type || '')
    }]));
}

function entryChanged(before, after) {
  if (!before && !after) return false;
  if (!before || !after) return true;
  return before.sha !== after.sha || before.mode !== after.mode || before.type !== after.type;
}

export function evaluateRegressionDelta({ files = [], baseEntries = [], shadowEntries = [] } = {}) {
  const violations = [];
  const warnings = [];
  const expected = new Map();

  if (!Array.isArray(files) || !files.length) violations.push('Plano sem arquivos para validar.');

  for (const file of Array.isArray(files) ? files : []) {
    const path = String(file?.path || '').trim();
    const action = normalizeAction(file?.action);
    if (!path) {
      violations.push('Plano contém caminho vazio.');
      continue;
    }
    if (!action) {
      violations.push(`Ação inválida no plano: ${path}`);
      continue;
    }
    if (expected.has(path)) {
      violations.push(`Arquivo duplicado no plano: ${path}`);
      continue;
    }
    expected.set(path, { action, file });

    if (action !== 'delete' && typeof file?.content !== 'string') {
      violations.push(`Conteúdo ausente no plano: ${path}`);
    }
    if (action === 'update' && typeof file?.before === 'string' && file.before.length >= 400 && typeof file?.content === 'string') {
      const ratio = file.content.length / Math.max(1, file.before.length);
      if (ratio < 0.25) warnings.push(`Redução acentuada de conteúdo em ${path} (${Math.round(ratio * 100)}% do tamanho anterior).`);
    }
  }

  const base = entryMap(baseEntries);
  const shadow = entryMap(shadowEntries);
  const allPaths = new Set([...base.keys(), ...shadow.keys()]);
  const changedPaths = [...allPaths].filter(path => entryChanged(base.get(path), shadow.get(path))).sort();

  for (const path of changedPaths) {
    if (!expected.has(path)) violations.push(`Shadow Build alterou caminho fora do plano: ${path}`);
  }

  for (const [path, spec] of expected.entries()) {
    const before = base.get(path);
    const after = shadow.get(path);
    const changed = entryChanged(before, after);

    if (!changed) {
      violations.push(`Arquivo planejado não mudou no Shadow Build: ${path}`);
      continue;
    }

    if (spec.action === 'create') {
      if (before) violations.push(`Create sobrescreveria arquivo existente: ${path}`);
      if (!after) violations.push(`Create não materializado no Shadow Build: ${path}`);
    } else if (spec.action === 'update') {
      if (!before) violations.push(`Update aponta para arquivo inexistente na base: ${path}`);
      if (!after) violations.push(`Update removeu arquivo inesperadamente: ${path}`);
    } else if (spec.action === 'delete') {
      if (!before) violations.push(`Delete aponta para arquivo inexistente na base: ${path}`);
      if (after) violations.push(`Delete não removeu o arquivo no Shadow Build: ${path}`);
    }
  }

  return {
    ok: violations.length === 0,
    plannedFileCount: expected.size,
    changedPathCount: changedPaths.length,
    changedPaths,
    warnings,
    violations,
    checks: [
      'shadow-parent-and-tree',
      'planned-paths-only',
      'create-update-delete-semantics',
      'no-silent-noop'
    ]
  };
}

export async function runRegressionSentinel({ adapter, bundle, shadow } = {}) {
  if (!adapter) throw new Error('REGRESSION_SENTINEL_ADAPTER_REQUIRED');
  if (!shadow?.commitSha || !shadow?.baseCommitSha || !shadow?.baseTreeSha || !shadow?.treeSha) {
    throw new Error('REGRESSION_SENTINEL_SHADOW_REQUIRED');
  }

  const commit = await adapter.getCommit(shadow.commitSha);
  const parentSha = String(commit?.parents?.[0]?.sha || '');
  const treeSha = String(commit?.tree?.sha || '');
  const metadataViolations = [];
  if (parentSha !== String(shadow.baseCommitSha)) metadataViolations.push('O commit sombra não aponta para o commit base esperado.');
  if (treeSha !== String(shadow.treeSha)) metadataViolations.push('A árvore do commit sombra diverge da árvore preparada.');

  const [baseTree, shadowTree] = await Promise.all([
    adapter.getTree(shadow.baseTreeSha, true),
    adapter.getTree(shadow.treeSha, true)
  ]);
  if (baseTree?.truncated || shadowTree?.truncated) metadataViolations.push('Árvore Git truncada; não é seguro validar o delta completo.');

  const evaluated = evaluateRegressionDelta({
    files: Array.isArray(bundle?.plan?.files) ? bundle.plan.files : [],
    baseEntries: baseTree?.tree || [],
    shadowEntries: shadowTree?.tree || []
  });
  const result = {
    ...evaluated,
    ok: metadataViolations.length === 0 && evaluated.ok,
    checkedAt: new Date().toISOString(),
    baseCommitSha: String(shadow.baseCommitSha),
    shadowCommitSha: String(shadow.commitSha),
    violations: [...metadataViolations, ...evaluated.violations]
  };

  if (!result.ok) {
    const error = new Error(`REGRESSION_SENTINEL_BLOCKED: ${result.violations.join(' | ')}`);
    error.code = 'REGRESSION_SENTINEL_BLOCKED';
    error.regressionSentinel = result;
    throw error;
  }
  return result;
}
