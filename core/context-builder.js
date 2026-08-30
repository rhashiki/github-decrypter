import { buildContextPack } from './context-engine-v2.js';
import { getSettings } from '../storage/settings-store.js';

async function legacySignals(adapter, options = {}) {
  const owner = String(options.owner || adapter?.owner || '').trim();
  const repo = String(options.repo || adapter?.repo || '').trim();
  let projectId = String(options.projectId || '').trim();
  let profile = options.profile && typeof options.profile === 'object' ? options.profile : null;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return { projectId, profile: profile || {} };
  try {
    const settings = await getSettings();
    if (!projectId) {
      for (const [id, mapping] of Object.entries(settings?.projectMappings || {})) {
        const github = { ...(settings?.github || {}), ...(mapping || {}) };
        if (String(github?.owner || '') === owner && String(github?.repo || '') === repo) { projectId = id; break; }
      }
    }
    if (!profile && owner && repo) {
      const key = `ld2_agent_profile_${owner}_${repo}`;
      const stored = await chrome.storage.local.get(key);
      profile = stored[key] && typeof stored[key] === 'object' ? stored[key] : {};
    }
  } catch (_) {}
  return { projectId, profile: profile || {} };
}

// Compatibility adapter for older execution paths. Build 64 keeps the public
// function name while moving selection authority to Context Engine v2.
export async function buildProjectContext(adapter, command, options = {}) {
  const signals = await legacySignals(adapter, options);
  return buildContextPack(adapter, command, {
    ...options,
    owner: options.owner || adapter?.owner || '',
    repo: options.repo || adapter?.repo || '',
    projectId: options.projectId || signals.projectId,
    profile: options.profile || signals.profile
  });
}
