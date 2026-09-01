'use strict';

importScripts('runtime-entry-v84.js');

const LD84_RESOURCE_BACKEND = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
const LD84_RESOURCE_ACCOUNT_KEY = 'ld84_account';
const LD84_RESOURCE_DEVICE_KEY = 'ld84_device_id';

function ld84ResourceStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, value => resolve(value || {})));
}

async function ld84ResourceCredentials() {
  const stored = await ld84ResourceStorage([LD84_RESOURCE_ACCOUNT_KEY, LD84_RESOURCE_DEVICE_KEY]);
  const account = stored[LD84_RESOURCE_ACCOUNT_KEY] && typeof stored[LD84_RESOURCE_ACCOUNT_KEY] === 'object' ? stored[LD84_RESOURCE_ACCOUNT_KEY] : {};
  const licenseKey = String(account.licenseKey || '').trim();
  const deviceId = String(stored[LD84_RESOURCE_DEVICE_KEY] || '').trim();
  if (account.active !== true || !licenseKey) throw new Error('ACCOUNT_NOT_ACTIVE');
  if (!deviceId) throw new Error('DEVICE_REQUIRED');
  return { licenseKey, deviceId };
}

async function ld84ResourceBackend(endpoint, action, payload = {}) {
  const credentials = await ld84ResourceCredentials();
  const response = await fetch(`${LD84_RESOURCE_BACKEND}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-license-key': credentials.licenseKey,
      'x-device-id': credentials.deviceId
    },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.code || `HTTP_${response.status}`));
    error.code = String(body?.code || `HTTP_${response.status}`);
    throw error;
  }
  return body;
}

function ld84NormalizeAvailable(integration, status) {
  if (integration === 'github') {
    const repositories = Array.isArray(status?.repositories) ? status.repositories : [];
    return repositories
      .map(repo => ({
        id: String(repo?.full_name || ''),
        label: String(repo?.full_name || repo?.name || ''),
        meta: String(repo?.default_branch || 'main'),
        private: repo?.private === true
      }))
      .filter(item => item.id);
  }
  const projects = Array.isArray(status?.projects) ? status.projects : [];
  return projects
    .map(project => ({
      id: String(project?.ref || ''),
      label: String(project?.name || project?.ref || ''),
      meta: [project?.ref, project?.region, project?.status].filter(Boolean).join(' · ')
    }))
    .filter(item => item.id);
}

async function ld84ResourceStatus(integration) {
  const endpoint = integration === 'github' ? 'ld-github-app' : integration === 'supabase' ? 'ld-supabase-oauth' : '';
  if (!endpoint) throw new Error('INTEGRATION_INVALID');
  const [status, selection] = await Promise.all([
    ld84ResourceBackend(endpoint, 'status'),
    ld84ResourceBackend('ld-integration-selection', 'get', { integration })
  ]);
  const available = ld84NormalizeAvailable(integration, status);
  const availableIds = new Set(available.map(item => item.id));
  const rawSelected = selection?.mode === 'all' || selection?.selected === null
    ? available.map(item => item.id)
    : (Array.isArray(selection?.selected) ? selection.selected.map(String) : []);
  const selected = rawSelected.filter(id => availableIds.has(id));
  return {
    ok: true,
    integration,
    available,
    selected,
    mode: selection?.mode === 'all' || selection?.selected === null ? 'all' : 'selected',
    manageUrl: integration === 'github' ? String(status?.installation?.manage_url || '') : '',
    connected: status?.connected === true
  };
}

async function ld84ResourceSave(integration, selectedInput) {
  const current = await ld84ResourceStatus(integration);
  const availableIds = new Set(current.available.map(item => item.id));
  const selected = [...new Set((Array.isArray(selectedInput) ? selectedInput : []).map(String))];
  if (selected.some(id => !availableIds.has(id))) throw new Error('RESOURCE_NOT_AUTHORIZED');
  const mode = selected.length === current.available.length ? 'all' : 'selected';
  const saved = await ld84ResourceBackend('ld-integration-selection', 'set', { integration, mode, selected });
  return {
    ok: true,
    integration,
    mode: saved?.mode || mode,
    selected: saved?.mode === 'all' ? current.available.map(item => item.id) : selected,
    available: current.available,
    manageUrl: current.manageUrl
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = String(message?.type || '');
  if (!['ld84.integration.resources.status', 'ld84.integration.resources.save'].includes(type)) return;

  const senderUrl = String(sender?.url || sender?.tab?.url || '');
  if (senderUrl) {
    try {
      const parsed = new URL(senderUrl);
      const allowed = parsed.protocol === 'chrome-extension:' || parsed.hostname === 'lovable.dev' || parsed.hostname.endsWith('.lovable.dev');
      if (!allowed) {
        sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
        return false;
      }
    } catch (_) {
      sendResponse({ ok: false, code: 'SENDER_NOT_ALLOWED' });
      return false;
    }
  }

  const integration = String(message?.integration || '');
  const task = type === 'ld84.integration.resources.status'
    ? ld84ResourceStatus(integration)
    : ld84ResourceSave(integration, message?.selected);

  task.then(sendResponse).catch(error => sendResponse({ ok: false, code: String(error?.code || error?.message || 'RESOURCE_MANAGEMENT_FAILED') }));
  return true;
});
