export const VERSION = '2.4.26';
export const TRUST_PROTOCOL_VERSION = '2.4.21';
export const STORAGE_KEY = 'ld2_settings';
export const HISTORY_KEY = 'ld2_history';
export const DEFAULT_BACKEND_BASE = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1';
export const DEFAULT_VAULT_API_BASE = `${DEFAULT_BACKEND_BASE}/ld-vault`;
export const DEFAULT_UPDATE_FEED_URL = `${DEFAULT_BACKEND_BASE}/ld-release-feed`;
export const STORE_URL = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-store';

// Free Tier verificado na documentação oficial da Gemini Developer API.
// O Model Gateway ainda reaplica a allowlist no backend; esta lista cliente não é autoridade final.
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
export const DECRYPTER_LOCAL_PROVIDER_ID = 'decrypter-local';
export const DECRYPTER_LOCAL_RECOMMENDED_MODEL = 'Qwen/Qwen3-Coder-30B-A3B-Instruct';

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
    backendBase: DEFAULT_BACKEND_BASE,
    deviceId: '',
    vaultApiBase: DEFAULT_VAULT_API_BASE,
    updateFeedUrl: DEFAULT_UPDATE_FEED_URL,
    lastVaultSyncAt: null
  },
  gateway: {
    mode: 'auto'
  },
  gemini: {
    apiKey: '',
    model: DEFAULT_FREE_MODEL,
    advancedModel: DEFAULT_FREE_ADVANCED_MODEL,
    maxOutputTokens: 32768,
    billingMode: 'free',
    zeroCost: true,
    dynamicModels: true
  },
  github: {
    authMode: 'github_app',
    installationId: null,
    accountLogin: '',
    appSlug: '',
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    createBranch: false,
    createPr: false
  },
  supabase: {
    authMode: 'oauth',
    projectRef: '',
    projectName: '',
    organizationSlug: '',
    url: '',
    anonKey: '',
    managementToken: ''
  },
  projectMappings: {},
  supabaseMappings: {},
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
    gateway: { ...DEFAULT_SETTINGS.gateway, ...(saved.gateway || {}) },
    gemini: { ...DEFAULT_SETTINGS.gemini, ...(saved.gemini || {}) },
    github: { ...DEFAULT_SETTINGS.github, ...(saved.github || {}) },
    supabase: { ...DEFAULT_SETTINGS.supabase, ...(saved.supabase || {}) },
    agent: { ...DEFAULT_SETTINGS.agent, ...(saved.agent || {}) },
    ui: { ...DEFAULT_SETTINGS.ui, ...(saved.ui || {}) },
    projectMappings: { ...(saved.projectMappings || {}) },
    supabaseMappings: { ...(saved.supabaseMappings || {}) }
  };

  if (!merged.auth.updateFeedUrl || /raw\.githubusercontent\.com\/rhashiki\/lovable-decrypter-extension\/main\/updates\/latest\.json/i.test(String(merged.auth.updateFeedUrl))) {
    merged.auth.updateFeedUrl = DEFAULT_UPDATE_FEED_URL;
  }

  merged.gateway.mode = ['auto', 'fast', 'deep'].includes(String(merged.gateway.mode || '').toLowerCase())
    ? String(merged.gateway.mode).toLowerCase()
    : 'auto';

  // Gratuito é o padrão. O modo pago só é habilitado por opt-in explícito e usa a API do próprio usuário.
  // Quando o Gateway escolhe Decrypter Local, nenhuma chave Gemini é necessária para aquela execução.
  merged.gemini.billingMode = merged.gemini.billingMode === 'user_paid' ? 'user_paid' : 'free';
  merged.gemini.zeroCost = merged.gemini.billingMode !== 'user_paid';
  if (merged.gemini.zeroCost) {
    if (!isVerifiedFreeModel(merged.gemini.model)) merged.gemini.model = DEFAULT_FREE_MODEL;
    if (!isVerifiedFreeModel(merged.gemini.advancedModel)) merged.gemini.advancedModel = DEFAULT_FREE_ADVANCED_MODEL;
  }

  // GitHub App é o caminho normal. PAT só sobrevive quando explicitamente marcado como legado.
  merged.github.authMode = merged.github.authMode === 'legacy_token' ? 'legacy_token' : 'github_app';
  merged.github.installationId = Number.isInteger(Number(merged.github.installationId)) && Number(merged.github.installationId) > 0
    ? Number(merged.github.installationId)
    : null;
  if (merged.github.authMode !== 'legacy_token') merged.github.token = '';

  // Supabase usa OAuth oficial pelo backend. Credenciais administrativas legadas nunca permanecem no cliente.
  merged.supabase.authMode = 'oauth';
  merged.supabase.anonKey = '';
  merged.supabase.managementToken = '';

  // Um novo commit por comando na branch selecionada, sem branch/PR automático.
  merged.github.createBranch = false;
  merged.github.createPr = false;
  return merged;
}
