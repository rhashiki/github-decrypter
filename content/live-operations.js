(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__) return;
  window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;

  const baseRuntime = api.runtime.bind(api);
  const STORAGE_KEY = 'ld2_activity_history_v1';
  const MAX_HISTORY = 200;
  const MAX_STAGES = 80;
  const MAX_COMMAND = 4000;
  const EXECUTION_TYPES = new Set(['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE', 'LD2_PLAN_PREPARE']);
  const active = new Map();
  const bundleToOperation = new Map();
  const rulesByProject = new Map();
  let history = [];
  let loaded = false;
  let persistTimer = 0;

  const now = () => Date.now();
  const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];
  const cleanText = (value, max = 2000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  async function load() {
    if (loaded) return history;
    const data = await chrome.storage.local.get(STORAGE_KEY);
    history = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY].filter(Boolean).slice(0, MAX_HISTORY) : [];
    const bootAt = now();
    let changed = false;
    history = history.map(item => {
      if (item?.status !== 'running') return item;
      changed = true;
      return {
        ...item,
        status: 'interrupted',
        endedAt: item.endedAt || bootAt,
        updatedAt: bootAt,
        durationMs: Math.max(0, (item.endedAt || bootAt) - Number(item.startedAt || bootAt)),
        error: item.error || 'Operação interrompida por reload/reinício antes de um resultado final observável.'
      };
    });
    loaded = true;
    if (changed) await chrome.storage.local.set({ [STORAGE_KEY]: history });
    for (const item of history) if (item?.bundleId) bundleToOperation.set(String(item.bundleId), String(item.id));
    return history;
  }

  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      const byId = new Map(history.map(item => [String(item.id), item]));
      for (const [id, item] of active) byId.set(String(id), item);
      history = [...byId.values()].sort((a, b) => Number(b.updatedAt || b.startedAt || 0) - Number(a.updatedAt || a.startedAt || 0)).slice(0, MAX_HISTORY);
      await chrome.storage.local.set({ [STORAGE_KEY]: history });
      window.dispatchEvent(new CustomEvent('ld2:activity-history', { detail: snapshot() }));
    }, 180);
  }

  function modeFor(type) {
    if (type === 'LD2_PLAN_ONLY') return 'plan';
    if (type === 'LD2_PLAN_PREPARE') return 'shadow';
    if (type === 'LD2_PLAN_APPROVE') return 'approved-build';
    if (type === 'LD2_BUILD_EXECUTE') return 'build';
    if (type === 'LD2_PLAN_APPLY') return 'apply';
    return 'operation';
  }

  async function executionContext(message) {
    let settings = {};
    try { settings = await baseRuntime({ type: 'LD2_SETTINGS_GET' }) || {}; } catch (_) {}
    const projectId = String(message?.projectId || api.getProjectId?.() || '');
    const mapping = projectId ? settings?.projectMappings?.[projectId] || {} : {};
    const github = { ...(settings?.github || {}), ...mapping };
    let rulesCount = rulesByProject.get(projectId) ?? null;
    if (rulesCount == null && github?.owner && github?.repo) {
      const key = `ld2_project_rules_snapshot_${github.owner}_${github.repo}`;
      try {
        const local = await chrome.storage.local.get(key);
        rulesCount = Array.isArray(local[key]) ? local[key].length : 0;
      } catch (_) { rulesCount = null; }
    }
    return {
      projectId,
      repo: github?.owner && github?.repo ? `${github.owner}/${github.repo}` : '',
      branch: String(github?.branch || 'main'),
      model: String(settings?.gemini?.model || '').replace(/^models\//, ''),
      provider: 'Gemini',
      rulesCount
    };
  }

  function publicAttachments(raw = []) {
    return (Array.isArray(raw) ? raw : []).filter(item => item?.internal !== true).slice(0, 8).map(item => ({
      name: String(item?.name || 'arquivo').slice(0, 240),
      mimeType: String(item?.mimeType || 'application/octet-stream').slice(0, 120),
      size: Number(item?.size || 0)
    }));
  }

  async function begin(message) {
    await load();
    const id = String(message?.requestId || crypto.randomUUID());
    const ctx = await executionContext(message);
    const startedAt = now();
    const operation = {
      id,
      requestId: id,
      type: String(message?.type || ''),
      mode: modeFor(String(message?.type || '')),
      source: String(message?.source || 'decrypter'),
      command: cleanText(message?.command || '', MAX_COMMAND),
      projectId: ctx.projectId,
      repo: ctx.repo,
      branch: ctx.branch,
      provider: ctx.provider,
      model: ctx.model,
      rulesCount: ctx.rulesCount,
      skills: [],
      skillMethod: '',
      skillWarning: '',
      attachments: publicAttachments(message?.attachments),
      files: [],
      dependencies: [],
      warnings: [],
      stages: [],
      commit: null,
      telemetry: { reported: false, inputTokens: null, outputTokens: null, totalTokens: null, cost: null, currency: null },
      rag: { active: true, consulted: false, status: 'pending', hitCount: 0, vectorHits: 0, keywordOnlyHits: 0, sourceCount: 0, citations: [], retrieval: 'hybrid-vector-keyword', embeddingModel: 'gte-small', note: 'Aguardando consulta ao Decrypter Knowledge.' },
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      endedAt: null,
      durationMs: 0,
      error: ''
    };
    active.set(id, operation);
    schedulePersist();
    window.dispatchEvent(new CustomEvent('ld2:activity-operation', { detail: { kind: 'started', operation: structuredClone(operation) } }));
    return operation;
  }

  function operationById(id) {
    const key = String(id || '');
    return active.get(key) || history.find(item => String(item?.id) === key) || null;
  }

  function update(id, patch = {}, kind = 'updated') {
    const operation = operationById(id);
    if (!operation) return null;
    const updated = { ...operation, ...patch, updatedAt: now() };
    if (active.has(String(id))) active.set(String(id), updated);
    else history = history.map(item => String(item?.id) === String(id) ? updated : item);
    if (updated.bundleId) bundleToOperation.set(String(updated.bundleId), String(updated.id));
    schedulePersist();
    window.dispatchEvent(new CustomEvent('ld2:activity-operation', { detail: { kind, operation: structuredClone(updated) } }));
    return updated;
  }

  function addStage(id, payload = {}) {
    const operation = operationById(id);
    if (!operation) return null;
    const stage = {
      at: now(),
      stage: cleanText(payload.stage || 'progress', 80),
      label: cleanText(payload.label || payload.stage || 'Progresso', 180),
      detail: cleanText(payload.detail || '', 800),
      status: cleanText(payload.status || 'active', 40),
      elapsedMs: Number.isFinite(Number(payload.elapsedMs)) ? Number(payload.elapsedMs) : Math.max(0, now() - Number(operation.startedAt || now())),
      current: Number.isFinite(Number(payload.current)) ? Number(payload.current) : null,
      total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : null,
      found: Number.isFinite(Number(payload.found)) ? Number(payload.found) : null,
      totalFiles: Number.isFinite(Number(payload.totalFiles)) ? Number(payload.totalFiles) : null
    };
    const stages = [...(operation.stages || []), stage].slice(-MAX_STAGES);
    return update(id, { stages, durationMs: stage.elapsedMs }, 'progress');
  }

  function telemetryFrom(value) {
    const candidates = [value?.telemetry, value?.usage, value?.meta?.usage, value?.metadata?.usage, value?.result?.telemetry, value?.result?.usage].filter(Boolean);
    for (const raw of candidates) {
      if (!raw || typeof raw !== 'object') continue;
      const inputTokens = raw.inputTokens ?? raw.input_tokens ?? raw.promptTokenCount ?? raw.prompt_tokens ?? null;
      const outputTokens = raw.outputTokens ?? raw.output_tokens ?? raw.candidatesTokenCount ?? raw.completion_tokens ?? null;
      const totalTokens = raw.totalTokens ?? raw.total_tokens ?? raw.totalTokenCount ?? (inputTokens != null && outputTokens != null ? Number(inputTokens) + Number(outputTokens) : null);
      const cost = raw.cost ?? raw.cost_usd ?? raw.amount ?? null;
      const currency = raw.currency ?? (raw.cost_usd != null ? 'USD' : null);
      if ([inputTokens, outputTokens, totalTokens, cost].some(v => v != null)) {
        return {
          reported: true,
          inputTokens: inputTokens == null ? null : Number(inputTokens),
          outputTokens: outputTokens == null ? null : Number(outputTokens),
          totalTokens: totalTokens == null ? null : Number(totalTokens),
          cost: cost == null ? null : Number(cost),
          currency: currency ? String(currency) : null
        };
      }
    }
    return null;
  }

  function ragFrom(value) {
    const candidates = [
      value?.intelligence?.knowledge,
      value?.plan?.intelligence?.knowledge,
      value?.bundle?.plan?.intelligence?.knowledge,
      value?.result?.intelligence?.knowledge,
      value?.result?.plan?.intelligence?.knowledge
    ].filter(Boolean);
    const knowledge = candidates[0];
    if (!knowledge || typeof knowledge !== 'object') return null;
    const citations = (Array.isArray(knowledge.citations) ? knowledge.citations : []).slice(0, 8).map(item => ({
      title: cleanText(item?.title || '', 240),
      url: String(item?.url || '').slice(0, 1000),
      category: cleanText(item?.category || '', 60)
    })).filter(item => item.url);
    const hitCount = Math.max(0, Number(knowledge.hit_count || 0));
    return {
      active: knowledge.active === true,
      consulted: Number(knowledge.build || 16) === 16,
      status: cleanText(knowledge.status || (knowledge.active ? (hitCount ? 'ready' : 'empty') : 'degraded'), 40),
      hitCount,
      vectorHits: Math.max(0, Number(knowledge.vector_hits || 0)),
      keywordOnlyHits: Math.max(0, Number(knowledge.keyword_only_hits || 0)),
      sourceCount: new Set(citations.map(item => item.url)).size,
      citations,
      retrieval: cleanText(knowledge.retrieval || 'hybrid-vector-keyword', 80),
      embeddingModel: cleanText(knowledge.embedding_model || 'gte-small', 80),
      note: knowledge.active === false ? 'Knowledge consultado em modo degradado; a operação prosseguiu sem tornar o RAG uma autoridade.' : ''
    };
  }

  function resultPatch(output) {
    const bundle = output?.bundle || (output?.id && output?.plan ? output : null);
    const plan = bundle?.plan || (output?.plan && !Array.isArray(output.plan) ? output.plan : null);
    const result = output?.result || null;
    const files = (Array.isArray(plan?.files) ? plan.files : []).map(file => ({
      path: String(file?.path || '').slice(0, 500),
      action: String(file?.action || file?.reason ? file?.action || 'planned' : '').slice(0, 40),
      explanation: cleanText(file?.explanation || file?.reason || '', 600)
    })).filter(file => file.path);
    const warnings = unique([...(plan?.warnings || []), ...(output?.warnings || [])]).slice(0, 30);
    const dependencies = unique(plan?.dependencies || output?.dependencies || []).slice(0, 30);
    const commitSha = String(result?.commitSha || output?.commitSha || '').trim();
    const commit = commitSha ? {
      sha: commitSha,
      branch: String(result?.branch || bundle?.github?.branch || output?.github?.branch || ''),
      url: String(result?.commitUrl || output?.commitUrl || '')
    } : null;
    const telemetry = telemetryFrom(output);
    const rag = ragFrom(output);
    return {
      ...(bundle?.id ? { bundleId: String(bundle.id) } : {}),
      ...(files.length ? { files } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(dependencies.length ? { dependencies } : {}),
      ...(commit ? { commit } : {}),
      ...(telemetry ? { telemetry } : {}),
      ...(rag ? { rag } : {})
    };
  }

  function finalize(id, status, output = null, error = '') {
    const operation = operationById(id);
    if (!operation) return null;
    const endedAt = now();
    const patch = output ? resultPatch(output) : {};
    const updated = update(id, {
      ...patch,
      status,
      endedAt,
      durationMs: Math.max(Number(operation.durationMs || 0), endedAt - Number(operation.startedAt || endedAt)),
      error: cleanText(error, 1600)
    }, status);
    if (status !== 'prepared') active.delete(String(id));
    if (updated?.bundleId) bundleToOperation.set(String(updated.bundleId), String(updated.id));
    schedulePersist();
    return updated;
  }

  async function handleExecution(message) {
    const requestId = String(message?.requestId || crypto.randomUUID());
    const prepared = { ...message, requestId };
    await begin(prepared);
    try {
      const output = await baseRuntime(prepared);
      const patch = resultPatch(output);
      if (patch.bundleId) bundleToOperation.set(String(patch.bundleId), requestId);
      if (String(message?.type) === 'LD2_PLAN_PREPARE') {
        update(requestId, { ...patch, status: 'prepared', durationMs: now() - Number(operationById(requestId)?.startedAt || now()) }, 'prepared');
      } else {
        finalize(requestId, 'completed', output);
      }
      return output;
    } catch (error) {
      finalize(requestId, 'failed', null, error?.message || String(error));
      throw error;
    }
  }

  async function handleApply(message) {
    await load();
    const bundleId = String(message?.id || '');
    let operationId = bundleToOperation.get(bundleId) || history.find(item => String(item?.bundleId || '') === bundleId)?.id || '';
    if (!operationId) {
      const syntheticId = `apply:${bundleId || crypto.randomUUID()}`;
      const synthetic = await begin({ ...message, type: 'LD2_PLAN_APPLY', requestId: syntheticId, command: 'Aplicar Shadow Build preparado' });
      operationId = synthetic.id;
      update(operationId, { bundleId }, 'updated');
    } else if (!active.has(String(operationId))) {
      const existing = operationById(operationId);
      if (existing) active.set(String(operationId), { ...existing, status: 'running', endedAt: null, updatedAt: now() });
    }
    addStage(operationId, { stage: 'apply', label: 'Aplicando Shadow Build', detail: 'Apply solicitado explicitamente pelo usuário.', status: 'active' });
    try {
      const output = await baseRuntime(message);
      addStage(operationId, { stage: 'apply', label: 'GitHub atualizado', detail: output?.commitSha ? `Commit ${String(output.commitSha).slice(0, 12)} confirmado.` : 'Apply concluído.', status: 'done' });
      finalize(operationId, 'completed', { result: output });
      return output;
    } catch (error) {
      finalize(operationId, 'failed', null, error?.message || String(error));
      throw error;
    }
  }

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (EXECUTION_TYPES.has(type)) return handleExecution(message);
    if (type === 'LD2_PLAN_APPLY') return handleApply(message);
    return baseRuntime(message);
  };

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'LD2_PROGRESS' || !message?.requestId) return;
    addStage(String(message.requestId), message);
  });

  window.addEventListener('ld2:skills-routed', event => {
    const detail = event.detail || {};
    const id = String(detail.requestId || '');
    if (!id || !operationById(id)) return;
    update(id, {
      skills: unique(detail.slugs || []).slice(0, 12),
      skillMethod: cleanText(detail.method || '', 160),
      skillWarning: cleanText(detail.warning || '', 400)
    }, 'context');
  });

  window.addEventListener('ld2:project-rules-synced', event => {
    const detail = event.detail || {};
    const projectId = String(detail.projectId || '');
    const count = Number(detail.count || 0);
    if (projectId) rulesByProject.set(projectId, count);
    for (const [id, operation] of active) {
      if (projectId && operation.projectId === projectId) update(id, { rulesCount: count }, 'context');
    }
  });

  function snapshot() {
    const all = [...active.values(), ...history.filter(item => !active.has(String(item.id)))]
      .sort((a, b) => Number(b.updatedAt || b.startedAt || 0) - Number(a.updatedAt || a.startedAt || 0))
      .slice(0, MAX_HISTORY);
    return Object.freeze({
      active: all.filter(item => ['running', 'prepared'].includes(item.status)),
      history: all,
      count: all.length,
      storageKey: STORAGE_KEY,
      ragActive: true
    });
  }

  async function clearCompleted() {
    await load();
    const kept = history.filter(item => ['running', 'prepared'].includes(item?.status));
    history = kept;
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
    window.dispatchEvent(new CustomEvent('ld2:activity-history', { detail: snapshot() }));
    return history.length;
  }

  load().then(() => window.dispatchEvent(new CustomEvent('ld2:activity-history', { detail: snapshot() }))).catch(() => {});

  window.LovableDecrypterLiveOperations = Object.freeze({
    snapshot,
    list: async () => { await load(); return snapshot().history; },
    get: id => operationById(id),
    clearCompleted,
    build: 16
  });
})();
