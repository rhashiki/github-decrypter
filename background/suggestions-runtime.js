import { DEFAULT_BACKEND_BASE } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { verifyLicenseKey } from '../security/license.js';

const PORT_NAME = 'ld2-suggestions';
const INSTALLED = Symbol.for('ld2.suggestionsRuntime.installed');

async function validateLicenseRemote(settings) {
  const licenseKey = String(settings?.auth?.licenseKey || '');
  const deviceId = String(settings?.auth?.deviceId || '');
  if (!licenseKey) throw new Error('Faça login com uma KEY válida para usar sugestões automáticas.');
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
  if (!res.ok || !body?.valid) throw new Error(`Licença recusada pelo servidor: ${body?.code || `HTTP_${res.status}`}`);
  return settings;
}

function activeGithub(settings, projectId = '') {
  const mapping = projectId && settings?.projectMappings?.[projectId];
  const github = { ...(settings?.github || {}), ...(mapping || {}) };
  if (!github.owner || !github.repo) throw new Error('Configure o GitHub antes de usar sugestões automáticas.');
  return { ...github, branch: github.branch || 'main' };
}

function isSource(path = '') {
  return /\.(?:[cm]?[jt]sx?|vue|svelte|astro|py|rb|php|go|rs|java|kt|swift)$/i.test(path);
}

function isTest(path = '') {
  return /(^|\/)(?:__tests__|tests?|spec)(\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path);
}

function hasAny(paths, patterns) {
  return paths.some(path => patterns.some(pattern => pattern.test(path)));
}

async function scanRepository({ projectId = '' } = {}) {
  const settings = await validateLicenseRemote(await getSettings());
  const github = activeGithub(settings, projectId);
  const adapter = new GitAdapter(github);
  const ref = await adapter.getRef(github.branch);
  const headSha = String(ref?.object?.sha || '');
  if (!headSha) throw new Error('Não foi possível resolver o HEAD da branch atual.');

  const tree = await adapter.getTree(headSha, true);
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const paths = entries.filter(entry => entry?.type === 'blob').map(entry => String(entry.path || '')).filter(Boolean);
  const truncated = Boolean(tree?.truncated);
  const packagePaths = paths.filter(path => /(^|\/)package\.json$/i.test(path) && !/(^|\/)node_modules\//i.test(path)).slice(0, 8);
  const rootPackage = packagePaths.includes('package.json') ? 'package.json' : packagePaths[0] || '';
  let scripts = {};
  let packageName = '';
  if (rootPackage) {
    try {
      const file = await adapter.getFileByPath(rootPackage, headSha);
      const pkg = JSON.parse(file.text || '{}');
      scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
      packageName = String(pkg?.name || '');
    } catch (_) {}
  }

  const sourceCount = paths.filter(isSource).length;
  const testCount = paths.filter(isTest).length;
  const envTracked = paths.filter(path => /(^|\/)\.env(?:\.[^/]+)?$/i.test(path) && !/(?:\.example|\.sample|\.template)$/i.test(path));
  const workflowCount = paths.filter(path => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path)).length;

  return {
    github: { owner: github.owner, repo: github.repo, branch: github.branch },
    headSha,
    truncated,
    scannedFiles: paths.length,
    packageName,
    packagePaths,
    scripts,
    signals: {
      sourceCount,
      testCount,
      workflowCount,
      hasCi: workflowCount > 0,
      hasTests: testCount > 0 || Boolean(scripts.test || scripts['test:ci']),
      hasLint: Boolean(scripts.lint || scripts['lint:check'] || scripts['check:lint']) || hasAny(paths, [/(^|\/)eslint\.config\./i, /(^|\/)\.eslintrc(?:\.|$)/i]),
      hasTypecheck: Boolean(scripts.typecheck || scripts['type-check'] || scripts['check:types'] || scripts['check-types']) || (hasAny(paths, [/(^|\/)tsconfig(?:\.[^/]+)?\.json$/i]) && Boolean(scripts.check)),
      hasBuild: Boolean(scripts.build),
      hasTypeScript: hasAny(paths, [/\.(?:ts|tsx|mts|cts)$/i, /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i]),
      hasGitignore: paths.includes('.gitignore'),
      hasReadme: paths.some(path => /^README(?:\.[^/]+)?$/i.test(path)),
      hasEnvExample: paths.some(path => /(^|\/)\.env\.(?:example|sample|template)$/i.test(path)),
      envTracked: envTracked.slice(0, 12),
      hasMigrations: paths.some(path => /(^|\/)supabase\/migrations\//i.test(path)),
      lockfiles: paths.filter(path => /(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(path)).slice(0, 12)
    }
  };
}

async function dispatch(message = {}) {
  if (message.action === 'scan') return scanRepository(message);
  throw new Error(`Ação de sugestões desconhecida: ${message.action || '—'}`);
}

export function installSuggestionsRuntime() {
  if (globalThis[INSTALLED]) return false;
  globalThis[INSTALLED] = true;
  chrome.runtime.onConnect.addListener(port => {
    if (port?.name !== PORT_NAME) return;
    port.onMessage.addListener(message => {
      const requestId = message?.requestId || crypto.randomUUID();
      dispatch(message)
        .then(data => { try { port.postMessage({ requestId, ok: true, data }); } catch (_) {} })
        .catch(error => { try { port.postMessage({ requestId, ok: false, error: error?.message || String(error) }); } catch (_) {} });
    });
  });
  return true;
}
