(() => {
  'use strict';
  if (window.__LD2_ERROR_INTELLIGENCE_CENTER__) return;
  window.__LD2_ERROR_INTELLIGENCE_CENTER__ = true;

  const STORAGE_KEY = 'ld2_error_intelligence_history_v1';
  const MONITOR_KEY = 'ld2_monitor_enabled';
  const MAX_HISTORY = 80;
  const DEDUPE_MS = 60000;
  let toastObserver = null;
  let installedRoot = null;
  let currentChecks = null;

  const core = () => window.LovableDecrypterErrorIntelligenceCore;
  const root = () => document.getElementById('ld2-root');
  const $ = (selector, scope = document) => scope?.querySelector?.(selector) || null;
  const $$ = (selector, scope = document) => [...(scope?.querySelectorAll?.(selector) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  async function loadHistory() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY].slice(0, MAX_HISTORY) : [];
    } catch (_) {
      return [];
    }
  }

  async function saveHistory(items) {
    try { await chrome.storage.local.set({ [STORAGE_KEY]: items.slice(0, MAX_HISTORY) }); } catch (_) {}
  }

  async function report(input = {}) {
    const classifier = core();
    if (!classifier?.classify) return null;
    const entry = classifier.classify(input);
    const history = await loadHistory();
    const index = history.findIndex(item => item?.fingerprint === entry.fingerprint && entry.at - Number(item?.at || 0) <= DEDUPE_MS);
    let next;
    if (index >= 0) {
      const previous = history.splice(index, 1)[0];
      next = { ...entry, count: Math.max(1, Number(previous?.count || 1)) + 1 };
    } else {
      next = { ...entry };
    }
    history.unshift(next);
    await saveHistory(history);
    window.dispatchEvent(new CustomEvent('ld2:error-intelligence-updated', { detail: { entry: next } }));
    refreshOpenCenter().catch(() => {});
    return next;
  }

  function classifyToast(node) {
    if (!(node instanceof Element) || !node.classList.contains('ld2-toast') || !node.classList.contains('error')) return;
    const message = String(node.textContent || '').trim();
    if (message) report({ source: 'runtime', message, severity: 'high' });
  }

  function installToastObserver() {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap || toastObserver) return false;
    toastObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) classifyToast(node);
    });
    toastObserver.observe(wrap, { childList: true });
    return true;
  }

  function bindSignals() {
    window.addEventListener('ld2:error', event => report(event?.detail || {}));
    window.addEventListener('ld2:hardening-state', event => {
      const detail = event?.detail || {};
      const phase = String(detail.phase || '').toUpperCase();
      if (!['DEGRADED', 'LOCKED'].includes(phase)) return;
      report({
        source: 'hardening',
        code: `HARDENING_${phase}`,
        severity: phase === 'LOCKED' ? 'high' : 'medium',
        message: detail.reason || `Hardening ${phase.toLowerCase()}.`,
        detail: `capabilityStatus=${detail.capabilityStatus || 'unknown'}; routingEnabled=${detail.routingEnabled !== false}`
      });
    });
    window.addEventListener('ld2:composer-guardian-state', event => {
      const detail = event?.detail || {};
      const health = String(detail.health || '').toUpperCase();
      if (detail.routingEnabled !== true || !['DEGRADED', 'INACTIVE'].includes(health)) return;
      report({
        source: 'composer',
        code: `COMPOSER_${health}`,
        severity: health === 'INACTIVE' ? 'high' : 'medium',
        message: detail.reason || `Composer Guardian ${health.toLowerCase()}.`,
        detail: `input=${!!detail.inputFound}; bridge=${!!detail.bridgeFound}; send=${!!detail.sendFound}; dispatch=${!!detail.dispatchVerified}`
      });
    });
    window.addEventListener('ld2:early-boot-blocked', event => {
      const detail = event?.detail || {};
      report({
        source: 'security',
        code: 'EARLY_BOOT_NATIVE_SEND_BLOCKED',
        severity: 'medium',
        title: 'Envio nativo bloqueado durante o boot',
        message: detail.lastReason || 'O sentinel antecipado bloqueou uma tentativa de envio nativo antes do handoff.',
        detail: `scope=${detail.scope || 'unknown'}; blocked=${Number(detail.blockedNativeIntents || 0)}`
      });
    });
    window.addEventListener('ld2:lovable-github-migration-failure', event => report({ source: 'migration', code: 'LOVABLE_GITHUB_MIGRATION_FAILURE', severity: 'high', message: event?.detail?.message || 'Migração Lovable para GitHub falhou.' }));
    window.addEventListener('ld2:cloud-supabase-migration-failure', event => report({ source: 'migration', code: 'CLOUD_SUPABASE_MIGRATION_FAILURE', severity: 'high', message: event?.detail?.message || 'Migração Lovable Cloud para Supabase falhou.' }));
  }

  async function localHealth() {
    let monitorEnabled = true;
    try { monitorEnabled = (await chrome.storage.local.get(MONITOR_KEY))[MONITOR_KEY] !== false; } catch (_) {}
    let capabilities = null;
    try { capabilities = await window.LovableDecrypterCapabilities?.getLast?.(); } catch (_) {}
    let early = null, hardening = null, composer = null;
    try { early = window.LovableDecrypterEarlyBoot?.snapshot?.() || null; } catch (_) {}
    try { hardening = window.LovableDecrypterHardening?.snapshot?.() || null; } catch (_) {}
    try { composer = window.LovableDecrypterComposerGuardian?.snapshot?.() || null; } catch (_) {}
    return { early, hardening, composer, capabilities, monitorEnabled, online: navigator.onLine !== false };
  }

  async function runChecks() {
    const runtime = window.LovableDecrypterV2?.runtime;
    const result = {
      at: Date.now(),
      version: chrome.runtime.getManifest().version,
      projectId: window.LovableDecrypterV2?.getProjectId?.() || '',
      settings: null,
      license: null,
      repo: null,
      gemini: null,
      health: await localHealth()
    };
    if (!runtime) {
      await report({ source: 'runtime', code: 'RUNTIME_UNAVAILABLE', severity: 'high', message: 'Runtime do Lovable Decrypter indisponível.' });
      currentChecks = result;
      return result;
    }
    try { result.settings = await runtime({ type: 'LD2_SETTINGS_GET' }); }
    catch (error) { await report({ source: 'runtime', code: 'SETTINGS_READ_FAILURE', severity: 'high', error }); }
    try { result.license = await runtime({ type: 'LD2_LICENSE_STATUS' }); }
    catch (error) { await report({ source: 'license', code: 'LICENSE_STATUS_FAILURE', severity: 'high', error }); }

    const github = result.settings?.github || {};
    if (github.owner && github.repo) {
      try { result.repo = await runtime({ type: 'LD2_REPO_SCAN', projectId: result.projectId }); }
      catch (error) { result.repo = { error: core()?.sanitizeText?.(error?.message || error) || 'Falha no GitHub.' }; await report({ source: 'github', code: 'REPO_SCAN_FAILURE', severity: 'high', error }); }
    } else {
      result.repo = { state: 'not_configured' };
    }

    const gemini = result.settings?.gemini || {};
    result.gemini = {
      configured: !!gemini.apiKey,
      model: String(gemini.model || ''),
      note: gemini.apiKey ? 'Configurado. Nenhuma chamada de modelo foi feita pelo diagnóstico.' : 'API Key não configurada.'
    };
    currentChecks = result;
    return result;
  }

  function stateTone(value) {
    const text = String(value || '').toUpperCase();
    if (/READY|OK|PROTECTED|ACTIVE|TRUE/.test(text)) return 'ok';
    if (/LOCKED|BROKEN|UNAVAILABLE|INACTIVE|FALSE/.test(text)) return 'bad';
    return 'warn';
  }

  function healthCards(health = {}) {
    const early = health.early;
    const hardening = health.hardening;
    const composer = health.composer;
    const earlyState = early ? (early.handedOff ? 'HANDOFF OK' : early.armed ? 'PROTECTED' : 'DISARMED') : 'UNKNOWN';
    const hardeningState = hardening?.phase || 'UNKNOWN';
    const composerState = composer?.health || 'UNKNOWN';
    const monitorState = health.monitorEnabled ? 'ATIVO' : 'DESATIVADO';
    const rows = [
      ['Early Boot', earlyState, stateTone(earlyState)],
      ['Hardening', hardeningState, stateTone(hardeningState)],
      ['Composer', composerState, stateTone(composerState)],
      ['Monitor', monitorState, health.monitorEnabled ? 'ok' : 'bad']
    ];
    return rows.map(([label, value, tone]) => `<div class="ld-eic-health ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('');
  }

  function severityLabel(value) {
    return ({ critical:'CRÍTICO', high:'ALTO', medium:'MÉDIO', low:'BAIXO', info:'INFO' })[value] || String(value || 'INFO').toUpperCase();
  }

  function summaryCounts(history) {
    return {
      total: history.reduce((sum, item) => sum + Math.max(1, Number(item.count || 1)), 0),
      critical: history.filter(item => item.severity === 'critical').length,
      high: history.filter(item => item.severity === 'high').length,
      medium: history.filter(item => item.severity === 'medium').length
    };
  }

  function occurrenceMarkup(item) {
    const when = item.at ? new Date(item.at).toLocaleString('pt-BR') : '—';
    return `<article class="ld-eic-event" data-fingerprint="${esc(item.fingerprint)}">
      <div class="ld-eic-event-head"><span class="ld-eic-severity ${esc(item.severity)}">${esc(severityLabel(item.severity))}</span><div><b>${esc(item.title)}</b><small>${esc(item.source)} · ${esc(item.code)} · ${esc(when)}${Number(item.count || 1) > 1 ? ` · ${Number(item.count)}×` : ''}</small></div></div>
      <p>${esc(item.message)}</p>
      <div class="ld-eic-cause"><strong>Causa provável</strong><span>${esc(item.cause)}</span></div>
      ${item.detail ? `<details><summary>Detalhes técnicos sanitizados</summary><code>${esc(item.detail)}</code></details>` : ''}
      <div class="ld-eic-event-actions"><button class="ld2-btn" data-eic-recovery="${esc(item.recovery?.type || 'diagnostic')}">${esc(item.recovery?.label || 'Atualizar diagnóstico')}</button></div>
    </article>`;
  }

  async function diagnosticSummary() {
    const history = await loadHistory();
    const health = await localHealth();
    const latest = history.slice(0, 10).map(item => `${item.severity.toUpperCase()} | ${item.source} | ${item.code} | ${item.message}`).join('\n');
    const lines = [
      `Lovable Decrypter ${chrome.runtime.getManifest().version}`,
      `Projeto: ${window.LovableDecrypterV2?.getProjectId?.() || 'não identificado'}`,
      `Online: ${navigator.onLine !== false ? 'sim' : 'não'}`,
      `Early Boot: ${health.early?.handedOff ? 'handoff_ok' : health.early?.armed ? 'protected' : 'unknown'}`,
      `Hardening: ${health.hardening?.phase || 'unknown'} · ${health.hardening?.reason || ''}`,
      `Composer: ${health.composer?.health || 'unknown'} · ${health.composer?.reason || ''}`,
      `Monitor: ${health.monitorEnabled ? 'ativo' : 'desativado'}`,
      '',
      'Últimas ocorrências:',
      latest || 'Nenhuma ocorrência registrada.'
    ];
    return core()?.sanitizeText?.(lines.join('\n'), 6000) || lines.join('\n');
  }

  function recoveryAction(type) {
    const r = root();
    const click = selector => {
      closeCenter();
      setTimeout(() => r?.querySelector(selector)?.click?.(), 40);
    };
    if (type === 'settings') return click('[data-settings]');
    if (type === 'github') return click('[data-action="github"]');
    if (type === 'license') return click('[data-action="license"]');
    if (type === 'migrate') return click('[data-action="migrate"]');
    if (type === 'zip') return click('[data-action="zip"]');
    runChecks().then(() => refreshOpenCenter()).catch(() => {});
  }

  async function renderCenter(card) {
    const history = await loadHistory();
    const health = await localHealth();
    const counts = summaryCounts(history);
    const checks = currentChecks;
    const repoText = checks?.repo?.error || (checks?.repo?.repo ? `${checks.repo.repo} · ${checks.repo.files || 0} arquivos` : checks?.repo?.state === 'not_configured' ? 'Não configurado' : 'Não verificado nesta sessão');
    const licenseText = checks?.license ? (checks.license.valid ? 'Válida' : checks.license.error || 'Inválida') : 'Não verificada nesta sessão';
    const geminiText = checks?.gemini ? (checks.gemini.configured ? `${checks.gemini.model || 'Configurado'} · sem chamada de modelo` : 'Não configurado') : 'Não verificado nesta sessão';
    const list = history.length ? history.map(occurrenceMarkup).join('') : '<div class="ld-eic-empty"><b>Nenhuma ocorrência registrada</b><span>Falhas da própria extensão aparecerão aqui com diagnóstico e ação recomendada.</span></div>';
    $('.ld2-modal-body', card).innerHTML = `
      <div class="ld-eic-toolbar"><div><b>Error Intelligence Center</b><span>Diagnóstico local, sanitizado e orientado à recuperação.</span></div><div class="ld2-actions"><button class="ld2-btn primary" data-eic-check>Atualizar diagnóstico</button><button class="ld2-btn" data-eic-copy>Copiar resumo</button><button class="ld2-btn danger" data-eic-clear>Limpar histórico</button></div></div>
      <section class="ld-eic-metrics"><div><small>Ocorrências</small><b>${counts.total}</b></div><div><small>Críticas</small><b>${counts.critical}</b></div><div><small>Altas</small><b>${counts.high}</b></div><div><small>Médias</small><b>${counts.medium}</b></div></section>
      <div class="ld2-section">Proteções locais</div><section class="ld-eic-health-grid">${healthCards(health)}</section>
      <div class="ld2-section">Verificação explícita</div><section class="ld-eic-checks"><div><small>Licença</small><b>${esc(licenseText)}</b></div><div><small>GitHub</small><b>${esc(repoText)}</b></div><div><small>Gemini</small><b>${esc(geminiText)}</b></div><div><small>Rede</small><b>${navigator.onLine !== false ? 'Online' : 'Offline'}</b></div></section>
      <p class="ld-eic-privacy">Nenhum erro é enviado para telemetria externa. Segredos conhecidos, tokens, licenças e parâmetros sensíveis são removidos antes da persistência local.</p>
      <div class="ld2-section">Ocorrências</div><section class="ld-eic-events">${list}</section>`;

    $('[data-eic-check]', card).onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = 'Verificando…';
      try { await runChecks(); await renderCenter(card); }
      finally { if (button.isConnected) { button.disabled = false; button.textContent = 'Atualizar diagnóstico'; } }
    };
    $('[data-eic-copy]', card).onclick = async () => {
      const summary = await diagnosticSummary();
      try { await navigator.clipboard.writeText(summary); }
      catch (_) {
        const area = document.createElement('textarea'); area.value = summary; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      const button = $('[data-eic-copy]', card); if (button) { button.textContent = 'Copiado'; setTimeout(() => { if (button.isConnected) button.textContent = 'Copiar resumo'; }, 1200); }
    };
    $('[data-eic-clear]', card).onclick = async () => { await saveHistory([]); await renderCenter(card); };
    $$('[data-eic-recovery]', card).forEach(button => { button.onclick = () => recoveryAction(button.dataset.eicRecovery); });
  }

  function openCenter() {
    const r = root();
    const modal = r?.querySelector('.ld2-modal');
    const card = r?.querySelector('.ld2-card');
    if (!modal || !card) return;
    card.className = 'ld2-card ld-eic-card';
    card.innerHTML = '<header class="ld2-modal-head"><span>◇</span><div><b>Error Intelligence Center</b><small>Erros, proteção e recuperação contextual</small></div><button class="ld2-close" data-eic-close>×</button></header><div class="ld2-modal-body"><p class="ld2-help">Carregando diagnóstico local…</p></div>';
    modal.classList.add('open');
    $('[data-eic-close]', card).onclick = closeCenter;
    renderCenter(card).catch(error => { $('.ld2-modal-body', card).textContent = core()?.sanitizeText?.(error?.message || error) || 'Falha ao abrir diagnóstico.'; });
  }

  function closeCenter() {
    const r = root();
    r?.querySelector('.ld2-modal')?.classList.remove('open');
    const card = r?.querySelector('.ld2-card');
    if (card) card.className = 'ld2-card';
  }

  async function refreshOpenCenter() {
    const card = root()?.querySelector('.ld2-card.ld-eic-card');
    if (card && root()?.querySelector('.ld2-modal')?.classList.contains('open')) await renderCenter(card);
  }

  function install() {
    const r = root();
    if (!r) return false;
    if (installedRoot !== r) {
      installedRoot = r;
      const diag = r.querySelector('[data-action="diag"]');
      if (diag && diag.dataset.eicBound !== '1') {
        diag.dataset.eicBound = '1';
        diag.title = 'Error Intelligence Center';
        diag.onclick = event => { event.preventDefault(); openCenter(); };
      }
    }
    installToastObserver();
    return !!r.querySelector('[data-action="diag"][data-eic-bound="1"]');
  }

  bindSignals();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install()) clearInterval(timer);
    if (attempts > 120) clearInterval(timer);
  }, 250);

  window.LovableDecrypterErrorIntelligence = Object.freeze({
    build: 35,
    schema: 'ld-error-intelligence-center/1',
    report,
    history: loadHistory,
    clear: () => saveHistory([]),
    runChecks,
    open: openCenter,
    summary: diagnosticSummary
  });
})();
