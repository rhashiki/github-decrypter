import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { ToolRuntime, toolJournal } from '../core/tool-runtime.js';

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
  if (!transactionId) return { writeApproved: false, allowedPaths: [], transactionId: '' };
  const key = txKey(transactionId);
  const stored = await chrome.storage.session.get(key);
  const tx = stored[key];
  if (!tx || tx.id !== transactionId) return { writeApproved: false, allowedPaths: [], transactionId };
  if (Date.parse(tx.expiresAt || '') <= Date.now()) return { writeApproved: false, allowedPaths: [], transactionId };
  if (tx.status !== 'validated') return { writeApproved: false, allowedPaths: [], transactionId };
  if (projectId && tx.projectId && String(tx.projectId) !== String(projectId)) return { writeApproved: false, allowedPaths: [], transactionId };
  return {
    writeApproved: true,
    allowedPaths: Array.isArray(tx.authorizedFiles) ? tx.authorizedFiles : [],
    transactionId,
    approvalHash: text(tx.hash),
    baseHeadSha: text(tx.baseHeadSha)
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

async function handle(action, payload = {}) {
  const op = text(action || 'list').toLowerCase();
  if (op === 'journal') return { schema: 'ld-operation-journal/1', entries: await toolJournal(payload?.filters || {}) };

  const { runtime, github, projectId } = await buildRuntime(payload);
  if (op === 'list') {
    return {
      schema: 'ld-tool-runtime/1',
      build: 61,
      repo: `${github.owner}/${github.repo}`,
      branch: github.branch || 'main',
      tools: runtime.list(),
      writePolicy: 'validated-approval-transaction-only',
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
    : { writeApproved: false, allowedPaths: [] };

  return runtime.invoke(toolName, payload?.input || {}, {
    origin: payload?.origin || 'tool',
    authorization,
    context: {
      taskId: text(payload?.taskId).slice(0, 160),
      parentOperationId: text(payload?.parentOperationId).slice(0, 160)
    }
  });
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
    build: 61,
    schema: 'ld-tool-runtime/1',
    port: PORT_NAME,
    providerNeutral: true,
    readToolsAutomatic: true,
    writesFailClosed: true,
    writePolicy: 'validated-approval-transaction-only',
    operationJournal: true,
    manualChangeOrigins: true,
    diagnosticsCapabilityGated: true,
    lspCapabilityGated: true
  });
}
