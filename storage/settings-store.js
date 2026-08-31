import { DEFAULT_SETTINGS, STORAGE_KEY, mergeSettings } from '../settings/config.js';
import { sanitizeDurableSettings } from './secret-sanitizer.js';

function sameJson(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch (_) { return false; }
}

export async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const merged = mergeSettings(data[STORAGE_KEY] || DEFAULT_SETTINGS);
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
