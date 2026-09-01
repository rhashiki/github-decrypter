(() => {
  'use strict';
  if (window.__LD2_PREMIUM_LICENSE_GATE__) return;
  window.__LD2_PREMIUM_LICENSE_GATE__ = true;

  const ROOT_ID = 'ld2-root';
  const COMMUNITY_URL = 'https://chat.whatsapp.com/BRBQfHORPYeFb7KJHicKYh?s=cl&p=a&mlu=4';
  let statusObserver = null;

  const root = () => document.getElementById(ROOT_ID);

  function clipboardIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="11" height="13" rx="2"/><path d="M15 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1"/></svg>';
  }

  function classifyState(text) {
    const value = String(text || '').toLowerCase();
    if (/validando|verificando|aguarde|assinatura/.test(value)) return 'validating';
    if (/inválid|inval|expir|erro|falha|bloque|limite|negad|não foi possível|nao foi possivel/.test(value)) return 'error';
    return 'idle';
  }

  function setState(box, state) {
    if (box) box.dataset.state = state || 'idle';
  }

  async function deviceLabel() {
    try {
      const settings = await window.LovableDecrypterV2?.runtime?.({ type: 'LD2_SETTINGS_GET' });
      const id = String(settings?.auth?.deviceId || '').trim();
      if (id) return `Dispositivo atual · ${id.slice(0, 8)}…`;
    } catch (_) {}
    return 'Dispositivo atual · validação vinculada a esta instalação';
  }

  async function pasteLicense(input, status, box) {
    try {
      const value = String(await navigator.clipboard.readText()).trim();
      if (!value) throw new Error('clipboard_empty');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      status.textContent = 'Licença colada. Clique em Ativar Decrypter.';
      setState(box, 'idle');
    } catch (_) {
      status.textContent = 'Não foi possível ler a área de transferência. Cole a licença manualmente.';
      setState(box, 'error');
    }
  }

  function installStatusObserver(box, status) {
    if (!status || statusObserver) return;
    const sync = () => setState(box, classifyState(status.textContent));
    statusObserver = new MutationObserver(sync);
    statusObserver.observe(status, { childList: true, characterData: true, subtree: true });
    sync();
  }

  async function enhance() {
    const gate = root()?.querySelector('[data-license-gate]');
    const box = gate?.querySelector('.ld2-license-box');
    const input = gate?.querySelector('[data-license-input]');
    const login = gate?.querySelector('[data-license-login]');
    const status = gate?.querySelector('[data-license-status]');
    if (!gate || !box || !input || !login || !status) return false;
    if (box.dataset.premiumLicense === '1') return true;

    box.dataset.premiumLicense = '1';
    box.dataset.state = 'idle';

    const title = box.querySelector('h2');
    const intro = box.querySelector(':scope > p');
    if (title) title.textContent = 'Ative o Lovable Decrypter';
    if (intro) intro.textContent = 'Insira sua chave de licença para liberar o Decrypter neste dispositivo.';

    input.placeholder = 'LD2.••••••••••••••••';
    input.setAttribute('aria-label', 'Chave de licença do Lovable Decrypter');

    const wrap = document.createElement('div');
    wrap.className = 'ld2-license-key-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const paste = document.createElement('button');
    paste.type = 'button';
    paste.className = 'ld2-license-paste';
    paste.setAttribute('aria-label', 'Colar licença');
    paste.title = 'Colar licença';
    paste.innerHTML = clipboardIcon();
    wrap.appendChild(paste);

    login.textContent = 'Ativar Decrypter';
    login.setAttribute('aria-label', 'Ativar Lovable Decrypter');

    const meta = document.createElement('div');
    meta.className = 'ld2-license-meta';
    meta.innerHTML = `
      <span class="ld2-license-secure"><i></i>Conexão segura</span>
      <a class="ld2-license-community" href="${COMMUNITY_URL}" target="_blank" rel="noopener noreferrer">Comunidade Decrrypter</a>
      <span class="ld2-license-device" data-license-device>Dispositivo atual</span>`;
    status.insertAdjacentElement('afterend', meta);
    meta.querySelector('[data-license-device]').textContent = await deviceLabel();

    paste.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      pasteLicense(input, status, box);
    });

    login.addEventListener('click', () => setState(box, 'validating'), true);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') setState(box, 'validating');
    }, true);
    input.addEventListener('input', () => {
      if (box.dataset.state === 'error') {
        setState(box, 'idle');
        status.textContent = 'A KEY é validada por assinatura digital.';
      }
    });

    installStatusObserver(box, status);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    if (await enhance()) clearInterval(timer);
    if (attempts >= 120) clearInterval(timer);
  }, 100);
})();
