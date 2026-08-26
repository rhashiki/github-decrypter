(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CONTROL_CENTER__) return;
  window.__LOVABLE_DECRYPTER_CONTROL_CENTER__ = true;

  const VERSION = '2.2.0';
  const ROOT_ID = 'ld2-root';
  const MOUNT_ATTR = 'data-ld2-control-center';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function triggerLegacyAction(root, action) {
    const target = $(`.ld2-nav [data-action="${action}"]`, root);
    if (target) target.click();
  }

  function triggerSettings(root) {
    $('[data-settings]', root)?.click();
  }

  function render(root) {
    if (!root || root.hasAttribute(MOUNT_ATTR)) return;
    const panel = $('.ld2-panel', root);
    const workspace = $('.ld2-chat', root);
    const messages = $('[data-messages]', root);
    if (!panel || !workspace || !messages || !messages.children.length) return;

    root.setAttribute(MOUNT_ATTR, '1');

    const versionLabel = $('.ld2-brand small', root);
    if (versionLabel) versionLabel.textContent = `CONTROL CENTER · v${VERSION}`;

    $('.ld2-nav [data-action="chat"]', root)?.remove();

    workspace.classList.remove('ld2-chat');
    workspace.classList.add('ld2-control-center');
    workspace.innerHTML = `
      <section class="ld2-cc-hero">
        <div>
          <small>LOVABLE DECRYPTER</small>
          <h2>Control Center</h2>
          <p>O chat próprio foi removido. Os comandos do Decrypter agora usam o composer nativo do Lovable pelo Native Composer Bridge.</p>
        </div>
        <span class="ld2-cc-badge">v${VERSION}</span>
      </section>

      <section class="ld2-cc-health" aria-label="Estado da integração">
        <div><span class="ld2-cc-dot ready"></span><small>Extensão</small><b>Ativa</b></div>
        <div><span class="ld2-cc-dot ready"></span><small>Composer Bridge</small><b>Ativo</b></div>
        <div><span class="ld2-cc-dot"></span><small>Queue UI</small><b>Backend pronto</b></div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>OPERAÇÃO</small><h3>Engenharia</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card future" type="button" data-cc-future="queue"><span>☷</span><div><b>Fila</b><small>Execuções persistentes</small></div><em>Backend</em></button>
          <button class="ld2-cc-card" type="button" data-cc-action="skills"><span>✳</span><div><b>Skills</b><small>Biblioteca e preferências</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="train"><span>◎</span><div><b>Project Brain</b><small>Treinar contexto do projeto</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="history"><span>↺</span><div><b>Histórico</b><small>Execuções e alterações</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>PROJETO</small><h3>Ferramentas</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-action="github"><span>GH</span><div><b>GitHub</b><small>Repositório e branch</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="migrate"><span>⇄</span><div><b>Migrations</b><small>Aplicar migrations existentes</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="zip"><span>⇩</span><div><b>ZIP</b><small>Exportar projeto</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="notes"><span>▤</span><div><b>Notas</b><small>Anotações do projeto</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>SISTEMA</small><h3>Controle</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-action="diag"><span>◇</span><div><b>Diagnóstico</b><small>Verificar integração</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-settings><span>⚙</span><div><b>Configurações</b><small>Gemini, GitHub e preferências</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="license"><span>◉</span><div><b>Licença</b><small>Plano, créditos e dispositivo</small></div></button>
          <button class="ld2-cc-card accent" type="button" data-cc-action="update"><span>↻</span><div><b>Atualizar</b><small>Verificar OTA assinado</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-native-chat">
        <div><span>⌘</span><div><b>Chat nativo do Lovable</b><small>O Native Composer Bridge já incorpora Plan/Build, anexos do Decrypter, modelo Gemini e execução. Skills, Queue, Think, Rewrite, Visual e Voice entram nas próximas etapas.</small></div></div>
        <span class="ld2-cc-status">Bridge ativo</span>
      </section>`;

    $$('[data-cc-action]', workspace).forEach(button => {
      button.addEventListener('click', () => triggerLegacyAction(root, button.dataset.ccAction));
    });
    $('[data-cc-settings]', workspace)?.addEventListener('click', () => triggerSettings(root));
    $$('[data-cc-future]', workspace).forEach(button => {
      button.addEventListener('click', () => {
        const wrap = $('.ld2-toast-wrap', root);
        if (!wrap) return;
        const toast = document.createElement('div');
        toast.className = 'ld2-toast';
        toast.textContent = 'O backend da fila está pronto. A Queue UI será incorporada ao Native Composer Bridge na próxima etapa.';
        wrap.appendChild(toast);
        setTimeout(() => toast.remove(), 3200);
      });
    });
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
