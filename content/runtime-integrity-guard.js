(() => {
  'use strict';
  if (window.__LD44_RUNTIME_INTEGRITY_GUARD__) return;
  window.__LD44_RUNTIME_INTEGRITY_GUARD__ = true;

  const BUILD = 44;
  const captured = Object.freeze({
    runtimeId: String(chrome?.runtime?.id || ''),
    fetch: typeof globalThis.fetch === 'function' ? globalThis.fetch : null,
    xhrOpen: typeof globalThis.XMLHttpRequest?.prototype?.open === 'function' ? globalThis.XMLHttpRequest.prototype.open : null,
    xhrSend: typeof globalThis.XMLHttpRequest?.prototype?.send === 'function' ? globalThis.XMLHttpRequest.prototype.send : null,
    sendBeacon: typeof navigator?.sendBeacon === 'function' ? navigator.sendBeacon : null
  });

  let last = null;

  function check(id, ok, reason, critical = true) {
    return Object.freeze({
      id,
      ok: ok === true,
      critical: critical === true,
      reason: String(reason || '').slice(0, 180)
    });
  }

  function stablePrimitive(current, original) {
    if (original === null) return current == null;
    return current === original;
  }

  function collect() {
    const early = window.LovableDecrypterEarlyBoot;
    const credentials = window.LovableDecrypterCredentialGuard;
    const core = window.LovableDecrypterHardeningCore;
    let earlySnapshot = null;
    try { earlySnapshot = early?.snapshot?.() || null; } catch (_) {}

    return Object.freeze([
      check('extension.runtime_id', !!captured.runtimeId && String(chrome?.runtime?.id || '') === captured.runtimeId, 'Chrome runtime identity must remain stable.'),
      check('boot.early_sentinel', Number(early?.build || 0) >= 34 && typeof early?.snapshot === 'function', 'Document-start sentinel must be present.'),
      check('boot.top_scope', earlySnapshot?.scope === 'top', 'Heavy runtime must execute only in the top Lovable frame.'),
      check('credentials.sentinel_guard', credentials?.sentinel === '__LD2_SAVED_CREDENTIAL__' && typeof credentials?.prepareMessage === 'function', 'Credential materialization must stay behind the isolated sentinel guard.'),
      check('hardening.core', typeof core?.evaluateHardening === 'function' && typeof core?.shouldBlockNativeIntent === 'function', 'Fail-closed hardening core must be available.'),
      check('network.fetch_identity', stablePrimitive(typeof globalThis.fetch === 'function' ? globalThis.fetch : null, captured.fetch), 'Global fetch identity changed after integrity baseline.'),
      check('network.xhr_open_identity', stablePrimitive(typeof globalThis.XMLHttpRequest?.prototype?.open === 'function' ? globalThis.XMLHttpRequest.prototype.open : null, captured.xhrOpen), 'XMLHttpRequest.open identity changed after integrity baseline.'),
      check('network.xhr_send_identity', stablePrimitive(typeof globalThis.XMLHttpRequest?.prototype?.send === 'function' ? globalThis.XMLHttpRequest.prototype.send : null, captured.xhrSend), 'XMLHttpRequest.send identity changed after integrity baseline.'),
      check('network.beacon_identity', stablePrimitive(typeof navigator?.sendBeacon === 'function' ? navigator.sendBeacon : null, captured.sendBeacon), 'navigator.sendBeacon identity changed after integrity baseline.')
    ]);
  }

  function snapshot(reason = 'manual') {
    const checks = collect();
    const failed = checks.filter(item => item.critical && !item.ok);
    return Object.freeze({
      schema: 'ld-runtime-integrity/1',
      build: BUILD,
      status: failed.length ? 'broken' : 'ready',
      reason: String(reason || 'manual').slice(0, 80),
      checkedAt: Date.now(),
      failed: Object.freeze(failed.map(item => item.id)),
      checks
    });
  }

  function verify(reason = 'manual') {
    const next = snapshot(reason);
    const changed = !last || last.status !== next.status || last.failed.join('|') !== next.failed.join('|');
    last = next;
    if (changed) window.dispatchEvent(new CustomEvent('ld2:runtime-integrity', { detail: next }));
    return next;
  }

  window.LovableDecrypterIntegrity = Object.freeze({
    build: BUILD,
    schema: 'ld-runtime-integrity/1',
    verify,
    snapshot: () => last || snapshot('snapshot')
  });

  verify('boot');
})();
