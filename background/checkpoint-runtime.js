import { HISTORY_KEY, DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { verifyLicenseKey } from '../security/license.js';
import { listCheckpoints, rollbackCheckpoint } from '../core/checkpoint-manager.js';
import { syncRepositoryCache } from '../core/repo-cache.js';
import { nowIso } from '../core/utils.js';

const PORT_NAME = 'ld2-checkpoints';
const INSTALLED = Symbol.for('ld2.checkpointRuntime.installed');

async function validateLicenseRemote(settings) {
  const licenseKey = String(settings?.auth?.licenseKey || '');
  const deviceId = String(settings?.auth?.deviceId || '');
  if (!licenseKey) throw new Error('Faça login com uma KEY válida para usar checkpoints.');
  await verifyLicenseKey(licenseKey);
  if (!deviceId) throw new Error('Dispositivo não vinculado à licença. Faça login novamente.');

  const base = String(settings?.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const res = await fetch(`${base}/ld-license-validate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': licenseKey,
      'x-device-id': deviceId
    },
    body: JSON.stringify({})
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.valid) {
    const code = body?.code || `HTTP_${res.status}`;
    throw new Error(`Licença recusada pelo servidor: ${code}`);
  }
  return settings;
}

async function authorizedSettings() {
  return validateLicenseRemote(await getSettings());
}

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId];
  const github = { ...(settings?.github || {}), ...(mapping || {}) };
  if (!github.owner || !github.repo) throw new Error('Configure o GitHub antes de usar checkpoints.');
  return github;
}

async function historyPush(entry) {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const list = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  list.unshift({ id: crypto.randomUUID(), at: nowIso(), ...entry });
  await chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, 100) });
}

async function listForProject({ projectId = '' } = {}) {
  const settings = await authorizedSettings();
  const github = activeGithub(settings, projectId);
  const checkpoints = await listCheckpoints({ owner: github.owner, repo: github.repo, branch: github.branch });
  return {
    github: { owner: github.owner, repo: github.repo, branch: github.branch || 'main' },
    checkpoints
  };
}

async function rollbackForProject({ projectId = '', checkpointId = '' } = {}) {
  const settings = await authorizedSettings();
  const github = activeGithub(settings, projectId);
  const checkpoints = await listCheckpoints({ owner: github.owner, repo: github.repo, branch: github.branch });
  const checkpoint = checkpoints.find(item => item?.id === checkpointId);
  if (!checkpoint) throw new Error('Checkpoint não encontrado para este projeto/branch.');
  if (checkpoint.status !== 'published') {
    throw new Error(`Rollback indisponível: checkpoint está com status ${checkpoint.status || 'desconhecido'}.`);
  }

  const adapter = new GitAdapter(github);
  const result = await rollbackCheckpoint({ adapter, checkpoint, reason: 'manual' });
  syncRepositoryCache(adapter, { branch: checkpoint.branch }).catch(() => null);

  await historyPush({
    type: 'apply',
    command: `↶ ROLLBACK SEGURO · ${checkpoint.summary || checkpoint.command || 'checkpoint'}`,
    repo: checkpoint.repo || `${checkpoint.owner}/${checkpoint.repository}`,
    summary: `Checkpoint ${String(checkpoint.id).slice(0, 8)} restaurado em ${checkpoint.branch} · commit ${String(result.rollbackCommitSha).slice(0, 8)}`,
    result: {
      branch: checkpoint.branch,
      commitSha: result.rollbackCommitSha,
      checkpointId: checkpoint.id,
      rollback: true,
      restoredTreeSha: result.restoredTreeSha,
      previousHeadSha: result.previousHeadSha
    }
  });

  return {
    ...result,
    github: { owner: github.owner, repo: github.repo, branch: github.branch || 'main' }
  };
}

async function dispatch(message = {}) {
  switch (message.action) {
    case 'list': return listForProject(message);
    case 'rollback': return rollbackForProject(message);
    default: throw new Error(`Ação de checkpoint desconhecida: ${message.action || '—'}`);
  }
}

export function installCheckpointRuntime() {
  if (globalThis[INSTALLED]) return false;
  globalThis[INSTALLED] = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port?.name !== PORT_NAME) return;
    port.onMessage.addListener(message => {
      const requestId = message?.requestId || crypto.randomUUID();
      dispatch(message)
        .then(data => {
          try { port.postMessage({ requestId, ok: true, data }); } catch (_) {}
        })
        .catch(error => {
          try { port.postMessage({ requestId, ok: false, error: error?.message || String(error) }); } catch (_) {}
        });
    });
  });
  return true;
}
