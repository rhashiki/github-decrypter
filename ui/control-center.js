(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CONTROL_CENTER__) return;
  window.__LOVABLE_DECRYPTER_CONTROL_CENTER__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const MOUNT_ATTR = 'data-ld2-control-center';
  const LICENSE_TIMEOUT_MS = 8000;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  function triggerLegacyAction(root, action) {
    const target = $(`.ld2-nav [data-action="${action}"]`, root);
    if (target) target.click();
  }

  function triggerSettings(root) {
    $('[data-settings]', root)?.click();
  }

  function toast(root, text, error = false) {
    const wrap = $('.ld2-toast-wrap', root);
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  function setLicenseHealth(root, valid) {
    const label = $('[data-cc-license-state]', root);
    const dot = $('[data-cc-license-dot]', root);
    if (label) label.textContent = valid ? 'Validada' : 'Aguardando KEY';
    if (dot) dot.classList.toggle('ready', !!valid);
  }

  async function checkActivation(root) {
    const gate = $('[data-license-gate]', root);
    const status = $('[data-license-status]', root);
    if (!gate || !runtime) return false;

    // Fail closed: enquanto a validação não termina, a extensão pede a KEY
    // e nenhuma UI operacional deve aparecer por cima do Lovable.
    gate.hidden = false;
    if (status) status.textContent = 'Validando ativação e dispositivo…';
    setLicenseHealth(root, false);

    try {
      const auth = await withTimeout(
        runtime({ type: 'LD2_LICENSE_STATUS' }),
        LICENSE_TIMEOUT_MS,
        'A validação da KEY demorou demais. Verifique sua conexão e tente novamente.'
      );
      const valid = !!auth?.valid;
      root.dataset.ld2Licensed = valid ? '1' : '0';
      gate.hidden = valid;
      if (!valid && status) status.textContent = 'Digite sua KEY de ativação para continuar.';
      setLicenseHealth(root, valid);
      return valid;
    } catch (error) {
      root.dataset.ld2Licensed = '0';
      gate.hidden = false;
      if (status) status.textContent = error?.message || 'Não foi possível validar a KEY.';
      setLicenseHealth(root, false);
      return false;
    }
  }

  function render(root) {
    if (!root) return;

    // O gate deve aparecer imediatamente. O ui.js antigo o criava escondido e
    // aguardava a rede antes de mostrá-lo, deixando o launcher exposto sem ativação.
    const gate = $('[data-license-gate]', root);
    if (gate && !root.hasAttribute('data-ld2-license-checked')) gate.hidden = false;

    if (root.hasAttribute(MOUNT_ATTR)) return;
    const panel = $('.ld2-panel', root);
    const body = $('.ld2-body', root);
    const legacyWorkspace = $('.ld2-chat', root);
    if (!panel || !body || !legacyWorkspace) return;

    root.setAttribute(MOUNT_ATTR, '1');
    root.setAttribute('data-ld2-license-checked', '1');

    const brand = $('.ld2-brand b', root);
    const versionLabel = $('.ld2-brand small', root);
    if (brand) brand.textContent = 'LOVABLE DECRYPTER';
    if (versionLabel) versionLabel.textContent = `CONTROL CENTER · v${VERSION}`;

    // Mantemos os controles legados no DOM apenas como adaptadores para os modais
    // existentes. Eles deixam de fazer parte da interface visível.
    legacyWorkspace.classList.add('ld2-legacy-hooks');
    const workspace = document.createElement('main');
    workspace.className = 'ld2-control-center';
    workspace.innerHTML = `
      <section class="ld2-cc-hero">
        <div class="ld2-cc-hero-copy">
          <small>LOVABLE DECRYPTER</small>
          <h2>Control Center</h2>
          <p>Automação, segurança e inteligência de projeto integradas diretamente ao composer do Lovable.</p>
        </div>
        <span class="ld2-cc-badge">v${VERSION}</span>
      </section>

      <section class="ld2-cc-health" aria-label="Estado da integração">
        <div><span class="ld2-cc-dot ready"></span><small>Extensão</small><b>Ativa</b></div>
        <div><span class="ld2-cc-dot ready"></span><small>Composer</small><b>Integrado</b></div>
        <div><span class="ld2-cc-dot" data-cc-license-dot></span><small>Licença</small><b data-cc-license-state>Validando…</b></div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>ENGENHARIA</small><h3>Operação do projeto</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-batch><span>☷</span><div><b>Fila de comandos</b><small>Execução sequencial com validação por item</small></div><em>ATIVA</em></button>
          <button class="ld2-cc-card" type="button" data-cc-action="skills"><span>✳</span><div><b>Skills</b><small>Biblioteca e preferências do agente</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="train"><span>◎</span><div><b>Project Brain</b><small>Treinar e atualizar contexto do projeto</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="history"><span>↺</span><div><b>Histórico</b><small>Execuções, commits e alterações recentes</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>PROJETO</small><h3>Integrações e ferramentas</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-action="github"><span>GH</span><div><b>GitHub</b><small>Repositório, branch e sincronização</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="migrate"><span>⇄</span><div><b>Migrations</b><small>Aplicar migrations existentes com controle</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="zip"><span>⇩</span><div><b>Exportar ZIP</b><small>Gerar uma cópia do projeto atual</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="notes"><span>▤</span><div><b>Notas</b><small>Anotações persistentes do projeto</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>SISTEMA</small><h3>Controle e segurança</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-action="diag"><span>◇</span><div><b>Diagnóstico</b><small>Verificar integrações e ambiente</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-settings><span>⚙</span><div><b>Configurações</b><small>Gemini, GitHub, Supabase e preferências</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="license"><span>◉</span><div><b>Licença</b><small>KEY, dispositivo, plano e créditos</small></div></button>
          <button class="ld2-cc-card accent" type="button" data-cc-action="update"><span>↻</span><div><b>Atualizar</b><small>Verificar e aplicar OTA assinado</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-native-chat">
        <div><span>⌘</span><div><b>Composer do Lovable integrado</b><small>Plan/Build, anexos, Gemini, progresso real, validação, checkpoint e rollback trabalham sobre o chat nativo.</small></div></div>
        <span class="ld2-cc-status">PRONTO</span>
      </section>`;
    body.appendChild(workspace);

    $$('[data-cc-action]', workspace).forEach(button => {
      button.addEventListener('click', () => triggerLegacyAction(root, button.dataset.ccAction));
    });
    $('[data-cc-settings]', workspace)?.addEventListener('click', () => triggerSettings(root));
    $('[data-cc-batch]', workspace)?.addEventListener('click', () => {
      toast(root, 'A fila executa os comandos em sequência pelo composer do Lovable, um item por vez.');
    });

    const login = $('[data-license-login]', root);
    if (login) {
      login.addEventListener('click', () => {
        setTimeout(() => checkActivation(root), 900);
        setTimeout(() => checkActivation(root), 2600);
      });
    }

    checkActivation(root);
  }

  function watch() {
    const tryRender = () => {
      const root = document.getElementById(ROOT_ID);
      if (root) render(root);
    };
    tryRender();
    const observer = new MutationObserver(tryRender);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.documentElement) watch();
  else addEventListener('DOMContentLoaded', watch, { once: true });
})();
