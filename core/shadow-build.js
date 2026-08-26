function assertTextSanity(file) {
  const path = String(file?.path || '');
  const action = String(file?.action || '').toLowerCase();
  if (action === 'delete') return;
  if (typeof file?.content !== 'string') throw new Error(`SHADOW_BUILD_INVALID_CONTENT: ${path}`);
  if (/^(?:<<<<<<<|=======|>>>>>>>) /m.test(file.content) || /(?:^|\n)(?:<<<<<<<|=======|>>>>>>>)\s/m.test(file.content)) {
    throw new Error(`SHADOW_BUILD_CONFLICT_MARKER: ${path}`);
  }
  if (/\.json$/i.test(path)) {
    try { JSON.parse(file.content); }
    catch (error) { throw new Error(`SHADOW_BUILD_INVALID_JSON: ${path} · ${error?.message || error}`); }
  }
}

export function validateShadowFiles(files = []) {
  if (!Array.isArray(files) || !files.length) throw new Error('SHADOW_BUILD_NO_FILES');
  for (const file of files) assertTextSanity(file);
  return {
    ok: true,
    fileCount: files.length,
    checks: ['content-present', 'conflict-markers', 'json-parse'],
    limitations: ['typescript-compiler-not-available-in-extension-runtime', 'project-build-lint-tests-require-external-runner']
  };
}

export async function prepareShadowBuild({ adapter, bundle }) {
  if (!adapter) throw new Error('SHADOW_BUILD_ADAPTER_REQUIRED');
  const files = Array.isArray(bundle?.plan?.files) ? bundle.plan.files : [];
  const validation = validateShadowFiles(files);
  const branch = String(bundle?.github?.branch || adapter.branch || 'main');
  const baseRef = await adapter.getRef(branch);
  const baseCommitSha = String(baseRef?.object?.sha || '');
  if (!baseCommitSha) throw new Error('SHADOW_BUILD_BASE_REF_MISSING');
  if (bundle?.baseHeadSha && String(bundle.baseHeadSha) !== baseCommitSha) {
    throw new Error(`SHADOW_BUILD_BASE_MOVED: ${branch}`);
  }
  const baseCommit = await adapter.getCommit(baseCommitSha);
  const baseTree = String(baseCommit?.tree?.sha || '');
  if (!baseTree) throw new Error('SHADOW_BUILD_BASE_TREE_MISSING');

  const entries = [];
  for (const file of files) {
    const path = String(file.path || '');
    const action = String(file.action || '').toLowerCase();
    if (action === 'delete') {
      entries.push({ path, mode: '100644', type: 'blob', sha: null });
    } else {
      const blob = await adapter.createBlob(file.content);
      if (!blob?.sha) throw new Error(`SHADOW_BUILD_BLOB_FAILED: ${path}`);
      entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }
  }

  const tree = await adapter.createTree(baseTree, entries);
  if (!tree?.sha) throw new Error('SHADOW_BUILD_TREE_FAILED');
  const message = bundle?.plan?.commit_message || `feat: ${bundle?.plan?.summary || 'Lovable Decrypter changes'}`;
  const commit = await adapter.createCommit(message, tree.sha, baseCommitSha);
  if (!commit?.sha) throw new Error('SHADOW_BUILD_COMMIT_FAILED');

  const fetched = await adapter.getCommit(commit.sha);
  const parentSha = String(fetched?.parents?.[0]?.sha || '');
  const fetchedTree = String(fetched?.tree?.sha || '');
  if (parentSha !== baseCommitSha || fetchedTree !== tree.sha) {
    throw new Error('SHADOW_BUILD_INTEGRITY_MISMATCH');
  }

  return {
    ok: true,
    branch,
    baseCommitSha,
    baseTreeSha: baseTree,
    treeSha: tree.sha,
    commitSha: commit.sha,
    commitMessage: message,
    validation,
    createdAt: new Date().toISOString()
  };
}

export async function applyShadowBuild({ adapter, shadow }) {
  if (!adapter || !shadow?.commitSha || !shadow?.baseCommitSha) throw new Error('SHADOW_BUILD_INVALID');
  const current = await adapter.getRef(shadow.branch);
  const currentSha = String(current?.object?.sha || '');
  if (currentSha !== String(shadow.baseCommitSha)) {
    throw new Error(`SHADOW_BUILD_BASE_MOVED: ${shadow.branch}`);
  }
  await adapter.updateBranch(shadow.branch, shadow.commitSha);
  return {
    branch: shadow.branch,
    commitSha: shadow.commitSha,
    commitUrl: `https://github.com/${adapter.owner}/${adapter.repo}/commit/${shadow.commitSha}`,
    pullRequest: null,
    shadow: {
      treeSha: shadow.treeSha,
      baseCommitSha: shadow.baseCommitSha,
      validation: shadow.validation
    }
  };
}
