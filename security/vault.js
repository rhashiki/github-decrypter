function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(value = '') {
  const s = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(s);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function deriveKey(licenseKey, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(licenseKey), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
function cleanBase(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw new Error('Vault API inválida.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('Vault API deve usar HTTPS em um domínio *.supabase.co.');
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/+$/, '');
}
function backupPayload(settings = {}) {
  const copy = structuredClone(settings || {});
  if (copy.auth) {
    delete copy.auth.licenseKey;
    delete copy.auth.licenseStatus;
    delete copy.auth.lastVaultSyncAt;
  }
  return copy;
}
export async function encryptSettings(settings, licenseKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(licenseKey, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(backupPayload(settings)));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return { v: 1, alg: 'PBKDF2-SHA256/AES-256-GCM', salt: b64url(salt), iv: b64url(iv), data: b64url(encrypted), saved_at: new Date().toISOString() };
}
export async function decryptSettings(blob, licenseKey) {
  if (!blob || Number(blob.v) !== 1) throw new Error('Backup remoto incompatível.');
  const salt = fromB64url(blob.salt), iv = fromB64url(blob.iv), data = fromB64url(blob.data);
  const key = await deriveKey(licenseKey, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
export async function backupSettingsRemote({ settings, licenseKey, vaultApiBase }) {
  const base = cleanBase(vaultApiBase);
  if (!base) return { configured: false, synced: false, reason: 'vault_not_configured' };
  const blob = await encryptSettings(settings, licenseKey);
  const res = await fetch(`${base}/v1/vault`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${licenseKey}` },
    body: JSON.stringify({ blob })
  });
  if (!res.ok) throw new Error(`Vault remoto recusou o backup (${res.status}).`);
  return { configured: true, synced: true, at: blob.saved_at };
}
export async function restoreSettingsRemote({ licenseKey, vaultApiBase }) {
  const base = cleanBase(vaultApiBase);
  if (!base) return { configured: false, restored: false, reason: 'vault_not_configured' };
  const res = await fetch(`${base}/v1/vault`, { headers: { 'authorization': `Bearer ${licenseKey}` } });
  if (res.status === 404) return { configured: true, restored: false, reason: 'not_found' };
  if (!res.ok) throw new Error(`Vault remoto recusou a restauração (${res.status}).`);
  const body = await res.json();
  if (!body?.blob) return { configured: true, restored: false, reason: 'empty' };
  return { configured: true, restored: true, settings: await decryptSettings(body.blob, licenseKey), savedAt: body.blob.saved_at || null };
}
