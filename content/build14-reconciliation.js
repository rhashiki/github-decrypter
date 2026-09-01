(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD14_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD14_RECONCILIATION__ = true;

  const ROOT_ID = 'ld2-root';
  const VERSION = chrome.runtime.getManifest().version;

  function visibleFab() {
    const fab = document.querySelector(`#${ROOT_ID} .ld2-fab`);
    if (!fab?.isConnected) return false;
    const rect = fab.getBoundingClientRect();
    const style = getComputedStyle(fab);
    return rect.width > 20 && rect.height > 20 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function checks() {
    return {
      uiShell: !!window.__LOVABLE_DECRYPTER_UI_SHELL_BOOTSTRAP__ && visibleFab(),
      unifiedLauncher: !!window.__LOVABLE_DECRYPTER_UNIFIED_LAUNCHER__ && !!document.querySelector(`#${ROOT_ID} .ld2-unified-shell`),
      composerGuardian: !!window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__ && !!window.LovableDecrypterComposerGuardian,
      executionEngine: !!window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__ && !!window.LovableDecrypterBuild10,
      liveOperations: !!window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__,
      activityCenter: !!window.__LOVABLE_DECRYPTER_ACTIVITY_CENTER__,
      updateRecovery: !!window.__LOVABLE_DECRYPTER_UPDATE_RECOVERY_UI__
    };
  }

  function reconcileLauncher() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    root.dataset.ld2Build = '14';
    const repair = root.querySelector('.ld2-unified-shell [data-ul-action="repair"]');
    if (repair) {
      repair.classList.remove('future');
      repair.removeAttribute('data-ul-future');
      const badge = repair.querySelector('[data-ul-badge="repair"]');
      if (badge) {
        badge.textContent = 'ATIVO';
        badge.dataset.state = 'good';
      }
    }
    const update = root.querySelector('.ld2-unified-shell [data-ul-action="update"]');
    if (update && !update.querySelector('[data-ul-b14-badge]')) {
      const badge = document.createElement('em');
      badge.dataset.ulB14Badge = '1';
      badge.dataset.state = 'good';
      badge.textContent = 'SIGNED';
      update.appendChild(badge);
    }
    return !!repair && !!update;
  }

  function sendHealthReport(force = false) {
    const current = checks();
    const criticalReady = current.uiShell && current.unifiedLauncher && current.composerGuardian && current.executionEngine;
    if (!criticalReady && !force) return false;
    chrome.runtime.sendMessage({
      type: 'LD2_RECOVERY_HEALTH_REPORT',
      report: {
        checks: current,
        details: {
          version: VERSION,
          url: location.href,
          guardian: window.LovableDecrypterComposerGuardian?.snapshot?.() || null
        }
      }
    }, () => void chrome.runtime.lastError);
    window.dispatchEvent(new CustomEvent('ld2:build14-health-reported', { detail: { checks: current, version: VERSION } }));
    return criticalReady;
  }

  window.LovableDecrypterBuild14 = Object.freeze({ checks, reconcile: reconcileLauncher, reportHealth: () => sendHealthReport(true), build: 14 });

  window.addEventListener('ld2:unified-launcher-ready', reconcileLauncher);
  window.addEventListener('ld2:ui-mounted', reconcileLauncher);

  let attempts = 0;
  const bounded = () => {
    reconcileLauncher();
    if (sendHealthReport(false)) return;
    attempts += 1;
    if (attempts < 36) setTimeout(bounded, 100 + attempts * 35);
    else sendHealthReport(true);
  };
  bounded();
})();
