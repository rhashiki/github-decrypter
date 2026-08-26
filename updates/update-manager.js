import { verifyLicenseKey } from '../security/license.js';

const VERIFIED_RELEASE_TOKENS = new Map();
const VERIFIED_RELEASE_TTL_MS = 10 * 60 * 1000;

function compareVersions(a = '0', b = '0') {
  const A = String(a).split('.').map(x => Number(x) || 0), B = String(b).split('.').map(x => Number(x) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
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
  VERIFIED_RELEASE_TOKENS.set(token, {
    version: String(payload.version || ''),
    downloadUrl,
    expiresAt: Date.now() + VERIFIED_RELEASE_TTL_MS
  });
  return { ...payload, download_url: downloadUrl, verification_token: token };
}

// A release feed is signed with the same owner signing key used for licenses.
// Envelope: { payload: <base64url JSON>, signature: <base64url P1363> }
async function verifyReleaseEnvelope(envelope) {
  if (!envelope?.payload || !envelope?.signature) throw new Error('Feed de atualização inválido.');
  // Reuse the license verifier by wrapping the release payload in a temporary LD2 token.
  // The payload itself must use the license audience/version plus type:'release'.
  const auth = await verifyLicenseKey(`LD2.${envelope.payload}.${envelope.signature}`);
  const payload = auth.payload;
  if (payload.type !== 'release' || !payload.version || !payload.download_url) throw new Error('Manifesto de atualização assinado é inválido.');
  return rememberVerifiedRelease(payload);
}

export const DEFAULT_UPDATE_FEED_URL = 'https://kkzxxnfxgrouhkzyszxs.supabase.co/functions/v1/ld-release-feed';

export async function checkUpdates({ currentVersion, updateFeedUrl = '' }) {
  let browser = null;
  try {
    if (chrome.runtime.requestUpdateCheck) browser = await chrome.runtime.requestUpdateCheck();
  } catch (_) {}
  const configuredFeed = String(updateFeedUrl || '').trim();
  const feed = assertHttpsUrl(configuredFeed || DEFAULT_UPDATE_FEED_URL, 'Feed de atualização');
  const browserAvailable = browser?.status === 'update_available';
  try {
    const res = await fetch(feed, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Não foi possível consultar o feed OTA (${res.status}).`);
    const release = await verifyReleaseEnvelope(await res.json());
    return {
      currentVersion,
      browser,
      feedConfigured: true,
      feedSource: configuredFeed ? 'custom' : 'supabase-default',
      available: browserAvailable || compareVersions(release.version, currentVersion) > 0,
      release
    };
  } catch (error) {
    if (browserAvailable) return { currentVersion, browser, feedConfigured: !!configuredFeed, feedSource: 'browser', available: true, release: null, feedError: error?.message || String(error) };
    return { currentVersion, browser, feedConfigured: !!configuredFeed, feedSource: configuredFeed ? 'custom' : 'supabase-default', available: false, release: null, feedError: error?.message || String(error) };
  }
}

export async function downloadUpdate(release) {
  pruneVerificationTokens();
  const token = String(release?.verification_token || '');
  const verified = token ? VERIFIED_RELEASE_TOKENS.get(token) : null;
  const version = String(release?.version || '');
  const downloadUrl = assertHttpsUrl(release?.download_url || '', 'URL de download da release');
  if (!verified || verified.version !== version || verified.downloadUrl !== downloadUrl) {
    throw new Error('Release não verificada ou alterada. Consulte novamente o feed OTA assinado antes de baixar.');
  }
  VERIFIED_RELEASE_TOKENS.delete(token);
  const id = await chrome.downloads.download({
    url: downloadUrl,
    filename: `Lovable-Decrypter-v${version}.zip`,
    saveAs: true
  });
  return { downloadId: id, version };
}
