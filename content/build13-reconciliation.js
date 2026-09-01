(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_BUILD13_RECONCILIATION__) return;
  window.__LOVABLE_DECRYPTER_BUILD13_RECONCILIATION__ = true;

  const root = () => document.getElementById('ld2-root');

  function modules() {
    return Object.freeze({
      build: 13,
      version: chrome.runtime.getManifest().version,
      unifiedLauncher: !!window.__LOVABLE_DECRYPTER_UNIFIED_LAUNCHER__,
      liveOperations: !!window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__,
      activityCenter: !!window.__LOVABLE_DECRYPTER_ACTIVITY_CENTER__,
      composerGuardian: !!window.__LOVABLE_DECRYPTER_COMPOSER_GUARDIAN__,
      queue: !!window.__LOVABLE_DECRYPTER_QUEUE_EXECUTOR__,
      projectIntelligence: !!window.__LOVABLE_DECRYPTER_PROJECT_INTELLIGENCE__,
      rag: false
    });
  }

  function reconcile() {
    const r = root();
    if (!r) return false;
    r.dataset.ld2Build = '13';
    r.dataset.ld2LiveOperations = window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__ ? 'active' : 'inactive';
    const card = r.querySelector('[data-activity-open]');
    if (card) {
      card.dataset.ld2Operational = window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__ ? '1' : '0';
      card.title = window.__LOVABLE_DECRYPTER_LIVE_OPERATIONS__
        ? 'Activity Center registra somente eventos reais observados pelo runtime.'
        : 'Live Operations não carregou.';
    }
    return !!(r.querySelector('.ld2-unified-shell') && card);
  }

  function snapshot() {
    const activity = window.LovableDecrypterLiveOperations?.snapshot?.() || { active: [], history: [], count: 0, ragActive: false };
    return Object.freeze({ modules: modules(), activity });
  }

  window.LovableDecrypterBuild13 = Object.freeze({ modules, snapshot, reconcile, build: 13 });
  window.addEventListener('ld2:activity-history', reconcile);
  window.addEventListener('ld2:unified-launcher-ready', reconcile);
  window.addEventListener('ld2:ui-mounted', reconcile);

  let attempts = 0;
  const bounded = () => {
    if (reconcile()) return;
    if (++attempts < 36) setTimeout(bounded, 100 + attempts * 25);
  };
  bounded();
})();
