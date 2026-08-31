import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { ToolRuntime, toolJournal } from '../core/tool-runtime.js';
import { localAgentProposalDigest } from '../core/local-agent-approval.js';
import {
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  checkpointContinuityStep,
  continuityDigest
} from '../core/continuity-engine.js';

const PORT_NAME = 'ld2-tool-runtime';
const TX_PREFIX = 'ld2_approval_tx_v1_';

function text(value) { return String(value ?? '').trim(); }
function txKey(id) { return `${TX_PREFIX}${text(id).replace(/[^a-z0-9-]/gi, '').slice(0, 100)}`; }

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId] ? settings.projectMappings[projectId] : {};
  return { ...(settings?.github || {}), ...(mapping || {}) };
}

async function resolveWriteAuthorization(payload = {}, projectId = '') {
  const transactionId = text(payload?.authorization?.transactionId || payload?.transactionId);
  if (!transactionId) return { writeApproved: false, allowedPaths: [], transactionId: '', scopeIntelligenceValidated: false };
  const key = txKey(transactionId);
  const stored = await chrome.storage.session.get(key);
  const tx = stored[key];
  if (!tx || tx.id !== transactionId) return { writeApproved: false, allowedPaths: [], transactionId, scopeIntelligenceValidated: false };
  if (Date.parse(tx.expiresAt || '') <= Date.now()) return { writeApproved: false, allowedPaths: [], transactionId, scopeIntelligenceValidated: false };
  if (tx.status !== 'validated') return { writeApproved: false, allowedPaths: [], transactionId, scopeIntelligenceValidated: false };
  if (projectId && tx.projectId && String(tx.projectId) !== String(projectId)) return { writeApproved: false, allowedPaths: [], transactionId, scopeIntelligenceValidated: false };
  const scopeIntelligenceHash = text(tx.scopeIntelligenceHash);
  if (!scopeIntelligenceHash) return { writeApproved: false, allowedPaths: [], transactionId, scopeIntelligenceValidated: false };
  return {
    writeApproved: true,
    allowedPaths: Array.isArray(tx.authorizedFiles) ? tx.authorizedFiles : [],
    transactionId,
    approvalHash: text(tx.hash),
    baseHeadSha: text(tx.baseHeadSha),
    scopeIntelligenceHash,
    scopeIntelligenceValidated: true,
    humanIntentOverrides: Array.isArray(tx.humanIntentOverrides) ? tx.humanIntentOverrides : [],
    localAgentProposalDigest: text(tx.localAgentProposalDigest)
  };
}

function installCompareCapability(adapter) {
  if (typeof adapter.compareCommits === 'function') return adapter;
  adapter.compareCommits = function compareCommits(base, head) {
    const owner = encodeURIComponent(this.owner);
    const repo = encodeURIComponent(this.repo);
    const range = `${encodeURIComponent(String(base || ''))}...${encodeURIComponent(String(head || ''))}`;
    return this.request(`/repos/${owner}/${repo}/compare/${range}`);
  };
  return adapter;
}

async function buildRuntime(payload = {}) {
  const projectId = text(payload?.projectId).slice(0, 120);
  const settings = await getSettings();
  const github = activeGithub(settings, projectId);
  if (!github?.owner || !github?.repo) throw Object.assign(new Error('TOOL_RUNTIME_GITHUB_MAPPING_REQUIRED'), { code: 'TOOL_RUNTIME_GITHUB_MAPPING_REQUIRED' });
  const adapter = installCompareCapability(new GitAdapter(github));
  const runtime = new ToolRuntime({
    adapter,
    context: {
      projectId,
      owner: github.owner,
      repo: github.repo,
      branch: github.branch || 'main',
      taskId: text(payload?.taskId).slice(0, 160),
      parentOperationId: text(payload?.parentOperationId).slice(0, 160)
    }
  });
  return { runtime, github, projectId };
}

function continuityRequest(payload = {}) {
  const value = payload?.continuity;
  if (!value || typeof value !== 'object') return null;
  const taskId = text(value.taskId).slice(0, 160);
  const idempotencyKey = text(value.idempotencyKey).slice(0, 240);
  if (!taskId || !idempotencyKey) return null;
  return {
    taskId,
    idempotencyKey,
    workerId: text(value.workerId || 'tool-runtime').slice(0, 160),
    inputDigest: text(value.inputDigest).slice(0, 128),
    leaseMs: Number(value.leaseMs || 120000) || 120000
  };
}

function continuityReplay(tool, ref = {}) {
  return {
    ok: true,
    schema: 'ld-tool-result/1',
    tool: tool.name,
    mode: tool.mode,
    operationId: ref.operationId || '',
    continuityReplay: true,
    data: {
      code: 'IDEMPOTENT_REPLAY',
      commitSha: ref.commitSha || '',
      checkpointId: ref.checkpointId || '',
      outputDigest: ref.outputDigest || '',
      writeRepeated: false
    }
  };
}

async function checkpointWriteHead(runtime, github, continuity) {
  if (!continuity) return null;
  const ref = await runtime.adapter.getRef(github.branch || 'main');
  const headSha = text(ref?.object?.sha || ref?.sha).toLowerCase();
  if (!headSha) throw Object.assign(new Error('CONTINUITY_PREWRITE_HEAD_REQUIRED'), { code: 'CONTINUITY_PREWRITE_HEAD_REQUIRED' });
  await checkpointContinuityStep({
    taskId: continuity.taskId,
    idempotencyKey: continuity.idempotencyKey,
    checkpoint: {
      type: 'git-head-before-write',
      reference: headSha,
      digest: await continuityDigest(`${github.owner}/${github.repo}:${github.branch || 'main'}:${headSha}`),
      verified: true
    }
  });
  return headSha;
}

async function assertLocalAgentProposalBinding(toolName, input, authorization) {
  const expected = text(authorization?.localAgentProposalDigest);
  if (!expected) return true;
  const actual = await localAgentProposalDigest({ tool: toolName, input: input || {} });
  if (actual !== expected) {
    throw Object.assign(new Error('LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'), {
      code: 'LOCAL_AGENT_PROPOSAL_DIGEST_MISMATCH'
    });
  }
  return true;
}

async function handle(action, payload = {}) {
  const op = text(action || 'list').toLowerCase();
  if (op === 'journal') return { schema: 'ld-operation-journal/1', entries: await toolJournal(payload?.filters || {}) };

  const { runtime, github, projectId } = await buildRuntime(payload);
  if (op === 'list') {
    return {
      schema: 'ld-tool-runtime/1',
      build: 68,
      repo: `${github.owner}/${github.repo}`,
      branch: github.branch || 'main',
      tools: runtime.list(),
      scopeLayer: { writePolicy: 'validated-approval+scope-intelligence-v2' },
      writePolicy: 'validated-approval+scope-intelligence-v2+continuity-idempotency',
      continuityAware: true,
      localOrchestratorAware: true,
      localAgentProposalDigestBinding: true,
      preWriteHeadCheckpoint: true,
      ambiguousWriteRetry: 'verification-required',
      fakeDiagnostics: false,
      fakeLsp: false
    };
  }
  if (op !== 'invoke') throw Object.assign(new Error('TOOL_RUNTIME_ACTION_INVALID'), { code: 'TOOL_RUNTIME_ACTION_INVALID' });

  const toolName = text(payload?.tool);
  const tool = runtime.list().find(item => item.name === toolName);
  if (!tool) throw Object.assign(new Error(`TOOL_NOT_FOUND: ${toolName}`), { code: 'TOOL_NOT_FOUND' });
  const authorization = tool.mode === 'write'
    ? await resolveWriteAuthorization(payload, projectId)
    : { writeApproved: false, allowedPaths: [], scopeIntelligenceValidated: false };
  if (tool.mode === 'write') await assertLocalAgentProposalBinding(toolName, payload?.input || {}, authorization);

  const continuity = continuityRequest(payload);
  let lease = null;
  if (continuity) {
    lease = await claimContinuityStep(continuity);
    if (lease.replay) return continuityReplay(tool, lease.resultRef || {});
    if (!lease.claimed) throw Object.assign(new Error('CONTINUITY_STEP_BUSY'), { code: 'CONTINUITY_STEP_BUSY' });
    if (tool.mode === 'write') await checkpointWriteHead(runtime, github, continuity);
  }

  try {
    const result = await runtime.invoke(toolName, payload?.input || {}, {
      origin: payload?.origin || 'tool',
      authorization,
      context: {
        taskId: text(payload?.taskId || continuity?.taskId).slice(0, 160),
        idempotencyKey: text(continuity?.idempotencyKey).slice(0, 240),
        parentOperationId: text(payload?.parentOperationId).slice(0, 160)
      }
    });
    if (continuity && lease?.leaseToken) {
      const digest = await continuityDigest(JSON.stringify({
        tool: result.tool,
        mode: result.mode,
        operationId: result.operationId || '',
        code: result?.data?.code || '',
        commitSha: result?.data?.commitSha || '',
        fileCount: Number(result?.data?.fileCount || 0) || 0
      }));
      await completeContinuityStep({
        taskId: continuity.taskId,
        idempotencyKey: continuity.idempotencyKey,
        leaseToken: lease.leaseToken,
        outputDigest: digest,
        operationId: result.operationId || '',
        commitSha: result?.data?.commitSha || '',
        checkpointId: result?.data?.checkpoint?.id || ''
      });
      result.continuity = { taskId: continuity.taskId, idempotencyKey: continuity.idempotencyKey, completed: true, replay: false };
    }
    return result;
  } catch (error) {
    if (continuity && lease?.leaseToken) {
      await failContinuityStep({
        taskId: continuity.taskId,
        idempotencyKey: continuity.idempotencyKey,
        leaseToken: lease.leaseToken,
        errorCode: error?.code || 'TOOL_RUNTIME_FAILED',
        outcomeUnknown: tool.mode === 'write'
      }).catch(() => null);
    }
    throw error;
  }
}

export async function invokeToolRuntimeAction(action, payload = {}) {
  return handle(action, payload);
}

export function installToolRuntime() {
  if (globalThis.__LD61_TOOL_RUNTIME__) return;
  globalThis.__LD61_TOOL_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = text(message?.id);
      try {
        const data = await handle(message?.action || 'list', message?.payload || {});
        port.postMessage({ id, ok: true, data });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok: false,
            error: error?.message || String(error),
            code: error?.code || '',
            operationId: error?.operationId || ''
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });

  globalThis.LovableDecrypterToolRuntime = Object.freeze({
    build: 68,
    schema: 'ld-tool-runtime/1',
    port: PORT_NAME,
    providerNeutral: true,
    readToolsAutomatic: true,
    writesFailClosed: true,
    scopeLayer: Object.freeze({ writePolicy: 'validated-approval+scope-intelligence-v2' }),
    writePolicy: 'validated-approval+scope-intelligence-v2+continuity-idempotency',
    scopeIntelligenceRequiredForWrites: true,
    continuityAware: true,
    localOrchestratorAware: true,
    localAgentProposalDigestBinding: true,
    preWriteHeadCheckpoint: true,
    duplicateWritesPreventedByIdempotency: true,
    ambiguousWriteRetryRequiresVerification: true,
    operationJournal: true,
    manualChangeOrigins: true,
    diagnosticsCapabilityGated: true,
    lspCapabilityGated: true
  });
}
