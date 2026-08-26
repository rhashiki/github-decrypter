(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_PREVIEW_PROGRESS__) return;
  window.__LOVABLE_DECRYPTER_PREVIEW_PROGRESS__ = true;

  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;

  const previousRuntime = api.runtime.bind(api);
  const BUILD_TYPES = new Set(['LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE', 'LD2_PLAN_APPLY']);
  const OVERLAY_ID = 'ld2-preview-progress-overlay';
  const STALL_MS = 30000;
  const frameListeners = new WeakSet();

  let active = null;
  let overlay = null;
  let layoutScheduled = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const visible = el => {
    if (!el?.isConnected || el.closest?.('#ld2-root') || el.closest?.(`#${OVERLAY_ID}`)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 260 && r.height >= 160 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };

  function candidateText(el) {
    return [
      el?.tagName,
      el?.id,
      el?.className,
      el?.getAttribute?.('title'),
      el?.getAttribute?.('aria-label'),
      el?.getAttribute?.('data-testid'),
      el?.getAttribute?.('data-test'),
      el?.getAttribute?.('name'),
      el?.getAttribute?.('src')
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function scoreCandidate(el) {
    if (!visible(el)) return -1;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const text = candidateText(el);
    let score = 0;

    if (el.tagName === 'IFRAME') score += 48;
    if (/preview|pre-?view|canvas|sandbox|lovable\.app|project-preview/.test(text)) score += 38;
    if (/iframe|app-frame|render/.test(text)) score += 12;
    if (r.left + r.width / 2 >= innerWidth * 0.5) score += 18;
    if (area / viewportArea >= 0.18) score += 18;
    if (area / viewportArea >= 0.32) score += 10;
    if (r.height >= innerHeight * 0.5) score += 8;
    if (r.width >= innerWidth * 0.38) score += 8;
    if (r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9) score -= 35;
    return score;
  }

  function previewCandidates() {
    const selectors = [
      'iframe',
      '[data-testid*="preview" i]',
      '[data-test*="preview" i]',
      '[aria-label*="preview" i]',
      '[title*="preview" i]',
      '[class*="preview" i]',
      '[id*="preview" i]'
    ];
    const seen = new Set();
    const out = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const score = scoreCandidate(el);
        if (score >= 35) out.push({ el, score, rect: el.getBoundingClientRect() });
      }
    }
    return out.sort((a, b) => b.score - a.score || (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  }

  function bestPreview() {
    return previewCandidates()[0] || null;
  }

  function fallbackRect() {
    const bridge = [...document.querySelectorAll('.ld2-native-bridge')]
      .filter(el => el.isConnected && el.getBoundingClientRect().height > 0)
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const bridgeTop = bridge?.getBoundingClientRect().top || innerHeight - 78;
    const top = 54;
    const bottom = Math.max(top + 220, Math.min(innerHeight - 18, bridgeTop - 8));

    if (innerWidth >= 900) {
      const left = Math.round(innerWidth * 0.44);
      return { left, top, width: innerWidth - left, height: bottom - top };
    }
    return { left: 0, top, width: innerWidth, height: bottom - top };
  }

  function previewRect() {
    const best = bestPreview();
    if (!best) return fallbackRect();
    const r = best.rect;
    const left = clamp(r.left, 0, innerWidth);
    const top = clamp(r.top, 0, innerHeight);
    const right = clamp(r.right, 0, innerWidth);
    const bottom = clamp(r.bottom, 0, innerHeight);
    if (right - left < 240 || bottom - top < 160) return fallbackRect();
    return { left, top, width: right - left, height: bottom - top };
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="ld2-preview-progress-card">
        <div class="ld2-preview-loader" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="ld2-preview-progress-copy">
          <strong>aguarde enquanto atualizamos a pré visualização do seu projeto...</strong>
          <small data-ld2-preview-phase>Preparando execução…</small>
        </div>
        <div class="ld2-preview-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="ld2-preview-progress-fill"></div>
        </div>
        <div class="ld2-preview-progress-meta"><span data-ld2-preview-status>Iniciando</span><b data-ld2-preview-percent>0%</b></div>
        <button type="button" class="ld2-preview-progress-release" data-ld2-preview-release hidden>Liberar preview</button>
      </div>`;
    overlay.querySelector('[data-ld2-preview-release]').addEventListener('click', () => releaseWithoutConfirmation());
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function scheduleLayout() {
    if (!active || layoutScheduled) return;
    layoutScheduled = true;
    requestAnimationFrame(() => {
      layoutScheduled = false;
      if (!active) return;
      const el = ensureOverlay();
      const r = previewRect();
      Object.assign(el.style, {
        left: `${Math.round(r.left)}px`,
        top: `${Math.round(r.top)}px`,
        width: `${Math.round(r.width)}px`,
        height: `${Math.round(r.height)}px`
      });
    });
  }

  function setProgress(value, label = '', detail = '') {
    if (!active) return;
    const next = clamp(Math.round(Number(value) || 0), 0, 100);
    active.progress = Math.max(active.progress || 0, next);
    const el = ensureOverlay();
    el.style.setProperty('--ld2-preview-progress', `${active.progress}%`);
    const track = el.querySelector('.ld2-preview-progress-track');
    track?.setAttribute('aria-valuenow', String(active.progress));
    const phase = el.querySelector('[data-ld2-preview-phase]');
    const status = el.querySelector('[data-ld2-preview-status]');
    const percent = el.querySelector('[data-ld2-preview-percent]');
    if (phase && (label || detail)) phase.textContent = [label, detail].filter(Boolean).join(' · ');
    if (status && label) status.textContent = label;
    if (percent) percent.textContent = `${active.progress}%`;
    scheduleLayout();
  }

  function progressFromMessage(message) {
    const stage = String(message?.stage || '').toLowerCase();
    const done = message?.status === 'done';

    if (stage === 'cache') {
      const current = Number(message?.current);
      const total = Number(message?.total);
      if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
        return 8 + Math.round(clamp(current / total, 0, 1) * 14);
      }
      return done ? 22 : 8;
    }

    const values = {
      prompt: [2, 6],
      context: [24, 34],
      ai: [36, 58],
      diff: [60, 68],
      shadow: [70, 75],
      regression: [76, 79],
      validation: [80, 88],
      checkpoint: [89, 91],
      publish: [92, 95],
      verify: [96, 97],
      commit: [70, 95],
      sync: [97, 98],
      done: [98, 98]
    };
    const pair = values[stage] || [active?.progress || 1, active?.progress || 1];
    return done ? pair[1] : pair[0];
  }

  function likelyPreviewFrame(frame) {
    return frame?.tagName === 'IFRAME' && scoreCandidate(frame) >= 48;
  }

  function attachFrameListeners() {
    for (const frame of document.querySelectorAll('iframe')) {
      if (frameListeners.has(frame)) continue;
      frameListeners.add(frame);
      frame.addEventListener('load', () => {
        if (!active?.syncStartedAt || !likelyPreviewFrame(frame)) return;
        if (Date.now() + 50 < active.syncStartedAt) return;
        notePreviewSignal('iframe-load');
      }, true);
    }
  }

  function previewLoaderActive() {
    const best = bestPreview();
    const root = best?.el?.tagName === 'IFRAME' ? best.el.parentElement : best?.el;
    if (!root?.querySelectorAll) return false;
    const loaders = root.querySelectorAll('[aria-busy="true"],[data-loading="true"],[data-state="loading"],[class*="spinner" i],[class*="loading" i]');
    return [...loaders].some(el => el !== overlay && visible(el));
  }

  function startWaitingForPreview() {
    if (!active || active.syncStartedAt) return;
    active.syncStartedAt = Date.now();
    active.loaderSeen = previewLoaderActive();
    attachFrameListeners();
    setProgress(Math.max(active.progress, 97), 'Sincronizando preview', 'Aguardando confirmação visual do Lovable…');
  }

  function notePreviewSignal(reason) {
    if (!active?.syncStartedAt) return;
    active.previewSignal = reason || 'preview-change';
    active.previewSignalAt = Date.now();
    maybeFinish();
  }

  function maybeFinish() {
    if (!active?.executionResolved || !active?.previewSignal) return;
    const el = ensureOverlay();
    setProgress(100, 'Pré-visualização atualizada', 'Preview real confirmado pelo Lovable');
    el.classList.add('is-complete');
    clearTimeout(active.stallTimer);
    const token = active.token;
    setTimeout(() => {
      if (!active || active.token !== token) return;
      cleanup();
    }, 520);
  }

  function showStalledState() {
    if (!active || active.previewSignal) return;
    const el = ensureOverlay();
    setProgress(Math.max(active.progress, 98), 'Aguardando Lovable', 'Commit aplicado; ainda sem confirmação visual do preview.');
    const release = el.querySelector('[data-ld2-preview-release]');
    if (release) release.hidden = false;
  }

  function releaseWithoutConfirmation() {
    if (!active) return;
    const el = ensureOverlay();
    el.classList.add('is-released');
    const phase = el.querySelector('[data-ld2-preview-phase]');
    if (phase) phase.textContent = 'Preview liberado sem confirmação visual do Lovable.';
    setTimeout(cleanup, 220);
  }

  function fail(error) {
    if (!active) return;
    clearTimeout(active.stallTimer);
    const el = ensureOverlay();
    el.classList.add('is-error');
    const phase = el.querySelector('[data-ld2-preview-phase]');
    const status = el.querySelector('[data-ld2-preview-status]');
    if (phase) phase.textContent = String(error?.message || error || 'Falha na execução.');
    if (status) status.textContent = 'Execução interrompida';
    const token = active.token;
    setTimeout(() => {
      if (!active || active.token !== token) return;
      cleanup();
    }, 850);
  }

  function cleanup() {
    if (active?.stallTimer) clearTimeout(active.stallTimer);
    active = null;
    overlay?.remove();
    overlay = null;
  }

  function begin(message) {
    if (active) cleanup();
    const requestId = String(message?.requestId || crypto.randomUUID());
    const baseline = new Map();
    for (const frame of document.querySelectorAll('iframe')) baseline.set(frame, String(frame.getAttribute('src') || ''));
    active = {
      token: crypto.randomUUID(),
      requestId,
      type: String(message?.type || ''),
      startedAt: Date.now(),
      progress: 0,
      baseline,
      executionResolved: false,
      syncStartedAt: 0,
      loaderSeen: false,
      previewSignal: '',
      previewSignalAt: 0,
      stallTimer: 0
    };
    ensureOverlay().classList.add('is-active');
    attachFrameListeners();
    setProgress(1, 'Preparando execução', 'Iniciando processamento do comando…');
    scheduleLayout();
    return requestId;
  }

  const observer = new MutationObserver(mutations => {
    if (!active) return;
    scheduleLayout();
    attachFrameListeners();
    if (!active.syncStartedAt) return;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target?.tagName === 'IFRAME' && mutation.attributeName === 'src' && likelyPreviewFrame(mutation.target)) {
        const before = active.baseline.get(mutation.target);
        const after = String(mutation.target.getAttribute('src') || '');
        if (before !== after) notePreviewSignal('iframe-src-change');
      }
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node?.nodeType !== Node.ELEMENT_NODE) continue;
          const frames = node.tagName === 'IFRAME' ? [node] : [...(node.querySelectorAll?.('iframe') || [])];
          if (frames.some(frame => likelyPreviewFrame(frame) && !active.baseline.has(frame))) {
            notePreviewSignal('iframe-replaced');
          }
        }
      }
    }

    const loaderNow = previewLoaderActive();
    if (loaderNow) active.loaderSeen = true;
    else if (active.loaderSeen) notePreviewSignal('loader-cycle');
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'aria-busy', 'data-state', 'data-loading'] });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'LD2_PROGRESS' || !active || String(message.requestId || '') !== active.requestId) return;
    const stage = String(message.stage || '').toLowerCase();
    const label = String(message.label || message.stage || 'Processando');
    const detail = String(message.detail || '');
    setProgress(progressFromMessage(message), label, detail);
    if ((stage === 'commit' && message.status === 'done') || stage === 'sync') startWaitingForPreview();
  });

  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!BUILD_TYPES.has(type)) return previousRuntime(message);

    const requestId = begin(message || {});
    const enriched = { ...(message || {}), requestId };
    try {
      const result = await previousRuntime(enriched);
      if (!active || active.requestId !== requestId) return result;
      active.executionResolved = true;
      if (!active.syncStartedAt) startWaitingForPreview();
      active.stallTimer = setTimeout(showStalledState, STALL_MS);
      maybeFinish();
      return result;
    } catch (error) {
      if (active?.requestId === requestId) fail(error);
      throw error;
    }
  };

  addEventListener('resize', scheduleLayout, { passive: true });
  addEventListener('scroll', scheduleLayout, { passive: true, capture: true });
  addEventListener('popstate', scheduleLayout);
  addEventListener('hashchange', scheduleLayout);
  window.addEventListener('ld2:project', scheduleLayout);
})();
