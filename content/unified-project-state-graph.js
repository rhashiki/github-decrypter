(() => {
  'use strict';
  if (window.__LD2_UNIFIED_PROJECT_STATE_GRAPH__) return;
  window.__LD2_UNIFIED_PROJECT_STATE_GRAPH__ = true;

  const GRAPH_SCHEMA = 'ld-project-state-graph/1';
  const CACHE_TTL_MS = 20000;
  const SESSION_LAST_KEY = 'ld2_project_state_graph_last';
  const SESSION_PREFIX = 'ld2_project_state_graph_';

  let cache = null;
  let inflight = null;

  const text = value => String(value ?? '').trim();
  const core = () => window.LovableDecrypterProjectStateGraphCore;
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => text(window.LovableDecrypterV2?.getProjectId?.());

  function graphKey(id) {
    return `${SESSION_PREFIX}${text(id).replace(/[^a-z0-9-]/gi, '').slice(0, 80)}`;
  }

  function repoCacheKey(owner, repo, branch = 'main') {
    return `ld2_repo_cache_index_v1_${encodeURIComponent(owner || '')}:${encodeURIComponent(repo || '')}:${encodeURIComponent(branch || 'main')}`;
  }

  async function portCall(action, payload = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const port = chrome.runtime.connect({ name: 'ld2-project-state' });
      const id = crypto.randomUUID();
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('PROJECT_STATE_TIMEOUT')), 65000);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else {
          const error = new Error(message.error || 'PROJECT_STATE_FAILED');
          error.code = message.code || '';
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function activeGithub(settings, id) {
    const mapping = id && settings?.projectMappings?.[id] ? settings.projectMappings[id] : {};
    return { ...(settings?.github || {}), ...(mapping || {}) };
  }

  function activeSupabase(settings, id) {
    const mapping = id && settings?.supabaseMappings?.[id] ? settings.supabaseMappings[id] : {};
    return { ...(settings?.supabase || {}), ...(mapping || {}) };
  }

  async function loadLovable(force = false) {
    const deep = window.LovableDecrypterWorkspaceDeepRead;
    if (!deep?.getSnapshot) throw new Error('WORKSPACE_DEEP_READ_UNAVAILABLE');
    const snapshot = await deep.getSnapshot({ force });
    let context = window.LovableDecrypterProjectRuntime?.getContext?.() || null;
    if (!context || context.projectId !== snapshot.projectId) {
      context = await window.LovableDecrypterProjectRuntime?.refresh?.(true).catch(() => null);
    }
    return { snapshot, context };
  }

  async function loadGithub(settings, id) {
    const github = activeGithub(settings, id);
    if (!github?.owner || !github?.repo) {
      return {
        available: false,
        reason: 'github_not_mapped',
        repo: '',
        branch: text(github?.branch || 'main'),
        headSha: '',
        files: []
      };
    }
    const warm = await runtime({ type: 'LD2_REPO_CACHE_WARM', projectId: id });
    const branch = text(warm?.branch || github.branch || 'main');
    const key = repoCacheKey(github.owner, github.repo, branch);
    const stored = await chrome.storage.local.get(key);
    const index = stored[key] || null;
    const tree = Array.isArray(index?.tree) ? index.tree : [];
    return {
      available: !!index?.headSha,
      reason: index?.headSha ? '' : 'github_cache_unavailable',
      repo: text(warm?.repo || `${github.owner}/${github.repo}`),
      owner: text(github.owner),
      name: text(github.repo),
      branch,
      headSha: text(index?.headSha || warm?.headSha),
      updatedAt: text(index?.updatedAt),
      complete: !!index && Number(index.totalFiles || 0) === tree.filter(item => item?.type === 'blob').length,
      files: tree
        .filter(item => item?.type === 'blob' && item?.path)
        .map(item => ({
          path: text(item.path),
          type: 'blob',
          sha: text(item.sha),
          size: Number.isFinite(Number(item.size)) ? Number(item.size) : null
        }))
    };
  }

  async function loadSupabase(settings, id, lovableContext) {
    const mapped = activeSupabase(settings, id);
    const lovableRef = text(lovableContext?.backend?.supabaseRef);
    const mappedRef = text(mapped?.projectRef || mapped?.ref);
    const targetRef = mappedRef || lovableRef;
    if (!targetRef) {
      return {
        available: false,
        reason: 'supabase_not_mapped',
        project: { ref: '' },
        database: { relations: [], columns: [], policies: [], routines: [], triggers: [], migrations: [] },
        edgeFunctions: [],
        auth: null,
        secrets: []
      };
    }
    try {
      const state = await portCall('inspect', { project_ref: targetRef });
      return { available: true, reason: '', ...state };
    } catch (error) {
      return {
        available: false,
        reason: error?.code || error?.message || 'supabase_inspection_failed',
        project: { ref: targetRef },
        database: { relations: [], columns: [], policies: [], routines: [], triggers: [], migrations: [] },
        edgeFunctions: [],
        auth: null,
        secrets: []
      };
    }
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function compactForSession(graph) {
    const driftFiles = (graph.files?.entries || []).filter(entry => entry.state !== 'same').slice(0, 500);
    return {
      schema: graph.schema,
      projectId: graph.projectId,
      collectedAt: graph.collectedAt,
      hash: graph.hash,
      status: graph.status,
      sources: graph.sources,
      backend: graph.backend,
      migrations: graph.migrations,
      edgeFunctions: graph.edgeFunctions,
      auth: graph.auth,
      files: {
        revisionsMatch: graph.files?.revisionsMatch || false,
        counts: graph.files?.counts || {},
        hashedFiles: graph.files?.hashedFiles || 0,
        drift: driftFiles,
        driftTruncated: (graph.files?.entries || []).filter(entry => entry.state !== 'same').length > driftFiles.length
      },
      diagnostics: graph.diagnostics
    };
  }

  function statusFrom(graph) {
    const files = graph.files?.counts || {};
    const fileDrift = Number(files.mismatch || 0) + Number(files.lovable_only || 0) + Number(files.github_only || 0);
    const backendMismatch = graph.backend?.state === 'mismatch';
    const migrationDrift = (graph.migrations?.missing || []).length + (graph.migrations?.remoteOnly || []).length;
    const functionDrift = (graph.edgeFunctions?.missing || []).length + (graph.edgeFunctions?.remoteOnly || []).length;
    const unavailable = Object.values(graph.sources || {}).some(source => source.required && !source.available);
    if (unavailable) return 'partial';
    if (fileDrift || backendMismatch || migrationDrift || functionDrift) return 'drift';
    if (Number(files.unknown || 0) > 0) return 'partial';
    return 'consistent';
  }

  async function buildGraph({ force = false, deepCompare = true } = {}) {
    const c = core();
    if (!c?.reconcileFiles) throw new Error('PROJECT_STATE_GRAPH_CORE_UNAVAILABLE');
    const id = projectId();
    if (!id) throw new Error('LOVABLE_PROJECT_UNAVAILABLE');

    const settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    const lovable = await loadLovable(force);
    const github = await loadGithub(settings, id).catch(error => ({
      available: false,
      reason: error?.message || 'github_state_failed',
      repo: '',
      branch: '',
      headSha: '',
      files: []
    }));
    const supabase = await loadSupabase(settings, id, lovable.context);

    const readWorkspaceBytes = deepCompare
      ? async path => {
          const file = await window.LovableDecrypterWorkspaceDeepRead.readFile(path, {
            ref: lovable.snapshot.ref,
            allowSensitive: false,
            asBytes: true
          });
          if (!file?.bytes) throw new Error('WORKSPACE_BYTES_UNAVAILABLE');
          return file.bytes;
        }
      : null;

    const fileState = await c.reconcileFiles({
      workspaceFiles: lovable.snapshot.files || [],
      githubFiles: github.files || [],
      workspaceRevision: lovable.snapshot.revision,
      githubRevision: github.headSha,
      readWorkspaceBytes,
      maxHashFiles: deepCompare ? 250 : 0,
      maxHashBytes: deepCompare ? 48 * 1024 * 1024 : 0,
      maxHashFileBytes: 2 * 1024 * 1024
    });

    const migrationState = c.reconcileSets(
      c.expectedMigrationVersions(lovable.snapshot.files || []),
      (supabase.database?.migrations || []).map(item => text(item?.version || item))
    );
    const edgeState = c.reconcileSets(
      c.expectedEdgeFunctionSlugs(lovable.snapshot.files || []),
      (supabase.edgeFunctions || []).map(item => text(item?.slug || item?.name || item))
    );
    const mappedSupabase = activeSupabase(settings, id);
    const backend = c.reconcileBackendRefs({
      lovableRef: text(lovable.context?.backend?.supabaseRef),
      mappedRef: text(mappedSupabase?.projectRef || mappedSupabase?.ref),
      inspectedRef: text(supabase.project?.ref)
    });

    const graph = {
      schema: GRAPH_SCHEMA,
      projectId: id,
      collectedAt: new Date().toISOString(),
      sources: {
        lovable: {
          required: true,
          available: true,
          source: lovable.snapshot.source,
          ref: lovable.snapshot.ref,
          revision: lovable.snapshot.revision,
          complete: !!lovable.snapshot.complete,
          fileCount: lovable.snapshot.stats?.fileCount ?? lovable.snapshot.files?.length ?? 0
        },
        github: {
          required: true,
          available: !!github.available,
          reason: github.reason || '',
          repo: github.repo || '',
          branch: github.branch || '',
          revision: github.headSha || '',
          complete: !!github.complete,
          fileCount: github.files?.length || 0
        },
        supabase: {
          required: false,
          available: !!supabase.available,
          reason: supabase.reason || '',
          projectRef: text(supabase.project?.ref),
          status: text(supabase.project?.status)
        }
      },
      backend,
      files: fileState,
      migrations: migrationState,
      edgeFunctions: {
        ...edgeState,
        deployed: supabase.edgeFunctions || []
      },
      database: {
        relationCount: supabase.database?.relations?.length || 0,
        columnCount: supabase.database?.columns?.length || 0,
        policyCount: supabase.database?.policies?.length || 0,
        routineCount: supabase.database?.routines?.length || 0,
        triggerCount: supabase.database?.triggers?.length || 0,
        relations: supabase.database?.relations || [],
        columns: supabase.database?.columns || [],
        policies: supabase.database?.policies || [],
        routines: supabase.database?.routines || [],
        triggers: supabase.database?.triggers || []
      },
      auth: supabase.auth || null,
      secretNames: Array.isArray(supabase.secrets) ? supabase.secrets : [],
      diagnostics: {
        deepCompare: !!deepCompare,
        workspaceComplete: !!lovable.snapshot.complete,
        githubComplete: !!github.complete,
        supabaseAvailable: !!supabase.available,
        sensitiveWorkspaceFiles: lovable.snapshot.stats?.sensitiveFiles || 0,
        note: 'Secret values are never included in the project state graph.'
      }
    };
    graph.status = statusFrom(graph);
    graph.hash = await sha256Hex({
      projectId: graph.projectId,
      sources: graph.sources,
      backend: graph.backend,
      fileCounts: graph.files.counts,
      migrations: graph.migrations,
      edgeFunctions: {
        missing: graph.edgeFunctions.missing,
        remoteOnly: graph.edgeFunctions.remoteOnly,
        matched: graph.edgeFunctions.matched
      },
      auth: graph.auth,
      secretNames: graph.secretNames
    });

    cache = { at: Date.now(), deepCompare: !!deepCompare, graph };
    const compact = compactForSession(graph);
    await chrome.storage.session.set({
      [SESSION_LAST_KEY]: compact,
      [graphKey(id)]: compact
    });
    window.dispatchEvent(new CustomEvent('ld2:project-state-graph', { detail: structuredClone(compact) }));
    return structuredClone(graph);
  }

  async function getGraph(options = {}) {
    const deepCompare = options.deepCompare !== false;
    if (
      !options.force &&
      cache?.graph?.projectId === projectId() &&
      cache.deepCompare === deepCompare &&
      Date.now() - cache.at < CACHE_TTL_MS
    ) return structuredClone(cache.graph);
    if (inflight) return inflight;
    inflight = buildGraph({ force: !!options.force, deepCompare })
      .finally(() => { inflight = null; });
    return inflight;
  }

  async function getStored(id = projectId()) {
    const key = id ? graphKey(id) : SESSION_LAST_KEY;
    const stored = await chrome.storage.session.get(key);
    return stored[key] || null;
  }

  function invalidate() {
    cache = null;
    window.LovableDecrypterWorkspaceDeepRead?.invalidate?.();
  }

  window.LovableDecrypterProjectStateGraph = Object.freeze({
    schema: GRAPH_SCHEMA,
    getGraph,
    getStored,
    invalidate
  });

  addEventListener('ld2:project', invalidate);
  addEventListener('hashchange', invalidate);
  addEventListener('popstate', invalidate);
})();