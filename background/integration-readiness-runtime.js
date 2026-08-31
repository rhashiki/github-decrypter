import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { evaluateAccountIntegrationReadiness, assertAccountIntegrationReadiness } from '../core/account-integration-readiness.js';

const PORT_NAME = 'ld2-account-integration-readiness';
const WRITE_GUARD = Symbol.for('ld2.accountIntegration.writeGuard');
const REQUEST_TIMEOUT_MS = 30000;

const text = value => String(value ?? '').trim();

async function backendStatus(endpoint, action, settings) {
  const licenseKey = text(settings?.auth?.licenseKey);
  const deviceId = text(settings?.auth?.deviceId);
  if (!licenseKey || !deviceId) return { ok:false, app_configured:false, connected:false, code:'DECRYPTER_LOGIN_REQUIRED' };
  const base = text(settings?.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/${endpoint}`, {
      method:'POST',
      signal:controller.signal,
      headers:{ 'Content-Type':'application/json', 'x-license-key':licenseKey, 'x-device-id':deviceId },
      body:JSON.stringify({ action })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) return { ok:false, app_configured:false, connected:false, code:body?.code || `HTTP_${response.status}` };
    return body;
  } catch (error) {
    return { ok:false, app_configured:false, connected:false, code:error?.name === 'AbortError' ? 'INTEGRATION_STATUS_TIMEOUT' : 'INTEGRATION_STATUS_UNAVAILABLE' };
  } finally {
    clearTimeout(timer);
  }
}

function resolveProjectIdForRepository(settings, context = {}) {
  const explicit = text(context?.projectId);
  if (explicit) return explicit.slice(0,120);
  const owner = text(context?.owner).toLowerCase();
  const repo = text(context?.repo).toLowerCase();
  if (!owner || !repo) return '';
  const matches = Object.entries(settings?.projectMappings || {}).filter(([, mapping]) =>
    text(mapping?.owner).toLowerCase() === owner && text(mapping?.repo).toLowerCase() === repo
  );
  if (matches.length === 1) return text(matches[0][0]).slice(0,120);
  if (matches.length > 1) {
    const error = new Error('ACCOUNT_INTEGRATION_PROJECT_MAPPING_AMBIGUOUS');
    error.code = 'ACCOUNT_INTEGRATION_PROJECT_MAPPING_AMBIGUOUS';
    throw error;
  }
  return '';
}

async function loadStatuses(settings) {
  return Promise.all([
    backendStatus('ld-github-app','status',settings),
    backendStatus('ld-supabase-manager','status',settings)
  ]);
}

export async function loadAccountIntegrationReadiness(projectId = '') {
  const settings = await getSettings();
  const [githubStatus, supabaseStatus] = await loadStatuses(settings);
  const readiness = evaluateAccountIntegrationReadiness({ projectId:text(projectId).slice(0,120), settings, githubStatus, supabaseStatus });
  return { ...readiness, checkedAt:new Date().toISOString() };
}

export async function assertRemoteAccountIntegrationReadiness(projectId = '') {
  const settings = await getSettings();
  const [githubStatus, supabaseStatus] = await loadStatuses(settings);
  return assertAccountIntegrationReadiness({ projectId:text(projectId).slice(0,120), settings, githubStatus, supabaseStatus });
}

async function assertWriteContext(context = {}) {
  const settings = await getSettings();
  const projectId = resolveProjectIdForRepository(settings, context);
  const [githubStatus, supabaseStatus] = await loadStatuses(settings);
  const readiness = assertAccountIntegrationReadiness({ projectId, settings, githubStatus, supabaseStatus });
  const expected = `${text(context?.owner)}/${text(context?.repo)}`.toLowerCase();
  if (expected && readiness.github.repository.toLowerCase() !== expected) {
    const error = new Error('GITHUB_REPOSITORY_MAPPING_MISMATCH');
    error.code = 'GITHUB_REPOSITORY_MAPPING_MISMATCH';
    error.readiness = readiness;
    throw error;
  }
  return readiness;
}

export function installIntegrationWriteGuard() {
  globalThis[WRITE_GUARD] = assertWriteContext;
  return true;
}

export function installIntegrationReadinessRuntime() {
  if (globalThis.__LD70_INTEGRATION_READINESS_RUNTIME__) return;
  globalThis.__LD70_INTEGRATION_READINESS_RUNTIME__ = true;
  installIntegrationWriteGuard();

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = text(message?.id);
      const action = text(message?.action || 'status');
      const projectId = text(message?.payload?.projectId).slice(0,120);
      try {
        if (action === 'status') {
          port.postMessage({ id, ok:true, data:await loadAccountIntegrationReadiness(projectId) });
          return;
        }
        if (action === 'assert') {
          port.postMessage({ id, ok:true, data:await assertRemoteAccountIntegrationReadiness(projectId) });
          return;
        }
        throw Object.assign(new Error('ACCOUNT_INTEGRATION_ACTION_INVALID'), { code:'ACCOUNT_INTEGRATION_ACTION_INVALID' });
      } catch (error) {
        try {
          port.postMessage({
            id,
            ok:false,
            error:error?.message || String(error),
            code:error?.code || '',
            readiness:error?.readiness || null
          });
        } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });

  globalThis.LovableDecrypterAccountIntegrations = Object.freeze({
    build:70,
    schema:'ld-account-integration-readiness/1',
    port:PORT_NAME,
    githubRequired:true,
    supabaseRequired:true,
    remoteValidationBeforeWrite:true,
    secretsInExtension:false
  });
}
