import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { buildProjectContextV2 } from './context-engine-runtime.js';
import { executeLocalChat, localRuntimeHealth } from './local-model-runtime.js';
import { invokeToolRuntimeAction } from './tool-runtime.js';
import { loadRecentUserEdits } from '../core/context-engine-v2.js';
import { assertScopeIntelligence, scopeIntelligenceFingerprint } from '../core/scope-intelligence-v2.js';
import { normalizeApprovalPlan } from '../core/approval-transaction.js';
import {
  localAgentProposalDigest,
  localAgentProposalFiles,
  localAgentProposalPaths,
  localAgentProposalPublic,
  normalizeLocalAgentWriteProposal
} from '../core/local-agent-approval.js';
import {
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  continuityDigest,
  getContinuityTask,
  listContinuityTasks,
  resumeContinuityTask,
  cancelContinuityTask
} from '../core/continuity-engine.js';

const PORT_NAME = 'ld2-local-agent-orchestrator';
const RUNS_KEY = 'ld68_local_agent_runs_v1';
const SESSION_PREFIX = 'ld68_local_agent_session_v1_';
const APPROVAL_TX_PREFIX = 'ld2_approval_tx_v1_';
const MAX_RUNS = 80;
const DEFAULT_MAX_ITERATIONS = 8;
const ALLOWED_READ_TOOLS = new Set(['repo.list_files','repo.read_file','repo.grep','repo.git_diff','repo.patch_preview','diagnostics.run','lsp.query']);
const ALLOWED_WRITE_TOOLS = new Set(['repo.patch_apply','repo.write_file']);

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const sessionKey = taskId => `${SESSION_PREFIX}${text(taskId, 160).replace(/[^a-z0-9-]/gi, '')}`;
const txKey = id => `${APPROVAL_TX_PREFIX}${text(id, 160).replace(/[^a-z0-9-]/gi, '')}`;

async function loadRuns() {
  const stored = await chrome.storage.local.get(RUNS_KEY);
  return Array.isArray(stored[RUNS_KEY]) ? stored[RUNS_KEY] : [];
}
async function saveRuns(rows) {
  await chrome.storage.local.set({ [RUNS_KEY]: (Array.isArray(rows) ? rows : []).slice(0, MAX_RUNS) });
}
async function upsertRun(patch = {}) {
  const rows = await loadRuns();
  const index = rows.findIndex(row => row?.taskId === patch.taskId);
  const next = { ...(index >= 0 ? rows[index] : {}), ...patch, updatedAt: nowIso() };
  if (index >= 0) rows[index] = next; else rows.unshift(next);
  await saveRuns(rows);
  return next;
}
async function getRun(taskId) {
  const rows = await loadRuns();
  return rows.find(row => row?.taskId === taskId) || null;
}
async function loadSession(taskId) {
  const stored = await chrome.storage.session.get(sessionKey(taskId));
  return stored[sessionKey(taskId)] || null;
}
async function saveSession(taskId, value) {
  await chrome.storage.session.set({ [sessionKey(taskId)]: value });
  return value;
}
async function clearSession(taskId) {
  await chrome.storage.session.remove(sessionKey(taskId));
}

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function currentHead(adapter, branch = 'main') {
  const ref = await adapter.getRef(branch || 'main');
  return text(ref?.object?.sha || ref?.sha, 160).toLowerCase();
}

function stripFence(value = '') {
  const source = String(value || '').trim();
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : source;
}
function parseJsonObject(value = '', code = 'LOCAL_AGENT_INVALID_JSON') {
  const source = stripFence(value);
  try { return JSON.parse(source); } catch (_) {
    const first = source.indexOf('{');
    const last = source.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(source.slice(first, last + 1)); } catch (_) {}
    }
  }
  throw Object.assign(new Error(code), { code });
}

function publicRun(row = {}) {
  return {
    schema: 'ld-local-agent/1',
    taskId: text(row?.taskId, 160),
    projectId: text(row?.projectId, 160),
    repo: text(row?.repo, 300),
    branch: text(row?.branch, 240),
    status: text(row?.status, 80),
    mode: text(row?.mode, 40),
    iteration: Math.max(0, Number(row?.iteration || 0) || 0),
    maxIterations: Math.max(1, Number(row?.maxIterations || DEFAULT_MAX_ITERATIONS) || DEFAULT_MAX_ITERATIONS),
    commandDigest: text(row?.commandDigest, 128),
    contextDigest: text(row?.contextDigest, 128),
    planDigest: text(row?.planDigest, 128),
    resumeGeneration: Math.max(0, Number(row?.resumeGeneration || 0) || 0),
    pendingWriteDigest: text(row?.pendingWriteDigest, 128),
    pendingTool: text(row?.pendingTool, 160),
    pendingPaths: Array.isArray(row?.pendingPaths) ? row.pendingPaths.slice(0, 30) : [],
    lastAction: text(row?.lastAction, 160),
    lastErrorCode: text(row?.lastErrorCode, 160),
    routeHistory: (Array.isArray(row?.routeHistory) ? row.routeHistory : []).slice(-16).map(item => ({
      tier: text(item?.tier, 40), model: text(item?.model, 240), degraded: item?.degraded === true, at: text(item?.at, 80)
    })),
    createdAt: text(row?.createdAt, 80),
    updatedAt: text(row?.updatedAt, 80),
    completedAt: text(row?.completedAt, 80),
    rawPromptPersistedDurably: false,
    rawModelOutputPersistedDurably: false,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false
  };
}

function compactTraceItem(result = {}) {
  const data = result?.data || {};
  const safe = {
    tool: text(result?.tool, 160),
    operationId: text(result?.operationId, 160),
    code: text(data?.code, 120),
    branch: text(data?.branch, 240),
    commitSha: text(data?.commitSha, 160),
    fileCount: Number(data?.fileCount || 0) || 0,
    matchCount: Number(data?.matchCount || 0) || 0
  };
  if (safe.tool === 'repo.read_file') {
    safe.path = text(data?.path, 1000);
    safe.blobSha = text(data?.blobSha, 160);
    safe.content = String(data?.content || '').slice(0, 60000);
  } else if (safe.tool === 'repo.grep') {
    safe.query = text(data?.query, 500);
    safe.matches = (Array.isArray(data?.matches) ? data.matches : []).slice(0, 80).map(item => ({
      path: text(item?.path, 1000), line: Number(item?.line || 0) || 0, preview: String(item?.preview || '').slice(0, 1000)
    }));
  } else if (safe.tool === 'repo.list_files') {
    safe.files = (Array.isArray(data?.files) ? data.files : []).slice(0, 300).map(item => ({ path: text(item?.path, 1000), sha: text(item?.sha, 160), size: Number(item?.size || 0) || 0 }));
  } else if (safe.tool === 'repo.git_diff') {
    safe.status = text(data?.status, 80);
    safe.files = (Array.isArray(data?.files) ? data.files : []).slice(0, 100).map(item => ({ path: text(item?.path, 1000), status: text(item?.status, 80), additions: Number(item?.additions || 0), deletions: Number(item?.deletions || 0), patch: String(item?.patch || '').slice(0, 8000) }));
  } else if (safe.tool === 'diagnostics.run' || safe.tool === 'lsp.query') {
    safe.result = JSON.stringify(data).slice(0, 30000);
  }
  return safe;
}

function compactForPrompt(value, max = 120000) {
  let raw = '';
  try { raw = JSON.stringify(value); } catch { raw = '{}'; }
  return raw.length > max ? `${raw.slice(0, max)}\n...[truncated in-memory agent trace]` : raw;
}

function planSystemPrompt() {
  return [
    'You are the Lovable Decrypter local planning model.',
    'Return ONLY valid JSON. No markdown.',
    'Schema: {"summary":string,"plan":string[],"files":[{"path":string,"reason":string}],"warnings":string[]}.',
    'Keep scope minimal and tied to the user request. Never include secrets, .env, keys, credentials, unrelated cleanup, or speculative files.',
    'Human edits outrank previous AI edits. Do not widen scope because a tool or skill exists.',
    'This is local-only inference. Never suggest switching to a paid or remote AI provider.'
  ].join('\n');
}

function agentSystemPrompt(toolList = []) {
  const tools = toolList.map(item => `${item.name} [${item.mode}] ${item.description || ''}`).join('\n');
  return [
    'You are Lovable Decrypter Local Agent. Return ONLY one valid JSON object; no markdown or prose around it.',
    'Choose exactly one action per turn:',
    '{"type":"tool","tool":"repo.read_file","input":{},"reason":"..."}',
    '{"type":"final","summary":"...","verification":"..."}',
    '{"type":"stop","reason":"..."}',
    'Rules:',
    '- Read tools may be used automatically. Write tools will always stop for explicit human approval.',
    '- Prefer repo.patch_apply for updates. Use exact small search/replace edits and include expectedBlobSha from the latest repo.read_file result.',
    '- Never invent file contents or blob SHAs. Read before patching when exact state is uncertain.',
    '- Never access or modify sensitive paths, credentials, .env, generated secrets, or files outside the approved plan.',
    '- Keep writes minimal. Do not perform unrelated refactors or cleanup.',
    '- After a write, inspect the resulting Git diff and use diagnostics.run when useful/available before finalizing.',
    '- If a capability is unavailable, adapt using available read-only evidence; do not fabricate diagnostics.',
    '- Never request or use a remote/paid model fallback.',
    'AVAILABLE TOOLS:',
    tools
  ].join('\n');
}

function validatePlan(value = {}) {
  const normalized = normalizeApprovalPlan(value || {});
  if (!normalized.summary || !normalized.plan.length) throw Object.assign(new Error('LOCAL_AGENT_PLAN_INVALID'), { code: 'LOCAL_AGENT_PLAN_INVALID' });
  return normalized;
}

function validateAction(value = {}, toolMap = new Map()) {
  const type = text(value?.type, 40).toLowerCase();
  if (type === 'final') return { type, summary: text(value?.summary, 30000), verification: text(value?.verification, 12000) };
  if (type === 'stop') return { type, reason: text(value?.reason, 12000) };
  if (type !== 'tool') throw Object.assign(new Error('LOCAL_AGENT_ACTION_INVALID'), { code: 'LOCAL_AGENT_ACTION_INVALID' });
  const tool = text(value?.tool, 160);
  const definition = toolMap.get(tool);
  if (!definition || (!ALLOWED_READ_TOOLS.has(tool) && !ALLOWED_WRITE_TOOLS.has(tool))) {
    throw Object.assign(new Error(`LOCAL_AGENT_TOOL_NOT_ALLOWED:${tool}`), { code: 'LOCAL_AGENT_TOOL_NOT_ALLOWED' });
  }
  return { type: 'tool', tool, mode: definition.mode, input: value?.input && typeof value.input === 'object' ? value.input : {}, reason: text(value?.reason, 8000) };
}

async function ensureStep(taskId, descriptor) {
  await defineContinuitySteps(taskId, [descriptor]);
}

async function runInferenceStep({ taskId, key, label, payload, generation = 0 }) {
  const idempotencyKey = `${key}:g${generation}`;
  await ensureStep(taskId, { idempotencyKey, label, kind: 'inference', mode: 'inference', resumable: true, retrySafe: true, maxAttempts: 4 });
  const inputDigest = await continuityDigest(JSON.stringify({ command: payload.command, role: payload.role, iteration: payload.iteration, contextFileCount: payload.contextFileCount }));
  const lease = await claimContinuityStep({ taskId, idempotencyKey, workerId: 'local-agent-orchestrator', leaseMs: 240000, inputDigest });
  if (lease.replay) return { replay: true, idempotencyKey, lease: null, result: null };
  if (!lease.claimed) throw Object.assign(new Error('LOCAL_AGENT_INFERENCE_BUSY'), { code: 'LOCAL_AGENT_INFERENCE_BUSY' });
  try {
    const result = await executeLocalChat(payload);
    const outputDigest = await continuityDigest(result.content);
    await completeContinuityStep({ taskId, idempotencyKey, leaseToken: lease.leaseToken, outputDigest });
    return { replay: false, idempotencyKey, lease, result };
  } catch (error) {
    await failContinuityStep({ taskId, idempotencyKey, leaseToken: lease.leaseToken, errorCode: error?.code || 'LOCAL_INFERENCE_FAILED', outcomeUnknown: false }).catch(() => null);
    throw error;
  }
}

async function runContextStep({ taskId, state, run }) {
  const key = `context:g${run.resumeGeneration || 0}`;
  await ensureStep(taskId, { idempotencyKey: key, label: 'Context Engine v2', kind: 'context', mode: 'read', resumable: true, retrySafe: true });
  const inputDigest = await continuityDigest(`${run.commandDigest}:${run.projectId}:${run.resumeGeneration || 0}`);
  const lease = await claimContinuityStep({ taskId, idempotencyKey: key, workerId: 'local-agent-orchestrator', leaseMs: 180000, inputDigest });
  if (lease.replay && state.contextPack) return state.contextPack;
  if (!lease.claimed && !lease.replay) throw Object.assign(new Error('LOCAL_AGENT_CONTEXT_BUSY'), { code: 'LOCAL_AGENT_CONTEXT_BUSY' });
  try {
    const pack = await buildProjectContextV2({
      task: state.command,
      projectId: run.projectId,
      explicitPaths: state.explicitPaths || [],
      skills: state.skills || [],
      includeKnowledge: state.includeKnowledge !== false
    });
    const digest = text(pack?.digest, 128) || await continuityDigest(JSON.stringify({
      schema: pack?.schema,
      selected: (Array.isArray(pack?.files) ? pack.files : []).map(file => [file.path, file.sha || file.blobSha || '', file.truncated === true]),
      bytes: pack?.budget?.usedBytes || pack?.bytes || 0
    }));
    if (lease?.leaseToken) await completeContinuityStep({ taskId, idempotencyKey: key, leaseToken: lease.leaseToken, outputDigest: digest });
    run.contextDigest = digest;
    await upsertRun(run);
    state.contextPack = pack;
    await saveSession(taskId, state);
    return pack;
  } catch (error) {
    if (lease?.leaseToken) await failContinuityStep({ taskId, idempotencyKey: key, leaseToken: lease.leaseToken, errorCode: error?.code || 'CONTEXT_ENGINE_FAILED', outcomeUnknown: false }).catch(() => null);
    throw error;
  }
}

async function buildPlan({ taskId, state, run }) {
  if (state.plan) return state.plan;
  const pack = state.contextPack || await runContextStep({ taskId, state, run });
  const contextFileCount = Array.isArray(pack?.files) ? pack.files.length : 0;
  const inference = await runInferenceStep({
    taskId,
    key: 'plan',
    label: 'Local plan',
    generation: run.resumeGeneration || 0,
    payload: {
      command: state.command,
      role: 'planner',
      iteration: 0,
      contextFileCount,
      failures: 0,
      messages: [
        { role: 'system', content: planSystemPrompt() },
        { role: 'user', content: `USER REQUEST\n${state.command}\n\nCONTEXT PACK\n${compactForPrompt(pack, 170000)}` }
      ]
    }
  });
  if (inference.replay && !state.plan) {
    run.resumeGeneration = (run.resumeGeneration || 0) + 1;
    await upsertRun(run);
    return buildPlan({ taskId, state, run });
  }
  const plan = validatePlan(parseJsonObject(inference.result.content, 'LOCAL_AGENT_PLAN_JSON_INVALID'));
  state.plan = plan;
  run.planDigest = await continuityDigest(JSON.stringify(plan));
  const route = inference.result.route || {};
  run.routeHistory = [...(run.routeHistory || []), { tier: route.tier, model: route.model, degraded: route.degraded === true, at: nowIso() }].slice(-16);
  run.lastAction = 'plan-ready';
  await Promise.all([saveSession(taskId, state), upsertRun(run)]);
  return plan;
}

async function createLocalApproval({ run, state, pending, humanIntentOverrides = [] }) {
  const proposal = normalizeLocalAgentWriteProposal(pending.tool, pending.input);
  const digest = await localAgentProposalDigest(proposal);
  if (digest !== pending.digest) throw Object.assign(new Error('LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'), { code: 'LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH' });
  const settings = await getSettings();
  const github = activeGithub(settings, run.projectId);
  const adapter = new GitAdapter(github);
  const head = await currentHead(adapter, github.branch || 'main');
  if (!head) throw Object.assign(new Error('LOCAL_AGENT_HEAD_UNAVAILABLE'), { code: 'LOCAL_AGENT_HEAD_UNAVAILABLE' });
  const recentUserEdits = await loadRecentUserEdits(run.projectId, 80);
  const files = localAgentProposalFiles(proposal);
  const paths = localAgentProposalPaths(proposal);
  const scope = assertScopeIntelligence({
    command: state.command,
    approvedPlan: state.plan,
    files,
    recentUserEdits,
    humanIntentOverrides,
    decision: 'approve'
  });
  const scopeHash = await continuityDigest(JSON.stringify(scopeIntelligenceFingerprint(scope)));
  const id = crypto.randomUUID();
  const canonical = {
    schema: 'ld-approval-transaction/1',
    id,
    planId: id,
    projectId: run.projectId,
    source: 'local-agent-v68',
    decision: 'approve',
    humanDecision: true,
    status: 'validated',
    baseHeadSha: head,
    stateRevision: `git:${head}`,
    authorizedFiles: paths,
    humanIntentOverrides: [...new Set((Array.isArray(humanIntentOverrides) ? humanIntentOverrides : []).filter(path => paths.includes(path)))],
    scopeIntelligenceHash: scopeHash,
    localAgentProposalDigest: digest,
    hash: await continuityDigest(JSON.stringify({ projectId: run.projectId, source: 'local-agent-v68', head, paths, digest, scopeHash })),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    bundleId: `local-agent:${run.taskId}:${digest.slice(0, 12)}`
  };
  await chrome.storage.session.set({ [txKey(id)]: canonical });
  return { transaction: canonical, scope, adapter, github, head };
}

async function executeApprovedWrite({ run, state, humanDecision, proposalDigest, humanIntentOverrides = [] }) {
  const pending = state.pendingProposal;
  if (!pending) throw Object.assign(new Error('LOCAL_AGENT_PENDING_WRITE_REQUIRED'), { code: 'LOCAL_AGENT_PENDING_WRITE_REQUIRED' });
  if (humanDecision !== true) throw Object.assign(new Error('LOCAL_AGENT_HUMAN_APPROVAL_REQUIRED'), { code: 'LOCAL_AGENT_HUMAN_APPROVAL_REQUIRED' });
  if (!proposalDigest || proposalDigest !== pending.digest) throw Object.assign(new Error('LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'), { code: 'LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH' });

  const approvalKey = `approval:${run.iteration}:g${run.resumeGeneration || 0}`;
  await ensureStep(run.taskId, { idempotencyKey: approvalKey, label: 'Human approval', kind: 'approval', mode: 'write', resumable: false, retrySafe: false, paths: pending.paths });
  const approvalLease = await claimContinuityStep({ taskId: run.taskId, idempotencyKey: approvalKey, workerId: 'human-decision', leaseMs: 60000, inputDigest: pending.digest });
  if (!approvalLease.claimed && !approvalLease.replay) throw Object.assign(new Error('LOCAL_AGENT_APPROVAL_BUSY'), { code: 'LOCAL_AGENT_APPROVAL_BUSY' });
  if (approvalLease.claimed) await completeContinuityStep({ taskId: run.taskId, idempotencyKey: approvalKey, leaseToken: approvalLease.leaseToken, outputDigest: pending.digest });

  const approved = await createLocalApproval({ run, state, pending, humanIntentOverrides });
  const toolKey = `write:${run.iteration}:${pending.digest.slice(0, 16)}`;
  await ensureStep(run.taskId, { idempotencyKey: toolKey, label: pending.tool, kind: 'tool', mode: 'write', resumable: true, retrySafe: false, paths: pending.paths });
  try {
    const result = await invokeToolRuntimeAction('invoke', {
      projectId: run.projectId,
      taskId: run.taskId,
      tool: pending.tool,
      input: pending.input,
      origin: 'ai',
      transactionId: approved.transaction.id,
      authorization: { transactionId: approved.transaction.id },
      continuity: { taskId: run.taskId, idempotencyKey: toolKey, workerId: 'local-agent-orchestrator', inputDigest: pending.digest, leaseMs: 180000 }
    });
    state.trace = [...(state.trace || []), compactTraceItem(result)].slice(-16);
    state.pendingProposal = null;
    run.pendingWriteDigest = '';
    run.pendingTool = '';
    run.pendingPaths = [];
    run.lastAction = 'write-applied';
    run.iteration += 1;

    const commitSha = text(result?.data?.commitSha, 160);
    if (commitSha && approved.head) {
      const diffKey = `verify-diff:${run.iteration}:${commitSha.slice(0, 12)}`;
      await ensureStep(run.taskId, { idempotencyKey: diffKey, label: 'Verify Git diff', kind: 'verification', mode: 'read', resumable: true, retrySafe: true, paths: pending.paths });
      try {
        const diff = await invokeToolRuntimeAction('invoke', {
          projectId: run.projectId,
          taskId: run.taskId,
          tool: 'repo.git_diff',
          input: { base: approved.head, head: commitSha, includePatch: true },
          origin: 'ai',
          continuity: { taskId: run.taskId, idempotencyKey: diffKey, workerId: 'local-agent-orchestrator' }
        });
        state.trace = [...state.trace, compactTraceItem(diff)].slice(-16);
      } catch (error) {
        state.trace = [...state.trace, { tool: 'repo.git_diff', code: error?.code || 'VERIFY_DIFF_FAILED' }].slice(-16);
      }
    }

    const diagnosticsKey = `diagnostics:${run.iteration}`;
    await ensureStep(run.taskId, { idempotencyKey: diagnosticsKey, label: 'Diagnostics', kind: 'diagnostics', mode: 'read', resumable: true, retrySafe: true, paths: pending.paths });
    try {
      const diagnostics = await invokeToolRuntimeAction('invoke', {
        projectId: run.projectId,
        taskId: run.taskId,
        tool: 'diagnostics.run',
        input: { paths: pending.paths },
        origin: 'ai',
        continuity: { taskId: run.taskId, idempotencyKey: diagnosticsKey, workerId: 'local-agent-orchestrator' }
      });
      state.trace = [...state.trace, compactTraceItem(diagnostics)].slice(-16);
    } catch (error) {
      state.trace = [...state.trace, { tool: 'diagnostics.run', code: error?.code || 'DIAGNOSTICS_UNAVAILABLE', unavailable: error?.code === 'TOOL_CAPABILITY_UNAVAILABLE' }].slice(-16);
    }

    await Promise.all([saveSession(run.taskId, state), upsertRun(run)]);
    return result;
  } finally {
    await chrome.storage.session.remove(txKey(approved.transaction.id)).catch(() => null);
  }
}

async function agentLoop(run, state) {
  const settings = await getSettings();
  const local = settings?.localAI || {};
  const maxIterations = Math.max(1, Math.min(12, Number(run.maxIterations || local.maxIterations || DEFAULT_MAX_ITERATIONS)));
  const pack = state.contextPack || await runContextStep({ taskId: run.taskId, state, run });
  const plan = await buildPlan({ taskId: run.taskId, state, run });
  const toolListResult = await invokeToolRuntimeAction('list', { projectId: run.projectId, taskId: run.taskId });
  const toolList = (Array.isArray(toolListResult?.tools) ? toolListResult.tools : []).filter(tool => ALLOWED_READ_TOOLS.has(tool.name) || ALLOWED_WRITE_TOOLS.has(tool.name));
  const toolMap = new Map(toolList.map(tool => [tool.name, tool]));

  while (run.iteration < maxIterations) {
    if (state.pendingProposal) {
      run.status = 'waiting_approval';
      await upsertRun(run);
      return {
        ok: true,
        status: 'waiting_approval',
        run: publicRun(run),
        plan,
        proposal: { ...localAgentProposalPublic(state.pendingProposal), digest: state.pendingProposal.digest, reason: state.pendingProposal.reason, normalized: state.pendingProposal.normalized },
        humanApprovalRequired: true
      };
    }

    const contextFileCount = Array.isArray(pack?.files) ? pack.files.length : 0;
    const promptState = {
      request: state.command,
      approvedPlanCandidate: plan,
      iteration: run.iteration,
      context: pack,
      recentToolEvidence: (state.trace || []).slice(-8)
    };
    const inference = await runInferenceStep({
      taskId: run.taskId,
      key: `agent-inference:${run.iteration}`,
      label: `Local agent inference ${run.iteration + 1}`,
      generation: run.resumeGeneration || 0,
      payload: {
        command: state.command,
        role: run.iteration === 0 ? 'coding' : 'repair',
        iteration: run.iteration,
        failures: Number(run.failureCount || 0),
        diagnosticsFailures: (state.trace || []).filter(item => item?.tool === 'diagnostics.run' && item?.code && item.code !== 'OK').length,
        contextFileCount,
        messages: [
          { role: 'system', content: agentSystemPrompt(toolList) },
          { role: 'user', content: compactForPrompt(promptState, 220000) }
        ]
      }
    });

    if (inference.replay && !state.lastInferenceAction) {
      run.resumeGeneration = (run.resumeGeneration || 0) + 1;
      await upsertRun(run);
      continue;
    }
    const rawAction = parseJsonObject(inference.result.content, 'LOCAL_AGENT_ACTION_JSON_INVALID');
    const action = validateAction(rawAction, toolMap);
    state.lastInferenceAction = { type: action.type, tool: action.tool || '', at: nowIso() };
    const route = inference.result.route || {};
    run.routeHistory = [...(run.routeHistory || []), { tier: route.tier, model: route.model, degraded: route.degraded === true, at: nowIso() }].slice(-16);

    if (action.type === 'final') {
      run.status = 'completed';
      run.lastAction = 'final';
      run.completedAt = nowIso();
      await upsertRun(run);
      await clearSession(run.taskId);
      return { ok: true, status: 'completed', run: publicRun(run), plan, result: { summary: action.summary, verification: action.verification }, paidFallbackUsed: false, remoteFallbackUsed: false };
    }
    if (action.type === 'stop') {
      run.status = 'stopped';
      run.lastAction = 'model-stop';
      await Promise.all([upsertRun(run), saveSession(run.taskId, state)]);
      return { ok: true, status: 'stopped', run: publicRun(run), plan, reason: action.reason };
    }

    if (action.mode === 'write') {
      const normalized = normalizeLocalAgentWriteProposal(action.tool, action.input);
      const digest = await localAgentProposalDigest(normalized);
      const paths = localAgentProposalPaths(normalized);
      state.pendingProposal = { tool: action.tool, input: normalized.input, normalized, digest, paths, reason: action.reason };
      run.status = 'waiting_approval';
      run.pendingWriteDigest = digest;
      run.pendingTool = action.tool;
      run.pendingPaths = paths;
      run.lastAction = 'write-proposed';
      await Promise.all([saveSession(run.taskId, state), upsertRun(run)]);
      return {
        ok: true,
        status: 'waiting_approval',
        run: publicRun(run),
        plan,
        proposal: { ...localAgentProposalPublic(normalized), digest, reason: action.reason, normalized },
        humanApprovalRequired: true
      };
    }

    const key = `tool:${run.iteration}:${action.tool}`;
    await ensureStep(run.taskId, { idempotencyKey: key, label: action.tool, kind: action.tool === 'diagnostics.run' ? 'diagnostics' : 'tool', mode: 'read', resumable: true, retrySafe: true });
    try {
      const result = await invokeToolRuntimeAction('invoke', {
        projectId: run.projectId,
        taskId: run.taskId,
        tool: action.tool,
        input: action.input,
        origin: 'ai',
        continuity: { taskId: run.taskId, idempotencyKey: key, workerId: 'local-agent-orchestrator' }
      });
      state.trace = [...(state.trace || []), compactTraceItem(result)].slice(-16);
      run.lastAction = `tool:${action.tool}`;
    } catch (error) {
      state.trace = [...(state.trace || []), { tool: action.tool, code: error?.code || 'TOOL_FAILED', message: text(error?.message, 1200) }].slice(-16);
      run.failureCount = Number(run.failureCount || 0) + 1;
      run.lastErrorCode = error?.code || 'TOOL_FAILED';
      if (!['TOOL_CAPABILITY_UNAVAILABLE','TOOL_READ_LIMIT_EXCEEDED','GREP_QUERY_INVALID'].includes(error?.code || '')) {
        await Promise.all([saveSession(run.taskId, state), upsertRun(run)]);
        throw error;
      }
    }
    run.iteration += 1;
    state.lastInferenceAction = null;
    await Promise.all([saveSession(run.taskId, state), upsertRun(run)]);
  }

  run.status = 'iteration_limit';
  run.lastAction = 'iteration-limit';
  run.lastErrorCode = 'LOCAL_AGENT_ITERATION_LIMIT';
  await Promise.all([saveSession(run.taskId, state), upsertRun(run)]);
  return { ok: false, status: 'iteration_limit', code: 'LOCAL_AGENT_ITERATION_LIMIT', run: publicRun(run), plan };
}

async function start(payload = {}) {
  const command = text(payload?.command, 60000);
  const projectId = text(payload?.projectId, 160);
  if (!command) throw Object.assign(new Error('LOCAL_AGENT_COMMAND_REQUIRED'), { code: 'LOCAL_AGENT_COMMAND_REQUIRED' });
  if (!projectId) throw Object.assign(new Error('LOCAL_AGENT_PROJECT_REQUIRED'), { code: 'LOCAL_AGENT_PROJECT_REQUIRED' });
  const settings = await getSettings();
  if (settings?.localAI?.enabled === false) throw Object.assign(new Error('LOCAL_AGENT_DISABLED'), { code: 'LOCAL_AGENT_DISABLED' });
  const github = activeGithub(settings, projectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('LOCAL_AGENT_GITHUB_MAPPING_REQUIRED'), { code: 'LOCAL_AGENT_GITHUB_MAPPING_REQUIRED' });
  const health = await localRuntimeHealth({ includeMetrics: true });
  if (!health.ok) throw Object.assign(new Error(health.code || 'LOCAL_RUNTIME_UNAVAILABLE'), { code: health.code || 'LOCAL_RUNTIME_UNAVAILABLE', details: health });
  if (!health.tokenConfigured) throw Object.assign(new Error('LOCAL_RUNTIME_TOKEN_REQUIRED'), { code: 'LOCAL_RUNTIME_TOKEN_REQUIRED' });

  const commandDigest = await continuityDigest(command);
  const task = await createContinuityTask({
    projectId,
    repo: `${github.owner}/${github.repo}`,
    branch: github.branch || 'main',
    commandDigest,
    metadata: { mode: payload?.mode || 'build', source: 'local-agent-v68' }
  });
  const run = await upsertRun({
    taskId: task.id,
    projectId,
    repo: `${github.owner}/${github.repo}`,
    branch: github.branch || 'main',
    status: 'running',
    mode: payload?.mode === 'plan' ? 'plan' : 'build',
    iteration: 0,
    maxIterations: Math.max(1, Math.min(12, Number(payload?.maxIterations || settings?.localAI?.maxIterations || DEFAULT_MAX_ITERATIONS))),
    commandDigest,
    contextDigest: '',
    planDigest: '',
    resumeGeneration: 0,
    pendingWriteDigest: '',
    pendingTool: '',
    pendingPaths: [],
    lastAction: 'created',
    lastErrorCode: '',
    failureCount: 0,
    routeHistory: [],
    createdAt: nowIso(),
    completedAt: ''
  });
  const state = {
    command,
    explicitPaths: Array.isArray(payload?.explicitPaths) ? payload.explicitPaths.slice(0, 30) : [],
    skills: Array.isArray(payload?.skills) ? payload.skills.slice(0, 12) : [],
    includeKnowledge: payload?.includeKnowledge !== false,
    contextPack: null,
    plan: null,
    trace: [],
    pendingProposal: null,
    lastInferenceAction: null
  };
  await saveSession(task.id, state);
  return agentLoop(run, state);
}

async function resume(payload = {}) {
  const taskId = text(payload?.taskId, 160);
  if (!taskId) throw Object.assign(new Error('LOCAL_AGENT_TASK_REQUIRED'), { code: 'LOCAL_AGENT_TASK_REQUIRED' });
  let run = await getRun(taskId);
  if (!run) throw Object.assign(new Error('LOCAL_AGENT_RUN_NOT_FOUND'), { code: 'LOCAL_AGENT_RUN_NOT_FOUND' });
  let state = await loadSession(taskId);
  if (!state) {
    const command = text(payload?.command, 60000);
    if (!command || await continuityDigest(command) !== run.commandDigest) {
      throw Object.assign(new Error('LOCAL_AGENT_REHYDRATION_REQUIRED'), { code: 'LOCAL_AGENT_REHYDRATION_REQUIRED' });
    }
    state = {
      command,
      explicitPaths: Array.isArray(payload?.explicitPaths) ? payload.explicitPaths.slice(0, 30) : [],
      skills: Array.isArray(payload?.skills) ? payload.skills.slice(0, 12) : [],
      includeKnowledge: payload?.includeKnowledge !== false,
      contextPack: null,
      plan: payload?.plan ? validatePlan(payload.plan) : null,
      trace: [],
      pendingProposal: payload?.pendingProposal || null,
      lastInferenceAction: null
    };
    run.resumeGeneration = (run.resumeGeneration || 0) + 1;
  }
  await resumeContinuityTask(taskId).catch(() => null);
  run.status = 'running';
  run.lastErrorCode = '';
  await Promise.all([saveSession(taskId, state), upsertRun(run)]);
  if (state.pendingProposal && payload?.humanDecision === true) {
    await executeApprovedWrite({ run, state, humanDecision: true, proposalDigest: payload?.proposalDigest, humanIntentOverrides: payload?.humanIntentOverrides || [] });
  }
  run = await getRun(taskId);
  state = await loadSession(taskId) || state;
  return agentLoop(run, state);
}

async function approveWrite(payload = {}) {
  const taskId = text(payload?.taskId, 160);
  const run = await getRun(taskId);
  const state = await loadSession(taskId);
  if (!run || !state) throw Object.assign(new Error('LOCAL_AGENT_PENDING_SESSION_NOT_FOUND'), { code: 'LOCAL_AGENT_PENDING_SESSION_NOT_FOUND' });
  await executeApprovedWrite({
    run,
    state,
    humanDecision: payload?.humanDecision === true,
    proposalDigest: text(payload?.proposalDigest, 128),
    humanIntentOverrides: Array.isArray(payload?.humanIntentOverrides) ? payload.humanIntentOverrides : []
  });
  const nextRun = await getRun(taskId);
  const nextState = await loadSession(taskId);
  return agentLoop(nextRun, nextState);
}

async function get(payload = {}) {
  const taskId = text(payload?.taskId, 160);
  const run = await getRun(taskId);
  if (!run) return { run: null, continuity: null, ephemeralSessionAvailable: false };
  return { run: publicRun(run), continuity: await getContinuityTask(taskId).catch(() => null), ephemeralSessionAvailable: Boolean(await loadSession(taskId)) };
}

async function list(payload = {}) {
  const projectId = text(payload?.projectId, 160);
  const rows = (await loadRuns()).filter(row => !projectId || row?.projectId === projectId).slice(0, Math.max(1, Math.min(80, Number(payload?.limit || 30))));
  const continuity = await listContinuityTasks({ projectId, limit: 80 }).catch(() => []);
  const continuityMap = new Map((Array.isArray(continuity) ? continuity : []).map(item => [item.id, item]));
  return { runs: rows.map(row => ({ ...publicRun(row), continuity: continuityMap.get(row.taskId) || null })) };
}

async function cancel(payload = {}) {
  const taskId = text(payload?.taskId, 160);
  const run = await getRun(taskId);
  if (!run) throw Object.assign(new Error('LOCAL_AGENT_RUN_NOT_FOUND'), { code: 'LOCAL_AGENT_RUN_NOT_FOUND' });
  await cancelContinuityTask(taskId).catch(() => null);
  run.status = 'cancelled';
  run.lastAction = 'cancelled';
  await Promise.all([upsertRun(run), clearSession(taskId)]);
  return { run: publicRun(run) };
}

async function handle(action, payload = {}) {
  const op = text(action, 80).toLowerCase();
  if (op === 'status') {
    const health = await localRuntimeHealth({ includeMetrics: true }).catch(error => ({ ok: false, code: error?.code || 'LOCAL_RUNTIME_UNAVAILABLE' }));
    return {
      schema: 'ld-local-agent/1',
      build: 68,
      localOnly: true,
      loop: 'plan->context->local-model->tools->approval->write->diff->diagnostics->repair',
      continuity: true,
      modelRouter: 'large->medium->small',
      readToolsAutomatic: true,
      writesRequireHumanApproval: true,
      writeApprovalBoundToProposalDigest: true,
      scopeIntelligenceBeforeWrite: true,
      humanIntentBeforeWrite: true,
      noPaidFallback: true,
      noRemoteFallback: true,
      rawPromptDurablePersistence: false,
      rawModelOutputDurablePersistence: false,
      ephemeralSessionRehydration: true,
      runtime: health
    };
  }
  if (op === 'start') return start(payload || {});
  if (op === 'resume') return resume(payload || {});
  if (op === 'approve_write') return approveWrite(payload || {});
  if (op === 'get') return get(payload || {});
  if (op === 'list') return list(payload || {});
  if (op === 'cancel') return cancel(payload || {});
  throw Object.assign(new Error('LOCAL_AGENT_ACTION_INVALID'), { code: 'LOCAL_AGENT_ACTION_INVALID' });
}

export function installLocalAgentOrchestrator() {
  if (globalThis.__LD68_LOCAL_AGENT_ORCHESTRATOR__) return;
  globalThis.__LD68_LOCAL_AGENT_ORCHESTRATOR__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const listener = async message => {
      const id = text(message?.id, 160);
      try { port.postMessage({ id, ok: true, data: await handle(message?.action || 'status', message?.payload || {}) }); }
      catch (error) { try { port.postMessage({ id, ok: false, error: error?.message || String(error), code: error?.code || 'LOCAL_AGENT_FAILED', details: error?.details || null }); } catch (_) {} }
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterLocalAgent = Object.freeze({
    build: 68,
    schema: 'ld-local-agent/1',
    port: PORT_NAME,
    localOnly: true,
    continuityBacked: true,
    modelRouter: 'large->medium->small',
    readToolsAutomatic: true,
    writesRequireHumanApproval: true,
    proposalDigestBinding: true,
    scopeIntelligenceRequired: true,
    humanIntentRequired: true,
    paidFallbackAllowed: false,
    remoteFallbackAllowed: false
  });
}
