import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';

const PORT_NAME = 'ld2-cloud-assets';
const REQUEST_TIMEOUT_MS = 70000;
const MAX_SOURCE_FILES = 320;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const BUILTIN_SECRET_NAMES = new Set([
  'SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY','SUPABASE_DB_URL','DATABASE_URL','DENO_DEPLOYMENT_ID','SB_EXECUTION_ID',
  'SB_REGION','SB_RUNTIME_VERSION'
]);

function backendBase(settings) {
  return String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
}
async function assetBackend(action, payload = {}) {
  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey || !deviceId) throw new Error('Faça login com uma KEY válida antes de migrar assets.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${backendBase(settings)}/ld-cloud-migrator-assets`, {
      method: 'POST', signal: controller.signal,
      headers: {'Content-Type':'application/json','x-license-key':licenseKey,'x-device-id':deviceId},
      body: JSON.stringify({ action, ...payload })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const code = body?.code || `HTTP_${res.status}`;
      const extra = Array.isArray(body?.missing_scopes) ? `:${body.missing_scopes.join(',')}` : '';
      throw new Error(`Cloud Assets: ${code}${extra}`);
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('O broker de assets não respondeu dentro do tempo limite.');
    throw error;
  } finally { clearTimeout(timer); }
}
function repoConfig(settings, projectId) {
  const mapping = settings.projectMappings?.[projectId] || {};
  const gh = settings.github || {};
  return {
    ...gh,
    owner: String(mapping.owner || gh.owner || ''),
    repo: String(mapping.repo || gh.repo || ''),
    branch: String(mapping.branch || gh.branch || 'main'),
    installationId: Number(gh.installationId || 0) || null,
    authMode: 'github_app', token: ''
  };
}
function secretNamesFromText(source, out) {
  const text = String(source || '');
  const patterns = [
    /Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]{1,127})['"]\s*\)/g,
    /process\.env\.([A-Z][A-Z0-9_]{1,127})\b/g,
    /process\.env\[\s*['"]([A-Z][A-Z0-9_]{1,127})['"]\s*\]/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const name = String(match[1] || '').trim();
      if (name && !BUILTIN_SECRET_NAMES.has(name) && !/^VITE_|^NEXT_PUBLIC_|^PUBLIC_/i.test(name)) out.add(name);
    }
  }
}
function parseArrayLiteral(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('[') || !raw.endsWith(']')) return [];
  const out = []; const re = /"([^"]*)"|'([^']*)'/g; let m;
  while ((m = re.exec(raw))) out.push(m[1] ?? m[2] ?? '');
  return out.filter(Boolean);
}
function parseTomlSafe(text) {
  const result = { auth: {}, externalProviders: [] };
  let section = '';
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim(); if (!line) continue;
    const sec = line.match(/^\[([^\]]+)\]$/); if (sec) { section = sec[1].trim(); continue; }
    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/); if (!kv) continue;
    const key = kv[1], value = kv[2].trim();
    if (section === 'auth') {
      if (key === 'site_url') result.auth.site_url = value.replace(/^["']|["']$/g, '');
      if (key === 'additional_redirect_urls') result.auth.uri_allow_list = parseArrayLiteral(value).join(',');
      if (key === 'enable_signup') result.auth.disable_signup = !/^true$/i.test(value);
    }
    const provider = section.match(/^auth\.external\.([A-Za-z0-9_-]+)$/);
    if (provider && key === 'enabled' && /^true$/i.test(value)) result.externalProviders.push(provider[1]);
  }
  return result;
}
async function sourceManifest(projectId) {
  const settings = await getSettings();
  const config = repoConfig(settings, projectId);
  if (!config.owner || !config.repo || !config.installationId) throw new Error('GitHub AutoSync não está pronto para este projeto.');
  const git = new GitAdapter(config);
  const tree = await git.getTree(config.branch, true);
  const items = Array.isArray(tree?.tree) ? tree.tree : [];
  const sourceItems = items.filter(item => item?.type === 'blob' && /^supabase\/functions\/[^/]+\//.test(String(item.path || '')) && !/\/ld-migrate-helper\//.test(String(item.path || '')));
  if (sourceItems.length > MAX_SOURCE_FILES) throw new Error(`Há ${sourceItems.length} arquivos de Edge Functions; limite seguro atual: ${MAX_SOURCE_FILES}.`);
  const totalBytes = sourceItems.reduce((n, item) => n + Number(item.size || 0), 0);
  if (totalBytes > MAX_SOURCE_BYTES) throw new Error('As Edge Functions excedem 8 MB de código-fonte para migração automática.');
  const shared = sourceItems.filter(item => /^supabase\/functions\/_shared\//.test(item.path));
  const functionSlugs = [...new Set(sourceItems.map(item => String(item.path).split('/')[2]).filter(slug => slug && slug !== '_shared'))].sort();
  const secretNames = new Set(); const textByPath = new Map();
  for (const item of sourceItems) {
    if (Number(item.size || 0) > 1024 * 1024) continue;
    const text = await git.getBlob(item.sha); textByPath.set(item.path, text); secretNamesFromText(text, secretNames);
  }
  let configToml = '';
  const configItem = items.find(item => item.type === 'blob' && item.path === 'supabase/config.toml');
  if (configItem) configToml = textByPath.get(configItem.path) || await git.getBlob(configItem.sha);
  const safeConfig = parseTomlSafe(configToml);
  const functions = functionSlugs.map(slug => ({
    slug,
    files: sourceItems.filter(item => item.path.startsWith(`supabase/functions/${slug}/`)).length + shared.length,
    bytes: sourceItems.filter(item => item.path.startsWith(`supabase/functions/${slug}/`) || item.path.startsWith('supabase/functions/_shared/')).reduce((n, item) => n + Number(item.size || 0), 0)
  }));
  return {
    repo: `${config.owner}/${config.repo}`, branch: config.branch, functions,
    secretNames: [...secretNames].sort(), config: safeConfig,
    warnings: safeConfig.externalProviders.length ? [`Provedores Auth detectados (${safeConfig.externalProviders.join(', ')}): credenciais do provedor não são copiadas sem valor verificável.`] : []
  };
}
async function functionPayload(projectId, slug) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) throw new Error('Slug de Edge Function inválido.');
  const settings = await getSettings(); const config = repoConfig(settings, projectId); const git = new GitAdapter(config);
  const tree = await git.getTree(config.branch, true);
  const items = (tree?.tree || []).filter(item => item.type === 'blob' && (String(item.path).startsWith(`supabase/functions/${slug}/`) || String(item.path).startsWith('supabase/functions/_shared/')));
  if (!items.some(item => item.path === `supabase/functions/${slug}/index.ts`)) throw new Error(`Edge Function ${slug} sem index.ts.`);
  const files = [];
  for (const item of items) {
    if (Number(item.size || 0) > 1024 * 1024) throw new Error(`${item.path} excede 1 MB.`);
    files.push({ path: item.path, content: await git.getBlob(item.sha) });
  }
  let verifyJwt = true;
  try {
    const cfg = await git.getFileByPath('supabase/config.toml', config.branch);
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = String(cfg.text || '').match(new RegExp(`\\[functions\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'i'))?.[1] || '';
    verifyJwt = !/verify_jwt\s*=\s*false/i.test(block);
  } catch (_) {}
  return { slug, files, verify_jwt: verifyJwt };
}
async function deployFunctions(projectId, jobId, onProgress) {
  const manifest = await sourceManifest(projectId);
  await assetBackend('functions_manifest', { job_id: jobId, functions: manifest.functions.map(x => x.slug) });
  let done = 0;
  for (const meta of manifest.functions) {
    onProgress?.({ phase:'edge_functions', current:meta.slug, done, total:manifest.functions.length });
    await assetBackend('deploy_function', { job_id: jobId, ...(await functionPayload(projectId, meta.slug)) });
    done++; onProgress?.({ phase:'edge_functions', current:meta.slug, done, total:manifest.functions.length });
  }
  return { done, total:manifest.functions.length, secretNames:manifest.secretNames, config:manifest.config, warnings:manifest.warnings };
}
export function installCloudAssetsRuntime() {
  if (globalThis.__LD2_CLOUD_ASSETS_RUNTIME__) return;
  globalThis.__LD2_CLOUD_ASSETS_RUNTIME__ = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || ''), action = String(message?.action || 'status'), payload = message?.payload || {};
      try {
        if (action === 'source_manifest') return port.postMessage({ id, ok:true, data:await sourceManifest(String(payload.projectId || '')) });
        if (action === 'deploy_functions') {
          const data = await deployFunctions(String(payload.projectId || ''), String(payload.job_id || ''), progress => { try { port.postMessage({ id, progress }); } catch (_) {} });
          return port.postMessage({ id, ok:true, data });
        }
        if (action === 'apply_repo_config') {
          const manifest = await sourceManifest(String(payload.projectId || ''));
          const data = await assetBackend('apply_config', { job_id:String(payload.job_id || ''), config:manifest.config, warnings:manifest.warnings });
          return port.postMessage({ id, ok:true, data });
        }
        if (!['prepare','active','status','inspect','run_next','cancel','functions_manifest','deploy_function','apply_config'].includes(action)) throw new Error('Ação de assets inválida.');
        port.postMessage({ id, ok:true, data:await assetBackend(action, payload) });
      } catch (error) { try { port.postMessage({ id, ok:false, error:error?.message || String(error) }); } catch (_) {} }
    };
    port.onMessage.addListener(handler);
  });
}
