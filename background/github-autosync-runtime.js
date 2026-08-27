import { getSettings, updateSettings } from '../storage/settings-store.js';
import { requestGithubAppBackend } from './github-app-runtime.js';

const PORT_NAME = 'ld2-github-autosync';
const STATUS_PREFIX = 'ld2_github_autosync_';
const clean = value => String(value ?? '').trim();
const keyFor = projectId => `${STATUS_PREFIX}${clean(projectId).replace(/[^a-z0-9-]/gi, '').slice(0, 80)}`;

function statusShape(projectId, detectedRepo, state, extra = {}) {
  return {
    projectId: clean(projectId),
    detectedRepo: clean(detectedRepo),
    state,
    linked: state === 'linked',
    checkedAt: new Date().toISOString(),
    ...extra
  };
}

async function storeStatus(status) {
  if (!status?.projectId) return status;
  await chrome.storage.session.set({ [keyFor(status.projectId)]: status });
  return status;
}

async function getStatus(projectId) {
  const key = keyFor(projectId);
  const data = await chrome.storage.session.get(key);
  return data[key] || null;
}

async function neutralizeMapping(projectId, detected = {}, state = 'blocked') {
  if (!projectId) return;
  const settings = await getSettings();
  const current = settings.projectMappings?.[projectId] || {};
  const alreadyNeutral = !current.owner && !current.repo && current.source === 'lovable_gitsync_blocked' && current.detectedFullName === clean(detected.fullName);
  if (alreadyNeutral) return;
  await updateSettings({
    projectMappings: {
      [projectId]: {
        owner: '',
        repo: '',
        branch: clean(detected.branch) || 'main',
        source: 'lovable_gitsync_blocked',
        blockReason: state,
        detectedOwner: clean(detected.owner),
        detectedRepo: clean(detected.repo),
        detectedFullName: clean(detected.fullName),
        updatedAt: new Date().toISOString()
      }
    }
  });
}

function findAuthorizedRepository(repositories, fullName) {
  const wanted = clean(fullName).toLowerCase();
  return (Array.isArray(repositories) ? repositories : []).find(repo => clean(repo?.full_name).toLowerCase() === wanted) || null;
}

export async function reconcileGithubAutoSync(context = {}) {
  const projectId = clean(context.projectId);
  const git = context.gitSync || {};
  const detectedRepo = clean(git.fullName || (git.owner && git.repo ? `${git.owner}/${git.repo}` : ''));
  if (!projectId) return statusShape('', detectedRepo, 'no_project');
  if (!git.connected || !detectedRepo) {
    return storeStatus(statusShape(projectId, '', 'no_gitsync', { branch: clean(git.branch) || '' }));
  }

  let appStatus;
  try {
    appStatus = await requestGithubAppBackend('status');
  } catch (error) {
    await neutralizeMapping(projectId, git, 'github_status_error');
    return storeStatus(statusShape(projectId, detectedRepo, 'github_status_error', {
      branch: clean(git.branch) || 'main',
      error: error?.message || String(error)
    }));
  }

  if (!appStatus?.app_configured) {
    await neutralizeMapping(projectId, git, 'app_not_configured');
    return storeStatus(statusShape(projectId, detectedRepo, 'app_not_configured', { branch: clean(git.branch) || 'main' }));
  }
  if (!appStatus?.connected) {
    await neutralizeMapping(projectId, git, 'authorization_required');
    return storeStatus(statusShape(projectId, detectedRepo, 'authorization_required', { branch: clean(git.branch) || 'main' }));
  }

  const repository = findAuthorizedRepository(appStatus.repositories, detectedRepo);
  if (!repository) {
    await neutralizeMapping(projectId, git, 'repository_not_authorized');
    return storeStatus(statusShape(projectId, detectedRepo, 'repository_not_authorized', {
      branch: clean(git.branch) || 'main',
      authorizedRepositories: Array.isArray(appStatus.repositories) ? appStatus.repositories.length : 0,
      accountLogin: clean(appStatus.installation?.account_login)
    }));
  }

  const branch = clean(git.branch) || clean(repository.default_branch) || 'main';
  const owner = clean(repository.owner || repository.full_name?.split('/')?.[0] || git.owner);
  const repo = clean(repository.name || repository.full_name?.split('/')?.[1] || git.repo);
  if (!owner || !repo) throw new Error('GitSync autorizado sem owner/repo válido.');

  const settings = await getSettings();
  const current = settings.projectMappings?.[projectId] || {};
  const same = current.owner === owner && current.repo === repo && current.branch === branch && current.source === 'lovable_gitsync';
  if (!same) {
    await updateSettings({
      github: {
        ...(settings.github || {}),
        authMode: 'github_app',
        installationId: Number(appStatus.installation?.id) || settings.github?.installationId || null,
        accountLogin: clean(appStatus.installation?.account_login),
        appSlug: clean(appStatus.app?.slug),
        token: '',
        owner,
        repo,
        branch,
        createBranch: false,
        createPr: false
      },
      projectMappings: {
        [projectId]: {
          owner,
          repo,
          branch,
          source: 'lovable_gitsync',
          detectedFullName: detectedRepo,
          installationId: Number(appStatus.installation?.id) || null,
          autoLinkedAt: new Date().toISOString()
        }
      }
    });
  }

  return storeStatus(statusShape(projectId, detectedRepo, 'linked', {
    branch,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    installationId: Number(appStatus.installation?.id) || null,
    accountLogin: clean(appStatus.installation?.account_login),
    repositorySelection: clean(appStatus.installation?.repository_selection)
  }));
}

export function installGithubAutoSyncRuntime() {
  if (globalThis.__LD2_GITHUB_AUTOSYNC_RUNTIME__) return;
  globalThis.__LD2_GITHUB_AUTOSYNC_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = clean(message?.id);
      try {
        const action = clean(message?.action);
        if (action === 'get') {
          const data = await getStatus(clean(message?.payload?.projectId));
          port.postMessage({ id, ok: true, data });
          return;
        }
        if (action === 'reconcile') {
          const data = await reconcileGithubAutoSync(message?.payload?.context || {});
          port.postMessage({ id, ok: true, data });
          return;
        }
        throw new Error('Ação GitHub AutoSync inválida.');
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error) }); } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
