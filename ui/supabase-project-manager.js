(() => {
  'use strict';
  if (window.__LD2_SUPABASE_PROJECT_MANAGER__) return;
  window.__LD2_SUPABASE_PROJECT_MANAGER__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => window.LovableDecrypterV2?.getProjectId?.() || '';

  function supabaseRuntime(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'ld2-supabase-oauth' });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        try { port.disconnect(); } catch (_) {}
        reject(new Error('A integração Supabase não respondeu dentro do tempo limite.'));
      }, 55000);
      const done = (fn, value) => {
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else {
          const error = new Error(message.error || 'Falha na integração Supabase.');
          error.code = message.code || '';
          error.details = message.details || null;
          done(reject, error);
        }
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }

  function root() { return document.getElementById('ld2-root'); }
  function modal() { return root()?.querySelector('.ld2-modal'); }
  function card() { return root()?.querySelector('.ld2-card'); }
  function close() { modal()?.classList.remove('open'); }
  function open(inner) {
    const m = modal(), c = card();
    if (!m || !c) return null;
    c.innerHTML = `<div class="ld2-sbm">
      <header><div><span class="mark">SB</span><div><small>INTEGRAÇÃO OFICIAL</small><h2>Supabase</h2></div></div><button type="button" data-sbm-close aria-label="Fechar">×</button></header>
      <main>${inner}</main>
    </div>`;
    m.classList.add('open');
    c.querySelector('[data-sbm-close]')?.addEventListener('click', close);
    return c;
  }
  function toast(text, error = false) {
    const wrap = root()?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function loading(text = 'Consultando sua conta Supabase…') {
    open(`<section class="loading"><i></i><b>${esc(text)}</b><small>Tokens OAuth permanecem no backend.</small></section>`);
  }
  function trustedUrl(value) {
    try {
      const u = new URL(String(value || ''));
      return u.protocol === 'https:' && (
        u.hostname === 'api.supabase.com' ||
        u.hostname === 'supabase.com' ||
        u.hostname === 'kkzxxnfxgrouhkzyszxs.supabase.co'
      );
    } catch (_) { return false; }
  }
  async function openPopup(action) {
    const popup = window.open('about:blank', `ld2-supabase-${action}`, 'popup,width=1040,height=820,resizable=yes,scrollbars=yes');
    if (!popup) throw new Error('O navegador bloqueou o pop-up. Permita pop-ups para lovable.dev.');
    try {
      popup.document.title = 'Lovable Decrypter · Supabase';
      popup.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Abrindo Supabase…</p>';
    } catch (_) {}
    try {
      const response = await supabaseRuntime(action);
      if (!trustedUrl(response?.url)) throw new Error('O backend retornou uma URL Supabase não confiável.');
      popup.location.href = response.url;
      return popup;
    } catch (error) {
      try { popup.close(); } catch (_) {}
      throw error;
    }
  }
  async function pollConnection(popup) {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1500));
      if (!modal()?.classList.contains('open')) return;
      try {
        const status = await supabaseRuntime('manager_status');
        if (status?.connected) {
          try { if (popup && !popup.closed) popup.close(); } catch (_) {}
          await render(status);
          toast('Supabase conectado.');
          return;
        }
      } catch (_) {}
      try {
        if (popup?.closed && i > 2) {
          await render();
          return;
        }
      } catch (_) {}
    }
    await render();
  }
  async function connectOrReauthorize() {
    try {
      const popup = await openPopup('connect');
      pollConnection(popup);
    } catch (error) {
      toast(error?.message || String(error), true);
      await render().catch(() => {});
    }
  }
  async function bootstrap() {
    try {
      const popup = await openPopup('bootstrap_start');
      const timer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(timer);
            await render();
          }
        } catch (_) {}
      }, 1200);
    } catch (error) {
      toast(error?.message || String(error), true);
    }
  }
  async function disconnect() {
    try {
      await supabaseRuntime('disconnect');
      const current = await runtime({ type: 'LD2_SETTINGS_GET' });
      await runtime({
        type: 'LD2_SETTINGS_PATCH',
        patch: {
          supabase: { ...(current.supabase || {}), projectRef: '', projectName: '', organizationSlug: '', url: '' }
        }
      });
      toast('Supabase desconectado.');
      await render();
    } catch (error) { toast(error?.message || String(error), true); }
  }
  function currentMapping(settings) {
    const id = projectId();
    return id && settings?.supabaseMappings?.[id] ? settings.supabaseMappings[id] : settings?.supabase || {};
  }
  async function bindProject(status, ref) {
    const project = (status.projects || []).find(item => item.ref === ref);
    if (!project) throw new Error('Projeto Supabase não autorizado.');
    await supabaseRuntime('project_test', { project_ref: project.ref });
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' });
    const id = projectId();
    const selected = {
      projectRef: project.ref,
      projectName: project.name || project.ref,
      organizationSlug: project.organization_slug || '',
      url: project.url || `https://${project.ref}.supabase.co`
    };
    const patch = {
      supabase: { ...(settings.supabase || {}), authMode: 'oauth', ...selected, anonKey: '', managementToken: '' }
    };
    if (id) patch.supabaseMappings = { [id]: selected };
    await runtime({ type: 'LD2_SETTINGS_PATCH', patch });
    toast(`${project.name || project.ref} vinculado ao projeto Lovable atual.`);
    await render();
  }
  function regionOptions(data) {
    const items = [];
    const rec = data?.recommendations?.smartGroup;
    if (rec?.code) items.push({ type: 'smartGroup', code: rec.code, label: `Recomendado · ${rec.name || rec.code}` });
    const allSmart = data?.all?.smartGroup;
    const smartList = Array.isArray(allSmart) ? allSmart : (allSmart ? [allSmart] : []);
    for (const item of smartList) {
      if (item?.code && !items.some(x => x.type === 'smartGroup' && x.code === item.code)) {
        items.push({ type: 'smartGroup', code: item.code, label: `Smart · ${item.name || item.code}` });
      }
    }
    const specific = Array.isArray(data?.all?.specific) ? data.all.specific :
      Array.isArray(data?.recommendations?.specific) ? data.recommendations.specific : [];
    for (const item of specific) {
      if (item?.code) items.push({ type: 'specific', code: item.code, label: `${item.name || item.code} · ${item.code}` });
    }
    return items;
  }
  async function createProjectView(status) {
    const organizations = Array.isArray(status.organizations) ? status.organizations : [];
    if (!organizations.length) {
      open(`<section class="state"><span>!</span><h3>Nenhuma organização disponível</h3><p>Crie uma organização no Supabase e atualize esta tela.</p><button data-sbm-back>Voltar</button></section>`)
        ?.querySelector('[data-sbm-back]')?.addEventListener('click', () => render(status));
      return;
    }
    const c = open(`<section class="create">
      <h3>Criar projeto Supabase</h3>
      <p>O banco é criado pela Management API oficial. A senha Postgres é gerada no backend e armazenada no Vault; ela nunca aparece no Lovable.</p>
      <label>Nome do projeto<input data-sbm-name maxlength="80" placeholder="Meu projeto"></label>
      <label>Organização<select data-sbm-org>${organizations.map(o => `<option value="${esc(o.slug)}">${esc(o.name || o.slug)}</option>`).join('')}</select></label>
      <label>Região<select data-sbm-region disabled><option>Consultando regiões…</option></select></label>
      <div class="actions"><button data-sbm-back>Cancelar</button><button class="primary" data-sbm-create disabled>Criar projeto</button></div>
      <div class="progress" data-sbm-create-progress></div>
    </section>`);
    if (!c) return;
    const org = c.querySelector('[data-sbm-org]');
    const region = c.querySelector('[data-sbm-region]');
    const create = c.querySelector('[data-sbm-create]');
    const progress = c.querySelector('[data-sbm-create-progress]');
    c.querySelector('[data-sbm-back]')?.addEventListener('click', () => render(status));
    async function loadRegions() {
      region.disabled = true; create.disabled = true;
      region.innerHTML = '<option>Consultando regiões…</option>';
      try {
        const response = await supabaseRuntime('regions', { organization_slug: org.value });
        const options = regionOptions(response.regions);
        if (!options.length) throw new Error('O Supabase não retornou regiões disponíveis.');
        region.innerHTML = options.map(x => `<option value="${esc(`${x.type}:${x.code}`)}">${esc(x.label)}</option>`).join('');
        region.disabled = false; create.disabled = false;
      } catch (error) {
        region.innerHTML = `<option>${esc(error?.message || 'Falha ao consultar regiões')}</option>`;
      }
    }
    org.addEventListener('change', loadRegions);
    await loadRegions();
    create.addEventListener('click', async () => {
      const name = String(c.querySelector('[data-sbm-name]')?.value || '').trim();
      if (!name) return toast('Informe o nome do projeto.', true);
      const [regionType, regionCode] = String(region.value || '').split(':');
      create.disabled = true;
      progress.textContent = 'Criando projeto no Supabase…';
      try {
        const out = await supabaseRuntime('create_project', {
          name,
          organization_slug: org.value,
          region_type: regionType,
          region_code: regionCode
        });
        const ref = out?.project?.ref;
        if (!ref) throw new Error('Supabase não retornou o project ref.');
        progress.textContent = `Projeto ${ref} criado. Aguardando serviços ficarem saudáveis…`;
        let ready = false;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const check = await supabaseRuntime('project_status', { project_ref: ref });
          const statusText = String(check?.project?.status || '').toUpperCase();
          const healthText = JSON.stringify(check?.health || {}).toUpperCase();
          progress.textContent = `Provisionando ${ref} · ${statusText || 'aguardando'}`;
          if (statusText === 'ACTIVE_HEALTHY' || /ACTIVE_HEALTHY/.test(healthText)) { ready = true; break; }
        }
        const fresh = await supabaseRuntime('manager_status');
        if (ready) {
          await bindProject(fresh, ref);
        } else {
          toast('Projeto criado, mas ainda está provisionando. Ele já aparece na lista.', true);
          await render(fresh);
        }
      } catch (error) {
        progress.textContent = '';
        toast(error?.message || String(error), true);
        create.disabled = false;
      }
    });
  }
  async function render(supplied = null) {
    loading();
    let status;
    try { status = supplied || await supabaseRuntime('manager_status'); }
    catch (error) {
      const c = open(`<section class="state error"><span>!</span><h3>Falha ao consultar Supabase</h3><p>${esc(error?.message || String(error))}</p><button class="primary" data-sbm-retry>Tentar novamente</button></section>`);
      c?.querySelector('[data-sbm-retry]')?.addEventListener('click', () => render());
      return;
    }
    if (!status.app_configured) {
      const c = open(`<section class="state"><span>SB</span><h3>OAuth App ainda não configurado</h3><p>${status.can_bootstrap ? 'Como proprietário, você pode abrir o bootstrap seguro para cadastrar o Client ID/Secret uma única vez no Vault.' : 'O proprietário precisa configurar o OAuth App do Lovable Decrypter antes de conectar contas Supabase.'}</p>${status.can_bootstrap ? '<button class="primary" data-sbm-bootstrap>Configurar OAuth App</button>' : ''}</section>`);
      c?.querySelector('[data-sbm-bootstrap]')?.addEventListener('click', bootstrap);
      return;
    }
    if (!status.connected) {
      const c = open(`<section class="state"><span>SB</span><h3>Conectar Supabase</h3><p>Abra a autorização oficial do Supabase. O Decrypter não solicita PAT, service_role, anon key ou senha de banco.</p>${status.stale_connection ? '<div class="warning">A autorização anterior expirou ou foi revogada.</div>' : ''}<button class="primary" data-sbm-connect>Autorizar no Supabase</button></section>`);
      c?.querySelector('[data-sbm-connect]')?.addEventListener('click', connectOrReauthorize);
      return;
    }
    if (status.reauthorize_required) {
      const missing = (status.missing_scopes || []).join(', ');
      const c = open(`<section class="state warning-state"><span>↻</span><h3>Reautorização necessária</h3><p>O OAuth App está conectado, mas faltam permissões exigidas por esta Build.</p><div class="scope">${esc(missing || 'escopos atualizados')}</div><button class="primary" data-sbm-connect>Reautorizar no Supabase</button></section>`);
      c?.querySelector('[data-sbm-connect]')?.addEventListener('click', connectOrReauthorize);
      return;
    }

    const settings = await runtime({ type: 'LD2_SETTINGS_GET' }).catch(() => ({}));
    const mapping = currentMapping(settings);
    const projects = Array.isArray(status.projects) ? status.projects : [];
    const selected = mapping?.projectRef || '';
    const account = status.profile?.email || status.profile?.username || 'Conta Supabase';
    const c = open(`<section class="connected">
      <div class="account"><i></i><div><small>CONECTADO</small><b>${esc(account)}</b><p>${status.organizations?.length || 0} organização(ões) · ${projects.length} projeto(s)</p></div></div>
      <label>Projeto Supabase deste Lovable<select data-sbm-project>${projects.length ? projects.map(p => `<option value="${esc(p.ref)}"${p.ref === selected ? ' selected' : ''}>${esc(p.name || p.ref)} · ${esc(p.region || p.status || p.ref)}</option>`).join('') : '<option value="">Nenhum projeto</option>'}</select></label>
      <div class="project-detail" data-sbm-detail></div>
      <div class="actions"><button data-sbm-disconnect>Desconectar</button><button data-sbm-new>+ Criar projeto</button><button class="primary" data-sbm-use ${projects.length ? '' : 'disabled'}>Usar neste projeto</button></div>
    </section>`);
    if (!c) return;
    const select = c.querySelector('[data-sbm-project]');
    const detail = c.querySelector('[data-sbm-detail]');
    function updateDetail() {
      const p = projects.find(x => x.ref === select.value);
      detail.innerHTML = p ? `<b>${esc(p.name || p.ref)}</b><span>${esc(p.ref)} · ${esc(p.organization_slug || 'org')} · ${esc(p.status || 'status desconhecido')}</span>` : 'Nenhum projeto selecionado.';
    }
    select.addEventListener('change', updateDetail); updateDetail();
    c.querySelector('[data-sbm-disconnect]')?.addEventListener('click', disconnect);
    c.querySelector('[data-sbm-new]')?.addEventListener('click', () => createProjectView(status));
    c.querySelector('[data-sbm-use]')?.addEventListener('click', async () => {
      try { await bindProject(status, select.value); }
      catch (error) { toast(error?.message || String(error), true); }
    });
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#ld2-root [data-cc-supabase]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    render();
  }, true);
})();