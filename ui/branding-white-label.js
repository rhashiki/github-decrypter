(() => {
  'use strict';
  if (window.__LD41_BRANDING_WHITE_LABEL__) return;
  window.__LD41_BRANDING_WHITE_LABEL__ = true;

  const ROOT_ID = 'ld2-root';
  const PROFILE_KEY = 'ld41_brand_profile';
  const DEFAULT_COMMUNITY = 'https://chat.whatsapp.com/BRBQfHORPYeFb7KJHicKYh?s=cl&p=a&mlu=4';
  const DEFAULT_PROFILE = Object.freeze({
    productName:'Lovable Decrypter',
    shortName:'Decrypter',
    tagline:'AI ENGINEERING LAYER',
    accent:'#59d8ff',
    accent2:'#8a78ff',
    communityUrl:DEFAULT_COMMUNITY,
    supportUrl:'',
    footerLabel:'Powered by Lovable Decrypter',
    logoDataUrl:'',
    showByline:true
  });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  let profile = { ...DEFAULT_PROFILE };
  let studio = null;
  let installAttempts = 0;
  let reconcileTimer = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function originalLogo() { return chrome.runtime.getURL('assets/fab.png'); }

  function validHex(value, fallback) {
    const v = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
  }

  function safeUrl(value, fallback = '') {
    const v = String(value || '').trim();
    if (!v) return fallback;
    try {
      const u = new URL(v);
      return /^https?:$/.test(u.protocol) ? u.toString() : fallback;
    } catch (_) { return fallback; }
  }

  function cleanText(value, fallback, max) {
    const v = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
    return v || fallback;
  }

  function sanitize(input = {}) {
    return {
      productName:cleanText(input.productName, DEFAULT_PROFILE.productName, 48),
      shortName:cleanText(input.shortName, DEFAULT_PROFILE.shortName, 24),
      tagline:cleanText(input.tagline, DEFAULT_PROFILE.tagline, 72),
      accent:validHex(input.accent, DEFAULT_PROFILE.accent),
      accent2:validHex(input.accent2, DEFAULT_PROFILE.accent2),
      communityUrl:safeUrl(input.communityUrl, DEFAULT_PROFILE.communityUrl),
      supportUrl:safeUrl(input.supportUrl, ''),
      footerLabel:cleanText(input.footerLabel, DEFAULT_PROFILE.footerLabel, 80),
      logoDataUrl:/^data:image\/(png|jpeg|webp);base64,/i.test(String(input.logoDataUrl || '')) ? String(input.logoDataUrl) : '',
      showByline:input.showByline !== false
    };
  }

  async function loadProfile() {
    try {
      const data = await chrome.storage.local.get(PROFILE_KEY);
      profile = sanitize(data[PROFILE_KEY] || DEFAULT_PROFILE);
    } catch (_) { profile = { ...DEFAULT_PROFILE }; }
    return profile;
  }

  async function saveProfile(next) {
    profile = sanitize(next);
    await chrome.storage.local.set({ [PROFILE_KEY]: profile });
    applyProfile();
    window.dispatchEvent(new CustomEvent('ld41:branding-changed', { detail:{ profile:{ ...profile, logoDataUrl:profile.logoDataUrl ? '[local-image]' : '' } } }));
    return profile;
  }

  function setText(selector, value) {
    $$(selector, root()).forEach(node => { if (node.textContent !== value) node.textContent = value; });
  }

  function applyProfile() {
    const r = root();
    if (!r) return false;
    r.dataset.ld41Branded = '1';
    r.style.setProperty('--ld41-accent', profile.accent);
    r.style.setProperty('--ld41-accent-2', profile.accent2);

    setText('.ld2-brand b', profile.productName.toUpperCase());
    setText('.ld2-brand small', `${profile.tagline} · v${chrome.runtime.getManifest().version}`);
    setText('.ld3-panel-eyebrow', profile.shortName);
    setText('.ld40-eyebrow', profile.shortName.toUpperCase());

    const gate = r.querySelector('[data-license-gate]');
    const title = gate?.querySelector('.ld2-license-box h2');
    const intro = gate?.querySelector('.ld2-license-box > p');
    const login = gate?.querySelector('[data-license-login]');
    if (title) title.textContent = `Ative o ${profile.productName}`;
    if (intro) intro.textContent = `Insira sua chave de licença para liberar o ${profile.shortName} neste dispositivo.`;
    if (login && !login.disabled) login.textContent = `Ativar ${profile.shortName}`;

    const logo = profile.logoDataUrl || originalLogo();
    $$('.ld2-fab img,.ld2-logo img,.ld2-license-box img', r).forEach(img => { if (img.src !== logo) img.src = logo; });

    let byline = r.querySelector('[data-ld41-byline]');
    if (!byline) {
      byline = document.createElement('span');
      byline.dataset.ld41Byline = '1';
      byline.className = 'ld41-byline';
      const panel = r.querySelector('.ld2-panel');
      panel?.appendChild(byline);
    }
    if (byline) {
      byline.hidden = !profile.showByline;
      byline.textContent = profile.footerLabel;
    }
    return true;
  }

  function toast(message, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = message;
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function readStudioForm(scope) {
    return sanitize({
      productName:$('[data-ld41-name]', scope)?.value,
      shortName:$('[data-ld41-short]', scope)?.value,
      tagline:$('[data-ld41-tagline]', scope)?.value,
      accent:$('[data-ld41-accent]', scope)?.value,
      accent2:$('[data-ld41-accent2]', scope)?.value,
      communityUrl:$('[data-ld41-community]', scope)?.value,
      supportUrl:$('[data-ld41-support]', scope)?.value,
      footerLabel:$('[data-ld41-footer]', scope)?.value,
      logoDataUrl:scope.dataset.logoDataUrl || profile.logoDataUrl,
      showByline:$('[data-ld41-byline-toggle]', scope)?.checked !== false
    });
  }

  function previewProfile(scope, next) {
    const preview = $('[data-ld41-preview]', scope);
    if (!preview) return;
    preview.style.setProperty('--preview-accent', next.accent);
    preview.style.setProperty('--preview-accent-2', next.accent2);
    const img = preview.querySelector('img');
    img.src = next.logoDataUrl || originalLogo();
    preview.querySelector('b').textContent = next.productName;
    preview.querySelector('small').textContent = next.tagline;
    preview.querySelector('em').textContent = next.showByline ? next.footerLabel : 'Byline oculta';
  }

  async function fileToLogo(file) {
    if (!file) return '';
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('Use PNG, JPG ou WebP.');
    if (file.size > 220 * 1024) throw new Error('O logo deve ter no máximo 220 KB.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o logo.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  function studioMarkup() {
    return `<div class="ld41-backdrop" data-ld41-close></div><section class="ld41-studio" role="dialog" aria-modal="true" aria-label="Branding e White-Label">
      <header><div><span>BRANDING PLATFORM</span><h2>Branding & White-Label</h2><small>Personalização local e isolada da interface da extensão.</small></div><button type="button" data-ld41-close aria-label="Fechar">×</button></header>
      <div class="ld41-body">
        <div class="ld41-preview" data-ld41-preview><img src="${esc(profile.logoDataUrl || originalLogo())}" alt=""><div><b>${esc(profile.productName)}</b><small>${esc(profile.tagline)}</small><em>${esc(profile.showByline ? profile.footerLabel : 'Byline oculta')}</em></div></div>
        <div class="ld41-grid">
          <label>Nome do produto<input data-ld41-name value="${esc(profile.productName)}" maxlength="48"></label>
          <label>Nome curto<input data-ld41-short value="${esc(profile.shortName)}" maxlength="24"></label>
          <label class="wide">Tagline<input data-ld41-tagline value="${esc(profile.tagline)}" maxlength="72"></label>
          <label>Cor principal<input type="color" data-ld41-accent value="${esc(profile.accent)}"></label>
          <label>Cor secundária<input type="color" data-ld41-accent2 value="${esc(profile.accent2)}"></label>
          <label class="wide">Comunidade<input type="url" data-ld41-community value="${esc(profile.communityUrl)}" placeholder="https://…"></label>
          <label class="wide">Suporte<input type="url" data-ld41-support value="${esc(profile.supportUrl)}" placeholder="https://…"></label>
          <label class="wide">Rodapé<input data-ld41-footer value="${esc(profile.footerLabel)}" maxlength="80"></label>
          <label class="wide ld41-logo-field">Logo local<input type="file" data-ld41-logo accept="image/png,image/jpeg,image/webp"><small>PNG/JPG/WebP · até 220 KB · armazenado somente no navegador.</small></label>
          <label class="wide ld41-check"><input type="checkbox" data-ld41-byline-toggle ${profile.showByline ? 'checked' : ''}> Exibir rodapé/byline da marca</label>
        </div>
      </div>
      <footer><div><button type="button" data-ld41-export>Copiar perfil</button><button type="button" data-ld41-import>Importar perfil</button><button type="button" class="danger" data-ld41-reset>Restaurar padrão</button></div><button type="button" class="primary" data-ld41-save>Salvar branding</button></footer>
    </section>`;
  }

  async function openStudio() {
    const r = root();
    if (!r) return;
    studio?.remove();
    studio = document.createElement('div');
    studio.className = 'ld41-shell';
    studio.dataset.logoDataUrl = profile.logoDataUrl || '';
    studio.innerHTML = studioMarkup();
    r.appendChild(studio);
    const refresh = () => previewProfile(studio, readStudioForm(studio));
    $$('input:not([type="file"])', studio).forEach(input => input.addEventListener('input', refresh));
    $('[data-ld41-logo]', studio).addEventListener('change', async event => {
      try { studio.dataset.logoDataUrl = await fileToLogo(event.target.files?.[0]); refresh(); }
      catch (error) { event.target.value = ''; toast(error.message, true); }
    });
    studio.addEventListener('click', async event => {
      if (event.target.closest('[data-ld41-close]')) { studio.remove(); studio = null; return; }
      if (event.target.closest('[data-ld41-save]')) {
        await saveProfile(readStudioForm(studio)); toast('Branding salvo e aplicado.'); studio.remove(); studio = null; return;
      }
      if (event.target.closest('[data-ld41-reset]')) {
        if (!confirm('Restaurar a identidade visual padrão do Lovable Decrypter?')) return;
        studio.dataset.logoDataUrl = '';
        await saveProfile(DEFAULT_PROFILE); toast('Branding padrão restaurado.'); studio.remove(); studio = null; return;
      }
      if (event.target.closest('[data-ld41-export]')) {
        try { await navigator.clipboard.writeText(JSON.stringify(readStudioForm(studio), null, 2)); toast('Perfil de branding copiado.'); }
        catch (_) { toast('Não foi possível copiar o perfil.', true); }
        return;
      }
      if (event.target.closest('[data-ld41-import]')) {
        const raw = prompt('Cole o JSON do perfil de branding:');
        if (!raw) return;
        try {
          const imported = sanitize(JSON.parse(raw));
          studio.remove(); studio = null;
          await saveProfile(imported); toast('Perfil importado e aplicado.'); openStudio();
        } catch (_) { toast('Perfil de branding inválido.', true); }
      }
    });
  }

  function installRailButton() {
    const list = root()?.querySelector('.ld3-rail-list');
    if (!list) return false;
    if (list.querySelector('[data-ld41-branding]')) return true;
    const community = list.querySelector('[data-rail-id="community"]');
    const settings = list.querySelector('[data-rail-id="settings"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ld3-rail-btn ld41-branding-rail';
    button.dataset.ld41Branding = '1';
    button.setAttribute('aria-label','Branding & White-Label');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19 15 8l3 3L7 22H4Z"/><path d="m14 5 2-2 5 5-2 2"/><path d="M5 5h5"/><path d="M5 9h3"/></svg><span class="ld3-rail-tip">Branding</span>';
    button.addEventListener('click', event => { event.preventDefault(); openStudio(); });
    if (community) list.insertBefore(button, community);
    else if (settings) list.insertBefore(button, settings);
    else list.appendChild(button);
    return true;
  }

  function installCommunityOverride() {
    const r = root();
    if (!r || r.dataset.ld41CommunityBound === '1') return;
    r.dataset.ld41CommunityBound = '1';
    r.addEventListener('click', event => {
      const button = event.target.closest?.('[data-rail-id="community"]');
      if (!button || profile.communityUrl === DEFAULT_COMMUNITY) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.open(profile.communityUrl, '_blank', 'noopener,noreferrer');
      toast('Abrindo comunidade da marca.');
    }, true);
  }

  function scheduleReconcile() {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => { installRailButton(); installCommunityOverride(); applyProfile(); }, 80);
  }

  async function install() {
    await loadProfile();
    installCommunityOverride();
    applyProfile();
    if (installRailButton()) return true;
    return false;
  }

  const timer = setInterval(async () => {
    installAttempts += 1;
    if (await install() || installAttempts >= 120) clearInterval(timer);
  }, 100);

  window.addEventListener('ld3:design-system-ready', scheduleReconcile);
  window.addEventListener('ld2:dom-reconcile', scheduleReconcile);
  window.addEventListener('ld2:control-center-ready', scheduleReconcile);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[PROFILE_KEY]) { profile = sanitize(changes[PROFILE_KEY].newValue || DEFAULT_PROFILE); scheduleReconcile(); }
  });

  window.LovableDecrypterBranding = Object.freeze({
    build:41,
    open:openStudio,
    get:() => ({ ...profile, logoDataUrl:profile.logoDataUrl ? '[local-image]' : '' }),
    apply:next => saveProfile(next),
    reset:() => saveProfile(DEFAULT_PROFILE)
  });
})();