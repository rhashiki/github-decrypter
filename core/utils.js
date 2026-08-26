export const textDecoder = new TextDecoder();
export const textEncoder = new TextEncoder();

export function encodeBase64Utf8(str) {
  const bytes = textEncoder.encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function decodeBase64Utf8(b64) {
  const bin = atob((b64 || '').replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return textDecoder.decode(bytes);
}

export function assertSafeRepoPath(path) {
  if (!path || typeof path !== 'string') throw new Error('Caminho de arquivo inválido.');
  const p = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || p.includes('../') || p.startsWith('.git/') || p === '.git') {
    throw new Error(`Caminho não permitido: ${path}`);
  }
  return p;
}

export function slugify(value, max = 42) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, max) || 'change';
}

export function parseRepoInput(input) {
  const raw = String(input || '').trim().replace(/\.git$/, '');
  const m = raw.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i) || raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function isSensitivePath(path) {
  const p = String(path || '').replace(/\\/g, '/');
  if (/(^|\/)\.env($|\.)/i.test(p) && !/\.env\.(example|sample|template)$/i.test(p)) return true;
  if (/(^|\/)(secrets?|credentials?|private[-_]?keys?|service[-_]?account)(\/|\.|$)/i.test(p)) return true;
  if (/\.(pem|key|p12|pfx|jks|keystore|crt|cer)$/i.test(p)) return true;
  return false;
}

export function isTextPath(path) {
  const p = String(path || '').replace(/\\/g, '/');
  if (/\.env\.(example|sample|template)$/i.test(p)) return true;
  if (isSensitivePath(p)) return false;
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp4|mp3|wav|mov|avi|bin|lock)$/i.test(path)) return false;
  if (/(^|\/)(node_modules|dist|build|\.git|coverage|\.next|\.turbo)(\/|$)/i.test(path)) return false;
  return /(^|\.)((tsx?|jsx?|mjs|cjs|json|css|scss|sass|less|html?|mdx?|sql|toml|ya?ml|env|txt|svg|xml|sh|py|go|rs|java|kt|properties|prisma|graphql))$/i.test(path) || !/\.[a-z0-9]{1,8}$/i.test(path);
}

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
export function nowIso() { return new Date().toISOString(); }

export function redactSettings(settings) {
  const clone = structuredClone(settings);
  if (clone?.gemini?.apiKey) clone.gemini.apiKey = '••••••••';
  if (clone?.github?.token) clone.github.token = '••••••••';
  if (clone?.supabase?.anonKey) clone.supabase.anonKey = '••••••••';
  if (clone?.supabase?.managementToken) clone.supabase.managementToken = '••••••••';
  return clone;
}
