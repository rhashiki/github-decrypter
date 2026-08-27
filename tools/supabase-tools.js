import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';

const REQUEST_TIMEOUT_MS = 50000;

async function backendRequest(action, payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey || !deviceId) throw new Error('Faça login com sua KEY antes de usar o Supabase.');
  const base = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/ld-supabase-oauth`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
        'x-device-id': deviceId
      },
      body: JSON.stringify({ action, ...payload })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.code || `Supabase HTTP ${res.status}`);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O backend do Supabase não respondeu dentro do tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function selectedProject(settings, projectId = '', overrideRef = '') {
  const mapped = projectId && settings.supabaseMappings?.[projectId];
  const projectRef = String(overrideRef || mapped?.projectRef || settings.supabase?.projectRef || '').trim();
  if (!/^[a-z0-9]{8,32}$/i.test(projectRef)) throw new Error('Selecione um projeto Supabase no Control Center primeiro.');
  return projectRef;
}

export async function testSupabase(config = {}) {
  const settings = await getSettings();
  const projectRef = selectedProject(settings, config.projectId || '', config.projectRef || '');
  return backendRequest('project_test', { project_ref: projectRef });
}

export async function runSupabaseSql({ projectRef = '', projectId = '', sql = '' } = {}) {
  if (!String(sql || '').trim()) throw new Error('SQL vazio.');
  const settings = await getSettings();
  const activeRef = selectedProject(settings, projectId, projectRef);
  const body = await backendRequest('query', { project_ref: activeRef, sql: String(sql) });
  return body.result;
}
