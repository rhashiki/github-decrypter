export const VERSION = '2.0.10';
export const STORAGE_KEY = 'ld2_settings';
export const HISTORY_KEY = 'ld2_history';

// Free Tier verificado na tabela oficial de preços da Gemini Developer API
// em 2026-08-25. Modelos não listados aqui continuam visíveis no catálogo
// dinâmico, porém são bloqueados quando ZERO COST está ativo.
export const VERIFIED_FREE_MODEL_IDS = Object.freeze([
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]);

export const DEFAULT_FREE_MODEL = 'gemini-3.6-flash';
export const DEFAULT_FREE_ADVANCED_MODEL = 'gemini-2.5-pro';

export function normalizeGeminiModelId(value = '') {
  return String(value || '').trim().replace(/^models\//, '');
}

export function isSpecializedGeminiModel(value = '') {
  const id = normalizeGeminiModelId(value).toLowerCase();
  return /(embedding|imagen|veo|image|tts|live|audio|aqa|robotics|computer-use|deep-research)/.test(id);
}

export function isVerifiedFreeModel(value = '') {
  const id = normalizeGeminiModelId(value);
  if (VERIFIED_FREE_MODEL_IDS.includes(id)) return true;
  // aliases/versionados seguros das mesmas famílias; especializados são barrados antes.
  if (isSpecializedGeminiModel(id)) return false;
  return VERIFIED_FREE_MODEL_IDS.some(base => id === `${base}-latest` || id === `${base}-001`);
}

export const DEFAULT_SETTINGS = {
  auth: {
    licenseKey: '',
    licenseStatus: 'signed-out',
    licenseId: '',
    licenseSubject: '',
    licenseExpiresAt: null,
    vaultApiBase: '',
    updateFeedUrl: 'https://raw.githubusercontent.com/rhashiki/lovable-decrypter-extension/main/updates/latest.json',
    lastVaultSyncAt: null
  },
  gemini: {
    apiKey: '',
    model: DEFAULT_FREE_MODEL,
    advancedModel: DEFAULT_FREE_ADVANCED_MODEL,
    maxOutputTokens: 32768,
    zeroCost: true,
    dynamicModels: true
  },
  github: {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    createBranch: false,
    createPr: false
  },
  supabase: {
    url: '',
    anonKey: '',
    projectRef: '',
    managementToken: ''
  },
  projectMappings: {},
  agent: {
    maxFiles: 18,
    maxContextBytes: 500000,
    rules: ''
  },
  ui: {
    theme: 'matrix',
    sounds: false,
    background: 'matrix'
  }
};

export function mergeSettings(saved = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...saved,
    auth: { ...DEFAULT_SETTINGS.auth, ...(saved.auth || {}) },
    gemini: { ...DEFAULT_SETTINGS.gemini, ...(saved.gemini || {}) },
    github: { ...DEFAULT_SETTINGS.github, ...(saved.github || {}) },
    supabase: { ...DEFAULT_SETTINGS.supabase, ...(saved.supabase || {}) },
    agent: { ...DEFAULT_SETTINGS.agent, ...(saved.agent || {}) },
    ui: { ...DEFAULT_SETTINGS.ui, ...(saved.ui || {}) },
    projectMappings: { ...(saved.projectMappings || {}) }
  };

  // ZERO COST continua obrigatório por padrão.
  if (merged.gemini.zeroCost !== false) {
    merged.gemini.zeroCost = true;
    if (!isVerifiedFreeModel(merged.gemini.model)) merged.gemini.model = DEFAULT_FREE_MODEL;
    if (!isVerifiedFreeModel(merged.gemini.advancedModel)) merged.gemini.advancedModel = DEFAULT_FREE_ADVANCED_MODEL;
  }
  // A branch de trabalho é persistente: um novo commit por comando, sem branch/PR por solicitação.
  merged.github.createBranch = false;
  merged.github.createPr = false;
  return merged;
}
