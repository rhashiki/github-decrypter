import { DEFAULT_SETTINGS, STORAGE_KEY, mergeSettings } from '../settings/config.js';

export async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return mergeSettings(data[STORAGE_KEY] || DEFAULT_SETTINGS);
}

export async function saveSettings(next) {
  const merged = mergeSettings(next || {});
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
  return merged;
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const next = mergeSettings({
    ...current,
    ...patch,
    gemini: { ...current.gemini, ...(patch?.gemini || {}) },
    github: { ...current.github, ...(patch?.github || {}) },
    supabase: { ...current.supabase, ...(patch?.supabase || {}) },
    agent: { ...current.agent, ...(patch?.agent || {}) },
    ui: { ...current.ui, ...(patch?.ui || {}) },
    projectMappings: { ...current.projectMappings, ...(patch?.projectMappings || {}) }
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
