import { verifyLicenseKey } from '../security/license.js';

const VERIFIED_RELEASE_TOKENS = new Map();
const VERIFIED_RELEASE_TTL_MS = 10 * 60 * 1000;
const MAX_RELEASE_BYTES = 20 * 1024 * 1024;
const CHANNELS = new Set(['stable', 'beta']);

export function compareVersions(a = '0', b = '0') {
  const A = String(a).split('.').map(x => Number(x) || 0), B = String(b).split('.').map(x => Number(x) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
}

function normalizeChannel(value = 'stable') {
  const channel = String(value || 'stable').toLowerCase();
  if (!CHANNELS.has(channel)) throw new Error('Canal de atualização inválido.');
  return channel;
}

function assertHttpsUrl(value = '', label = 'URL') {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new Error(`${label} inválida.`); }
  if (url.protocol !== 'https:') throw new Error(`${label} deve usar HTTPS.`);
  return url.toString();
}

function pruneVerificationTokens(now = Date.now()) {
  for (const [token, entry] of VERIFIED_RELEASE_TOKENS.entries()) {
    if (!entry || entry.expiresAt <= now) VERIFIED_RELEASE_TOKENS.delete(token);
  }
}

function rememberVerifiedRelease(payload) {
  pruneVerificationTokens();
  const token = crypto.randomUUID();
  const downloadUrl = assertHttpsUrl(payload.download_url, 'URL de download da release');
  const sha256 = String(payload.sha256 || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Release assinada não contém SHA-256 válido.');
  const channel = normalizeChannel(payload.channel || 'stable');
  VERIFIED_RELEASE_TOKENS.set(token, {
    version: String(payload.version || ''),
    downloadUrl,
    sha256,
    channel,
    expiresAt: Date.now() + VERIFIED_RELEASE_TTL_MS
  });
  return { ...payload, channel, sha256, download_url: downloadUrl, verification_token: token, signature_verified: true };
}

// A release feed is signed with the same owner signing key used for licenses.
// Envelope: { payload: <base64url JSON>, signature: <base64url P1363> }
async function verifyReleaseEnvelope(envelope) {
  if (!envelope?.payload || !envelope?.signature) throw new Error('Feed de atualização inválido.');
  const auth = await verifyLicenseKey(`LD2.${envelope.payload}.${envelope.signature}`);
  const payload = auth.payload;
  if (payload.type !== 'release' || !payload.version || !payload.download_url || !payload.sha256) throw new Error('Manifesto de atualização assinado é inválido.');
  return rememberVerifiedRelease(payload);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) out += String.fromCharCode(...view.subarray(i, i + chunk));
  return btoa(out);
}

export const DEFAULT_UPDATE_FEED_URL = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-release-feed';

export async function fetchSignedRelease({ updateFeedUrl = '', channel = 'stable', version = '' } = {}) {
  const configuredFeed = String(updateFeedUrl || '').trim();
  const feed = new URL(assertHttpsUrl(configuredFeed || DEFAULT_UPDATE_FEED_URL, 'Feed de atualização'));
  const selectedChannel = normalizeChannel(channel);
  feed.searchParams.set('channel', selectedChannel);
  if (String(version || '').trim()) feed.searchParams.set('version', String(version).trim());
  const res = await fetch(feed.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Não foi possível consultar o feed OTA (${res.status}).`);
  const release = await verifyReleaseEnvelope(await res.json());
  if (release.channel !== selectedChannel) throw new Error(`O feed retornou canal ${release.channel}, mas ${selectedChannel} foi solicitado.`);
  if (version && release.version !== String(version)) throw new Error(`O feed retornou ${release.version}, mas ${version} foi solicitado.`);
  return release;
}

export async function checkUpdates({ currentVersion, updateFeedUrl = '', channel = 'stable' }) {
  const selectedChannel = normalizeChannel(channel);
  let browser = null;
  try {
    if (chrome.runtime.requestUpdateCheck && selectedChannel === 'stable') browser = await chrome.runtime.requestUpdateCheck();
  } catch (_) {}
  const browserAvailable = browser?.status === 'update_available';
  try {
    const release = await fetchSignedRelease({ updateFeedUrl, channel: selectedChannel });
    return {
      currentVersion,
      channel: selectedChannel,
      browser,
      feedConfigured: true,
      feedSource: updateFeedUrl ? 'custom' : 'supabase-default',
      signatureVerified: true,
      available: browserAvailable || compareVersions(release.version, currentVersion) > 0,
      release
    };
  } catch (error) {
    if (browserAvailable) return { currentVersion, channel: selectedChannel, browser, feedConfigured: !!updateFeedUrl, feedSource: 'browser', available: true, release: null, signatureVerified: false, feedError: error?.message || String(error) };
    return { currentVersion, channel: selectedChannel, browser, feedConfigured: !!updateFeedUrl, feedSource: updateFeedUrl ? 'custom' : 'supabase-default', available: false, release: null, signatureVerified: false, feedError: error?.message || String(error) };
  }
}

export async function downloadUpdate(release, { filenamePrefix = 'Lovable-Decrypter' } = {}) {
  pruneVerificationTokens();
  const token = String(release?.verification_token || '');
  const verified = token ? VERIFIED_RELEASE_TOKENS.get(token) : null;
  const version = String(release?.version || '');
  const downloadUrl = assertHttpsUrl(release?.download_url || '', 'URL de download da release');
  const expectedSha256 = String(release?.sha256 || '').toLowerCase();
  if (!verified || verified.version !== version || verified.downloadUrl !== downloadUrl || verified.sha256 !== expectedSha256) {
    throw new Error('Release não verificada ou alterada. Consulte novamente o feed OTA assinado antes de baixar.');
  }

  const res = await fetch(downloadUrl, { cache: 'no-store', redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha ao baixar pacote assinado (${res.status}).`);
  const declaredLength = Number(res.headers.get('content-length') || 0);
  if (declaredLength > MAX_RELEASE_BYTES) throw new Error('Pacote de atualização excede o limite de segurança de 20 MB.');
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_RELEASE_BYTES) throw new Error('Pacote de atualização vazio ou grande demais.');
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== expectedSha256) {
    VERIFIED_RELEASE_TOKENS.delete(token);
    throw new Error(`SHA-256 do pacote não confere. Esperado ${expectedSha256}, recebido ${actualSha256}.`);
  }

  VERIFIED_RELEASE_TOKENS.delete(token);
  const dataUrl = `data:application/zip;base64,${bytesToBase64(bytes)}`;
  const id = await chrome.downloads.download({
    url: dataUrl,
    filename: `${filenamePrefix}-v${version}-${verified.channel}.zip`,
    saveAs: true
  });
  return { downloadId: id, version, channel: verified.channel, sha256: actualSha256, bytes: bytes.byteLength, verified: true };
}
