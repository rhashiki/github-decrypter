import { isTextPath, isSensitivePath, nowIso } from './utils.js';

const INDEX_PREFIX = 'ld2_repo_cache_index_v1_';
const BLOB_PREFIX = 'ld2_repo_blob_v1_';
const MAX_TEXT_BLOB = 300000;
const FETCH_CONCURRENCY = 6;

function repoKey(owner, repo, branch) {
  return `${INDEX_PREFIX}${encodeURIComponent(owner || '')}:${encodeURIComponent(repo || '')}:${encodeURIComponent(branch || 'main')}`;
}

function blobKey(sha) { return `${BLOB_PREFIX}${sha}`; }

async function getMany(keys) {
  const out = {};
  for (let i = 0; i < keys.length; i += 150) {
    Object.assign(out, await chrome.storage.local.get(keys.slice(i, i + 150)));
  }
  return out;
}

async function setMany(entries) {
  for (let i = 0; i < entries.length; i += 80) {
    await chrome.storage.local.set(Object.fromEntries(entries.slice(i, i + 80)));
  }
}

export async function getRepositoryCache(owner, repo, branch = 'main') {
  const key = repoKey(owner, repo, branch);
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

export async function getCachedText(sha) {
  if (!sha) return null;
  const key = blobKey(sha);
  const data = await chrome.storage.local.get(key);
  const item = data[key];
  return item?.kind === 'text' && typeof item.content === 'string' ? item.content : null;
}

export async function getCachedFile(index, path) {
  const item = index?.tree?.find?.(x => x.type === 'blob' && x.path === path);
  if (!item?.sha) return null;
  const content = await getCachedText(item.sha);
  return content == null ? null : { ...item, content };
}

export async function syncRepositoryCache(adapter, options = {}) {
  const branch = options.branch || adapter.branch || 'main';
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const ref = await adapter.getRef(branch);
  const headSha = ref?.object?.sha || '';
  const current = await getRepositoryCache(adapter.owner, adapter.repo, branch);
  if (current?.headSha && current.headSha === headSha) {
    onProgress({ phase: 'cache', cached: current.cachedTextFiles || 0, total: current.cacheableTextFiles || 0, hit: true });
    return { ...current, cacheHit: true };
  }

  const treeResponse = await adapter.getTree(branch, true);
  if (treeResponse.truncated) throw new Error('Árvore do repositório truncada pelo GitHub; o cache completo não pôde ser atualizado.');
  const tree = (treeResponse.tree || []).map(x => ({ path: x.path, type: x.type, sha: x.sha, size: Number(x.size || 0), mode: x.mode || '' }));
  const textItems = tree.filter(x => x.type === 'blob' && x.path && !isSensitivePath(x.path) && isTextPath(x.path) && x.size <= MAX_TEXT_BLOB);
  const keys = textItems.map(x => blobKey(x.sha));
  const existing = await getMany(keys);
  const missing = textItems.filter(x => !existing[blobKey(x.sha)]);
  let fetched = 0;
  const writes = [];

  for (let start = 0; start < missing.length; start += FETCH_CONCURRENCY) {
    const batch = missing.slice(start, start + FETCH_CONCURRENCY);
    const results = await Promise.all(batch.map(async item => {
      try {
        const content = await adapter.getBlob(item.sha);
        return [blobKey(item.sha), { kind: 'text', sha: item.sha, size: item.size, content, cachedAt: nowIso() }];
      } catch (_) { return null; }
    }));
    for (const row of results) if (row) { writes.push(row); fetched++; }
    if (writes.length >= 80) { await setMany(writes.splice(0)); }
    onProgress({ phase: 'cache', cached: textItems.length - missing.length + fetched, total: textItems.length, hit: false });
  }
  if (writes.length) await setMany(writes);

  const index = {
    owner: adapter.owner,
    repo: adapter.repo,
    branch,
    headSha,
    updatedAt: nowIso(),
    tree,
    totalFiles: tree.filter(x => x.type === 'blob').length,
    cacheableTextFiles: textItems.length,
    cachedTextFiles: textItems.length - missing.length + fetched
  };
  await chrome.storage.local.set({ [repoKey(adapter.owner, adapter.repo, branch)]: index });
  return { ...index, cacheHit: false };
}
