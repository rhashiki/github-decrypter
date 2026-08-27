const PORT_NAME = 'ld2-project-runtime';
const LAST_KEY = 'ld2_project_runtime_last';
const keyFor = projectId => `ld2_project_runtime_${String(projectId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80)}`;

function cleanText(value, max = 500) {
  return String(value ?? '').slice(0, max);
}

function sanitize(raw = {}) {
  const projectId = cleanText(raw.projectId, 80);
  const project = raw.project || {};
  const workspace = raw.workspace || {};
  const git = raw.gitSync || {};
  const backend = raw.backend || {};
  const preview = raw.preview || {};
  const diagnostics = raw.diagnostics || {};
  return {
    detected: !!raw.detected,
    projectId,
    url: cleanText(raw.url, 1200),
    collectedAt: cleanText(raw.collectedAt, 80),
    auth: { sessionAvailable: !!raw.auth?.sessionAvailable },
    project: {
      name: cleanText(project.name, 240),
      framework: cleanText(project.framework, 120)
    },
    workspace: {
      id: cleanText(workspace.id, 120),
      name: cleanText(workspace.name, 240)
    },
    gitSync: {
      connected: !!git.connected,
      owner: cleanText(git.owner, 160),
      repo: cleanText(git.repo, 200),
      branch: cleanText(git.branch, 200),
      fullName: cleanText(git.fullName, 380)
    },
    backend: {
      type: ['lovable_cloud', 'supabase', 'none', 'unknown'].includes(backend.type) ? backend.type : 'unknown',
      managedByLovable: typeof backend.managedByLovable === 'boolean' ? backend.managedByLovable : null,
      supabaseRef: cleanText(backend.supabaseRef, 80),
      supabaseUrl: cleanText(backend.supabaseUrl, 500)
    },
    preview: {
      state: ['ready', 'loading', 'unknown'].includes(preview.state) ? preview.state : 'unknown',
      available: !!preview.available,
      url: cleanText(preview.url, 1200)
    },
    diagnostics: {
      partial: !!diagnostics.partial,
      reason: cleanText(diagnostics.reason, 120),
      successfulProbes: Number.isFinite(Number(diagnostics.successfulProbes)) ? Number(diagnostics.successfulProbes) : 0,
      probes: {
        details: !!diagnostics.probes?.details,
        config: !!diagnostics.probes?.config,
        cloud: !!diagnostics.probes?.cloud,
        gitSync: !!diagnostics.probes?.gitSync,
        packageJson: !!diagnostics.probes?.packageJson
      }
    }
  };
}

async function storeContext(raw) {
  const context = sanitize(raw);
  const values = { [LAST_KEY]: context };
  if (context.projectId) values[keyFor(context.projectId)] = context;
  await chrome.storage.session.set(values);
  return context;
}

async function getContext(projectId = '') {
  const key = projectId ? keyFor(projectId) : LAST_KEY;
  const data = await chrome.storage.session.get(key);
  return data[key] || null;
}

export function installLovableProjectRuntime() {
  if (globalThis.__LD2_LOVABLE_PROJECT_RUNTIME_BG__) return;
  globalThis.__LD2_LOVABLE_PROJECT_RUNTIME_BG__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const handler = async message => {
      const id = String(message?.id || '');
      try {
        const action = String(message?.action || '');
        if (action === 'update') {
          const data = await storeContext(message?.payload?.context || {});
          port.postMessage({ id, ok: true, data });
          return;
        }
        if (action === 'get') {
          const data = await getContext(String(message?.payload?.projectId || ''));
          port.postMessage({ id, ok: true, data });
          return;
        }
        if (action === 'clear') {
          const projectId = String(message?.payload?.projectId || '');
          const keys = [LAST_KEY, ...(projectId ? [keyFor(projectId)] : [])];
          await chrome.storage.session.remove(keys);
          port.postMessage({ id, ok: true, data: { cleared: true } });
          return;
        }
        throw new Error('Ação do Lovable Project Runtime desconhecida.');
      } catch (error) {
        try { port.postMessage({ id, ok: false, error: error?.message || String(error) }); } catch (_) {}
      }
    };
    port.onMessage.addListener(handler);
  });
}
