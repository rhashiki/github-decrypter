(() => {
  'use strict';
  if (window.__LD2_PROJECT_STATE_GRAPH_CORE__) return;
  window.__LD2_PROJECT_STATE_GRAPH_CORE__ = true;

  const SENSITIVE_PATH = /(^|\/)(\.env(?:\..*)?|.*(?:secret|credential|private[-_.]?key).*)(\/|$)|\.(?:pem|p12|pfx|key)$/i;

  const text = value => String(value ?? '').trim();
  const unique = values => [...new Set(values.map(text).filter(Boolean))];

  function safePath(value) {
    const path = text(value).replace(/\\/g, '/');
    if (!path || path.length > 1200 || path.startsWith('/') || path.includes('\0')) return '';
    const parts = path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) return '';
    return path;
  }

  function isSensitivePath(path) {
    return SENSITIVE_PATH.test(text(path));
  }

  function normalizeSha(value) {
    const sha = text(value).toLowerCase();
    return /^[0-9a-f]{40}$/.test(sha) ? sha : '';
  }

  async function gitBlobSha1(bytes) {
    const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const header = new TextEncoder().encode(`blob ${body.byteLength}\0`);
    const payload = new Uint8Array(header.byteLength + body.byteLength);
    payload.set(header, 0);
    payload.set(body, header.byteLength);
    const digest = await crypto.subtle.digest('SHA-1', payload);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function revisionsMatch(workspaceRevision, githubRevision) {
    const a = text(workspaceRevision).toLowerCase();
    const b = text(githubRevision).toLowerCase();
    return !!a && !!b && /^[0-9a-f]{40}$/.test(a) && a === b;
  }

  function migrationVersion(path) {
    const clean = safePath(path);
    const match = clean.match(/^supabase\/migrations\/([^/]+)\.sql$/i);
    if (!match) return '';
    const stem = match[1];
    return stem.match(/^(\d{8,20})/)?.[1] || stem;
  }

  function expectedMigrationVersions(files = []) {
    return unique(files.map(file => migrationVersion(file?.path || file))).sort();
  }

  function expectedEdgeFunctionSlugs(files = []) {
    const slugs = [];
    for (const file of files) {
      const clean = safePath(file?.path || file);
      const match = clean.match(/^supabase\/functions\/([^/]+)\//i);
      if (match) slugs.push(match[1]);
    }
    return unique(slugs).sort();
  }

  function reconcileSets(expected = [], actual = []) {
    const exp = unique(expected).sort();
    const act = unique(actual).sort();
    const expSet = new Set(exp);
    const actSet = new Set(act);
    return {
      expected: exp,
      actual: act,
      missing: exp.filter(value => !actSet.has(value)),
      remoteOnly: act.filter(value => !expSet.has(value)),
      matched: exp.filter(value => actSet.has(value))
    };
  }

  function reconcileBackendRefs({ lovableRef = '', mappedRef = '', inspectedRef = '' } = {}) {
    const refs = unique([lovableRef, mappedRef, inspectedRef]);
    let state = 'unknown';
    if (refs.length === 1) state = 'consistent';
    else if (refs.length > 1) state = 'mismatch';
    return {
      state,
      lovableRef: text(lovableRef),
      mappedRef: text(mappedRef),
      inspectedRef: text(inspectedRef),
      refs
    };
  }

  async function reconcileFiles({
    workspaceFiles = [],
    githubFiles = [],
    workspaceRevision = '',
    githubRevision = '',
    readWorkspaceBytes,
    maxHashFiles = 250,
    maxHashBytes = 48 * 1024 * 1024,
    maxHashFileBytes = 2 * 1024 * 1024
  } = {}) {
    const wMap = new Map();
    const gMap = new Map();
    for (const file of workspaceFiles) {
      const path = safePath(file?.path);
      if (path) wMap.set(path, { ...file, path });
    }
    for (const file of githubFiles) {
      const path = safePath(file?.path);
      if (path && file?.type !== 'tree') gMap.set(path, { ...file, path });
    }

    const sameRevision = revisionsMatch(workspaceRevision, githubRevision);
    const allPaths = unique([...wMap.keys(), ...gMap.keys()]).sort();
    const entries = [];
    const hashQueue = [];
    let hashedBytes = 0;

    for (const path of allPaths) {
      const lovable = wMap.get(path) || null;
      const github = gMap.get(path) || null;
      const sensitive = isSensitivePath(path) || !!lovable?.sensitive;
      const entry = {
        path,
        sensitive,
        lovable: lovable ? {
          exists: true,
          size: Number.isFinite(Number(lovable.size)) ? Number(lovable.size) : null,
          binary: !!lovable.binary
        } : { exists: false, size: null, binary: false },
        github: github ? {
          exists: true,
          size: Number.isFinite(Number(github.size)) ? Number(github.size) : null,
          sha: normalizeSha(github.sha)
        } : { exists: false, size: null, sha: '' },
        state: 'unknown',
        reason: ''
      };

      if (!lovable) {
        entry.state = 'github_only';
        entry.reason = 'missing_in_lovable';
      } else if (!github) {
        entry.state = 'lovable_only';
        entry.reason = 'missing_in_github';
      } else if (sameRevision) {
        entry.state = 'same';
        entry.reason = 'same_revision';
      } else if (
        entry.lovable.size != null &&
        entry.github.size != null &&
        entry.lovable.size !== entry.github.size
      ) {
        entry.state = 'mismatch';
        entry.reason = 'size_mismatch';
      } else if (sensitive) {
        entry.state = 'unknown';
        entry.reason = 'sensitive_not_read';
      } else if (!entry.github.sha) {
        entry.state = 'unknown';
        entry.reason = 'github_sha_unavailable';
      } else {
        const size = entry.lovable.size;
        if (
          typeof readWorkspaceBytes === 'function' &&
          hashQueue.length < maxHashFiles &&
          (size == null || size <= maxHashFileBytes) &&
          (size == null || hashedBytes + size <= maxHashBytes)
        ) {
          hashQueue.push({ entry, size: size || 0 });
          hashedBytes += size || 0;
        } else {
          entry.state = 'unknown';
          entry.reason = 'hash_budget_exceeded';
        }
      }
      entries.push(entry);
    }

    let hashedFiles = 0;
    for (let start = 0; start < hashQueue.length; start += 5) {
      const batch = hashQueue.slice(start, start + 5);
      const results = await Promise.all(batch.map(async item => {
        try {
          const bytes = await readWorkspaceBytes(item.entry.path);
          const sha = await gitBlobSha1(bytes);
          return { item, sha };
        } catch (error) {
          return { item, error };
        }
      }));
      for (const result of results) {
        const entry = result.item.entry;
        if (result.sha) {
          hashedFiles++;
          entry.state = result.sha === entry.github.sha ? 'same' : 'mismatch';
          entry.reason = result.sha === entry.github.sha ? 'git_blob_sha_match' : 'git_blob_sha_mismatch';
          entry.lovable.gitBlobSha = result.sha;
        } else {
          entry.state = 'unknown';
          entry.reason = 'workspace_read_failed';
        }
      }
    }

    const counts = { same: 0, mismatch: 0, lovable_only: 0, github_only: 0, unknown: 0 };
    for (const entry of entries) counts[entry.state] = (counts[entry.state] || 0) + 1;

    return {
      revisionsMatch: sameRevision,
      workspaceRevision: text(workspaceRevision),
      githubRevision: text(githubRevision),
      hashedFiles,
      counts,
      entries
    };
  }

  window.LovableDecrypterProjectStateGraphCore = Object.freeze({
    schema: 'ld-project-state-graph-core/1',
    safePath,
    isSensitivePath,
    gitBlobSha1,
    revisionsMatch,
    migrationVersion,
    expectedMigrationVersions,
    expectedEdgeFunctionSlugs,
    reconcileSets,
    reconcileBackendRefs,
    reconcileFiles
  });
})();