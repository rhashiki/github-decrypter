import { VERSION, DEFAULT_UPDATE_FEED_URL } from '../settings/config.js';
import { getSettings } from '../storage/settings-store.js';
import { backupSettingsRemote } from '../security/vault.js';
import { checkUpdates, downloadUpdate, fetchSignedRelease } from '../updates/update-manager.js';

const STATE_KEY = 'ld2_update_recovery_v1';
const CHANNEL_KEY = 'ld2_update_channel_v1';
const UPDATE_REQUEST_KEY = 'ld2_auto_update_request';
const HEALTH_ALARM = 'ld2_post_update_health_timeout';
const CACHE_PREFIXES = ['ld2_repo_cache_index_v1_', 'ld2_repo_blob_v1_', 'ld2_pending_'];
const CHANNELS = new Set(['stable', 'beta']);

function nowIso() { return new Date().toISOString(); }
function channelOf(value) { const v = String(value || 'stable').toLowerCase(); return CHANNELS.has(v) ? v : 'stable'; }

async function readState() {
  const data = await chrome.storage.local.get([STATE_KEY, CHANNEL_KEY]);
  return {
    channel: channelOf(data[CHANNEL_KEY]),
    ...(data[STATE_KEY] && typeof data[STATE_KEY] === 'object' ? data[STATE_KEY] : {})
  };
}

async function patchState(patch = {}) {
  const current = await readState();
  const next = { ...current, ...patch, updatedAt: nowIso() };
  await chrome.storage.local.set({ [STATE_KEY]: next });
  return next;
}

async function setChannel(value) {
  const channel = channelOf(value);
  await chrome.storage.local.set({ [CHANNEL_KEY]: channel });
  await patchState({ channel });
  return channel;
}

async function clearDecrypterCaches() {
  const all = await chrome.storage.local.get(null);
  const removable = Object.keys(all).filter(key => CACHE_PREFIXES.some(prefix => key.startsWith(prefix)) || key === 'ld2_update_status');
  if (removable.length) await chrome.storage.local.remove(removable);
  let cacheStorage = 0;
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      const results = await Promise.all(names.map(name => caches.delete(name)));
      cacheStorage = results.filter(Boolean).length;
    }
  } catch (_) {}
  return { removedStorageKeys: removable.length, removedExtensionCaches: cacheStorage };
}

async function backupSettings() {
  const settings = await getSettings();
  if (!settings.auth?.licenseKey || !settings.auth?.vaultApiBase) return { attempted: false, ok: false, reason: 'vault_not_ready' };
  try {
    await backupSettingsRemote({ settings, licenseKey: settings.auth.licenseKey, vaultApiBase: settings.auth.vaultApiBase });
    return { attempted: true, ok: true };
  } catch (error) {
    return { attempted: true, ok: false, reason: error?.message || String(error) };
  }
}

async function signedCurrentRelease(channel) {
  const settings = await getSettings();
  try {
    const release = await fetchSignedRelease({ updateFeedUrl: settings.auth?.updateFeedUrl || DEFAULT_UPDATE_FEED_URL, channel, version: VERSION });
    return {
      version: release.version,
      channel: release.channel,
      download_url: release.download_url,
      sha256: release.sha256,
      notes: release.notes || ''
    };
  } catch (_) {
    return null;
  }
}

async function createRecoverySnapshot({ channel, candidate = null, tabId = null, mode = 'manual-package' } = {}) {
  const selected = channelOf(channel);
  const [vault, previousRelease] = await Promise.all([backupSettings(), signedCurrentRelease(selected)]);
  const snapshot = {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    previousVersion: VERSION,
    previousRelease,
    candidate: candidate ? {
      version: String(candidate.version || ''),
      channel: channelOf(candidate.channel || selected),
      sha256: String(candidate.sha256 || ''),
      download_url: String(candidate.download_url || '')
    } : null,
    channel: selected,
    tabId: Number.isInteger(tabId) ? tabId : null,
    mode,
    vaultBackup: vault
  };
  await patchState({ snapshot, postUpdateHealth: null, lastAction: 'snapshot_created' });
  return snapshot;
}

async function check(channel = null) {
  const state = await readState();
  const settings = await getSettings();
  const selected = channelOf(channel || state.channel);
  const status = await checkUpdates({ currentVersion: VERSION, updateFeedUrl: settings.auth?.updateFeedUrl || '', channel: selected });
  await patchState({ channel: selected, lastCheck: { ...status, checkedAt: nowIso() } });
  return status;
}

async function downloadCandidate(release, kind = 'update') {
  if (!release?.signature_verified && !release?.verification_token) throw new Error('Consulte novamente o feed assinado antes de baixar.');
  const result = await downloadUpdate(release, { filenamePrefix: kind === 'rollback' ? 'Lovable-Decrypter-ROLLBACK' : 'Lovable-Decrypter' });
  await patchState({ lastDownload: { ...result, kind, at: nowIso() }, lastAction: `${kind}_downloaded` });
  return result;
}

async function stageNativeApply(sender, channel = 'stable') {
  const selected = channelOf(channel);
  if (selected !== 'stable') throw new Error('O canal Beta usa pacote assinado manual; atualização nativa só é aceita no canal Stable.');
  const status = await check(selected);
  if (!status?.browser || status.browser.status !== 'update_available') {
    throw new Error('O navegador não possui uma atualização nativa pronta. Use o pacote assinado/verificado para esta instalação.');
  }
  const tabId = sender?.tab?.id ?? null;
  const snapshot = await createRecoverySnapshot({ channel: selected, candidate: status.release, tabId, mode: 'browser-native' });
  await chrome.storage.local.set({
    [UPDATE_REQUEST_KEY]: { autoApply: true, tabId, requestedAt: nowIso(), build14: true, snapshotId: snapshot.id }
  });
  const browser = await chrome.runtime.requestUpdateCheck();
  if (browser?.status !== 'update_available') {
    await chrome.storage.local.remove(UPDATE_REQUEST_KEY);
    throw new Error(`Atualização nativa não ficou disponível (${browser?.status || 'unknown'}).`);
  }
  await patchState({ lastAction: 'native_update_requested', nativeUpdate: { requestedAt: nowIso(), browser } });
  return { staged: true, mode: 'browser-native', browser, snapshot };
}

async function prepareRollback() {
  const state = await readState();
  const snapshot = state.snapshot;
  if (!snapshot?.previousVersion) throw new Error('Nenhum snapshot de versão anterior está disponível.');
  let release = snapshot.previousRelease || null;
  if (!release) {
    const settings = await getSettings();
    release = await fetchSignedRelease({
      updateFeedUrl: settings.auth?.updateFeedUrl || DEFAULT_UPDATE_FEED_URL,
      channel: snapshot.channel || 'stable',
      version: snapshot.previousVersion
    });
  } else {
    const settings = await getSettings();
    release = await fetchSignedRelease({
      updateFeedUrl: settings.auth?.updateFeedUrl || DEFAULT_UPDATE_FEED_URL,
      channel: release.channel || snapshot.channel || 'stable',
      version: release.version
    });
  }
  const download = await downloadCandidate(release, 'rollback');
  await patchState({ rollback: { version: release.version, channel: release.channel, sha256: release.sha256, downloadedAt: nowIso(), mode: 'manual-reinstall-required' }, lastAction: 'rollback_package_verified' });
  return { release, download, requiresManualInstall: true };
}

async function acceptHealthReport(report = {}, sender = {}) {
  const critical = ['uiShell', 'unifiedLauncher', 'composerGuardian', 'executionEngine'];
  const checks = report?.checks && typeof report.checks === 'object' ? report.checks : {};
  const failures = critical.filter(key => checks[key] !== true);
  const health = {
    status: failures.length ? 'failed' : 'healthy',
    version: VERSION,
    reportedAt: nowIso(),
    tabId: sender?.tab?.id ?? null,
    checks,
    failures,
    details: report?.details && typeof report.details === 'object' ? report.details : {}
  };
  await chrome.alarms.clear(HEALTH_ALARM).catch(() => {});
  await patchState({ postUpdateHealth: health, lastAction: failures.length ? 'health_failed' : 'health_healthy' });
  return health;
}

async function status() {
  const state = await readState();
  return { ...state, currentVersion: VERSION, rollbackMode: 'verified-package-manual-reinstall' };
}

export function installUpdateRecoveryRuntime() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = String(message?.type || '');
    if (!type.startsWith('LD2_RECOVERY_') && !type.startsWith('LD2_UPDATE_V2_')) return false;
    (async () => {
      try {
        let data;
        switch (type) {
          case 'LD2_RECOVERY_STATUS': data = await status(); break;
          case 'LD2_RECOVERY_HEALTH_REPORT': data = await acceptHealthReport(message.report || {}, sender); break;
          case 'LD2_RECOVERY_CLEAR_DECRYPTER_CACHE': data = await clearDecrypterCaches(); break;
          case 'LD2_UPDATE_V2_CHANNEL_SET': data = { channel: await setChannel(message.channel) }; break;
          case 'LD2_UPDATE_V2_CHECK': data = await check(message.channel); break;
          case 'LD2_UPDATE_V2_SNAPSHOT': data = await createRecoverySnapshot({ channel: message.channel, candidate: message.release || null, tabId: sender?.tab?.id ?? null, mode: message.mode || 'manual-package' }); break;
          case 'LD2_UPDATE_V2_DOWNLOAD': {
            await createRecoverySnapshot({ channel: message.release?.channel || message.channel || 'stable', candidate: message.release || null, tabId: sender?.tab?.id ?? null, mode: 'manual-package' });
            data = await downloadCandidate(message.release, 'update');
            break;
          }
          case 'LD2_UPDATE_V2_NATIVE_APPLY': data = await stageNativeApply(sender, message.channel || 'stable'); break;
          case 'LD2_UPDATE_V2_ROLLBACK_DOWNLOAD': data = await prepareRollback(); break;
          default: throw new Error('Ação de Update & Recovery desconhecida.');
        }
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  });

  chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    if (reason !== 'update') return;
    await patchState({
      postUpdateHealth: { status: 'pending', version: VERSION, previousVersion: previousVersion || null, startedAt: nowIso(), checks: {}, failures: [] },
      lastAction: 'awaiting_post_update_health'
    });
    chrome.alarms.create(HEALTH_ALARM, { delayInMinutes: 2 });
  });

  chrome.alarms.onAlarm.addListener(async alarm => {
    if (alarm.name !== HEALTH_ALARM) return;
    const state = await readState();
    if (state.postUpdateHealth?.status !== 'pending') return;
    await patchState({
      postUpdateHealth: { ...state.postUpdateHealth, status: 'failed', timedOutAt: nowIso(), failures: ['content_health_report_timeout'] },
      lastAction: 'health_timeout'
    });
  });
}
