import { DEFAULT_SETTINGS, STORAGE_KEY, LEGACY_STORAGE_KEYS, mergeSettings } from '../settings/config.js';
import { sanitizeDurableSettings } from './secret-sanitizer.js';

function sameJson(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch (_) { return false; }
}

async function readCanonicalOrLegacySettings() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  const data = await chrome.storage.local.get(keys);
  if (data[STORAGE_KEY]) return data[STORAGE_KEY];

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    if (!data[legacyKey]) continue;
    const migrated = sanitizeDurableSettings(mergeSettings(data[legacyKey]));
    await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
    await chrome.storage.local.remove(legacyKey);
    return migrated;
  }

  return DEFAULT_SETTINGS;
}

export async function getSettings() {
  const source = await readCanonicalOrLegacySettings();
  const merged = mergeSettings(source);
  const sanitized = sanitizeDurableSettings(merged);
  if (!sameJson(merged, sanitized)) await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}

export async function saveSettings(next) {
  const merged = sanitizeDurableSettings(mergeSettings(next || {}));
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const next = sanitizeDurableSettings(mergeSettings({
    ...current,
    ...patch,
    gemini: { ...current.gemini, ...(patch?.gemini || {}) },
    github: { ...current.github, ...(patch?.github || {}) },
    supabase: { ...current.supabase, ...(patch?.supabase || {}) },
    agent: { ...current.agent, ...(patch?.agent || {}) },
    ui: { ...current.ui, ...(patch?.ui || {}) },
    projectMappings: { ...current.projectMappings, ...(patch?.projectMappings || {}) },
    supabaseMappings: { ...current.supabaseMappings, ...(patch?.supabaseMappings || {}) }
  }));
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
