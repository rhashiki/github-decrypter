import { verifyLicenseKey } from '../security/license.js';

function compareVersions(a = '0', b = '0') {
  const A = String(a).split('.').map(x => Number(x) || 0), B = String(b).split('.').map(x => Number(x) || 0);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d;
  }
  return 0;
}
function b64urlText(value = '') {
  const s = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
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
  return payload;
}

export const DEFAULT_UPDATE_FEED_URL = 'https://raw.githubusercontent.com/rhashiki/lovable-decrypter-extension/main/updates/latest.json';

export async function checkUpdates({ currentVersion, updateFeedUrl = '' }) {
  let browser = null;
  try {
    if (chrome.runtime.requestUpdateCheck) browser = await chrome.runtime.requestUpdateCheck();
  } catch (_) {}
  const configuredFeed = String(updateFeedUrl || '').trim();
  const feed = configuredFeed || DEFAULT_UPDATE_FEED_URL;
  const browserAvailable = browser?.status === 'update_available';
  try {
    const res = await fetch(feed, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Não foi possível consultar o feed OTA (${res.status}).`);
    const release = await verifyReleaseEnvelope(await res.json());
    return {
      currentVersion,
      browser,
      feedConfigured: true,
      feedSource: configuredFeed ? 'custom' : 'github-default',
      available: browserAvailable || compareVersions(release.version, currentVersion) > 0,
      release
    };
  } catch (error) {
    if (browserAvailable) return { currentVersion, browser, feedConfigured: !!configuredFeed, feedSource: 'browser', available: true, release: null, feedError: error?.message || String(error) };
    return { currentVersion, browser, feedConfigured: !!configuredFeed, feedSource: configuredFeed ? 'custom' : 'github-default', available: false, release: null, feedError: error?.message || String(error) };
  }
}

export async function downloadUpdate(release) {
  if (!release?.download_url) throw new Error('Release sem URL de download.');
  const id = await chrome.downloads.download({
    url: release.download_url,
    filename: `Lovable-Decrypter-v${release.version}.zip`,
    saveAs: true
  });
  return { downloadId: id, version: release.version };
}
