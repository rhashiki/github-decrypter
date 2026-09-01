(() => {
  'use strict';
  if (window.__LD49_INTEGRATIONS__) return;
  window.__LD49_INTEGRATIONS__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const $ = (s, r = document) => r?.querySelector?.(s) || null;
  const $$ = (s, r = document) => [...(r?.querySelectorAll?.(s) || [])];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const projectId = () => String(window.LovableDecrypterV2?.getProjectId?.() || '');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let overlay = null;
  let current = '';
  let authGeneration = 0;

  function root() { return document.getElementById(ROOT_ID); }
  function notify(text, error = false) {
    const wrap = $('.ld2-toast-wrap', root());
    if (!wrap) return;
    const node = document.createElement('div');
    node.className = `ld2-toast${error ? ' error' : ''}`;
    node.textContent = String(text || '');
    wrap.appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  function portCall(name, action, payload = {}, timeout = 45000) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name });
      const id = crypto.randomUUID();
      let settled = false;
      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      const timer = setTimeout(() => done(reject, new Error('A integração demorou demais para responder.')), timeout);
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) done(resolve, message.data);
        else done(reject, Object.assign(new Error(message.error || 'Falha na integração.'), { code:message.code || '' }));
      });
      port.onDisconnect.addListener(() => {
        if (!settled && chrome.runtime.lastError) done(reject, new Error(chrome.runtime.lastError.message));
      });
      port.postMessage({ id, action, payload });
    });
  }
  const github = (action, payload = {}) => portCall('ld2-github-app', action, payload, 35000);
  const supabase = (action, payload = {}) => portCall('ld2-supabase-oauth', action, payload, 55000);

  function trustedUrl(value, provider) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return false;
      const common = url.hostname === 'kkzxxnfxgrouhkzyszxs.supabase.co';
      if (provider === 'github') return common || url.hostname === 'github.com';
      return common || url.hostname === 'api.supabase.com' || url.hostname === 'supabase.com' || url.hostname.endsWith('.supabase.com');
    } catch (_) { return false; }
  }

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ld49-overlay';
    overlay.innerHTML = '<section class="ld49-modal" role="dialog" aria-modal="true" aria-label="Integrações"><div data-ld49-view></div></section>';
    root()?.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay?.classList.contains('open')) close(); }, true);
    return overlay;
  }
  function close() {
    authGeneration += 1;
    overlay?.classList.remove('open');
    current = '';
  }
  function shell(kind, title, subtitle, body) {
    return `<header class="ld49-head"><div class="ld49-mark ${kind}">${kind === 'github' ? 'GH' : kind === 'supabase' ? 'SB' : kind === 'gemini' ? '✦' : '♥'}</div><div><small>INTEGRAÇÃO</small><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" data-ld49-close aria-label="Fechar">×</button></header><main class="ld49-body">${body}</main>`;
  }
  function render(kind, title, subtitle, body) {
    ensureOverlay();
    const view = $('[data-ld49-view]', overlay);
    view.innerHTML = shell(kind, title, subtitle, body);
    $('[data-ld49-close]', view).onclick = close;
    overlay.classList.add('open');
    current = kind;
    return view;
  }
  function loading(kind, title, text) {
    return render(kind, title, 'Conexão oficial do Lovable Decrypter', `<div class="ld49-state"><i class="ld49-spin"></i><h3>${esc(text)}</h3><p>Aguarde enquanto o estado é reconciliado com o backend.</p></div>`);
  }
  function openAuthTab(url, provider) {
    if (!trustedUrl(url, provider)) throw new Error('O backend retornou uma URL de autorização não confiável.');
    const tab = window.open(url, '_blank', 'noopener,noreferrer');
    if (!tab) throw new Error('O navegador bloqueou a nova aba. Permita a abertura de abas para lovable.dev.');
  }
  async function pollUntil(kind, read, predicate, onDone, generation, attempts = 80) {
    for (let i = 0; i < attempts; i++) {
      await wait(1500);
      if (!overlay?.classList.contains('open') || current !== kind || generation !== authGeneration) return;
      try {
        const state = await read();
        if (predicate(state)) { await onDone(state); return; }
      } catch (_) {}
    }
    if (generation === authGeneration && current === kind) notify('A autorização ainda não foi confirmada. Você pode atualizar o estado nesta tela.', true);
  }

  async function beginGithubAuth() {
    try {
      const generation = ++authGeneration;
      const flow = await github('connect');
      openAuthTab(flow?.url, 'github');
      const view = render('github', 'GitHub', 'Autorização em andamento', `<div class="ld49-state"><span class="ld49-orbit"></span><h3>Aguardando o GitHub</h3><p>Conclua a autorização na nova aba. Esta tela será atualizada automaticamente.</p><button class="secondary" data-refresh>Atualizar agora</button></div>`);
      $('[data-refresh]', view).onclick = () => openGithub();
      pollUntil('github', () => github('status'), state => state?.connected || state?.app_configured, () => openGithub(), generation).catch(() => {});
    } catch (error) { notify(error?.message || String(error), true); openGithub().catch(() => {}); }
  }

  async function saveGithubRepository(status, fullName) {
    const repo = (status.repositories || []).find(item => item.full_name === fullName);
    if (!repo || !status.installation?.id) throw new Error('Selecione um repositório autorizado.');
    const settings = await runtime({ type:'LD2_SETTINGS_GET' });
    const githubSettings = {
      ...(settings.github || {}), authMode:'github_app', installationId:Number(status.installation.id),
      accountLogin:String(status.installation.account_login || ''), appSlug:String(status.app?.slug || ''), token:'',
      owner:String(repo.owner || repo.full_name.split('/')[0] || ''), repo:String(repo.name || repo.full_name.split('/')[1] || ''),
      branch:String(repo.default_branch || 'main'), createBranch:false, createPr:false
    };
    const patch = { github:githubSettings };
    if (projectId()) patch.projectMappings = { [projectId()]: { owner:githubSettings.owner, repo:githubSettings.repo, branch:githubSettings.branch } };
    await runtime({ type:'LD2_SETTINGS_PATCH', patch });
    window.dispatchEvent(new CustomEvent('ld2:github-connected', { detail:{ fullName:repo.full_name } }));
    notify(`${repo.full_name} conectado.`);
  }

  async function openGithub() {
    loading('github', 'GitHub', 'Consultando GitHub…');
    let status;
    try { status = await github('status'); }
    catch (error) {
      const view = render('github','GitHub','Conta, autorização e repositório',`<div class="ld49-state error"><h3>Não foi possível consultar o GitHub</h3><p>${esc(error?.message || String(error))}</p><button class="primary" data-retry>Tentar novamente</button></div>`);
      $('[data-retry]', view).onclick = openGithub; return;
    }
    if (!status.app_configured) {
      const view = render('github','GitHub','Configuração inicial do GitHub App',`<div class="ld49-state"><div class="ld49-bigmark">GH</div><h3>GitHub App ainda não configurado</h3><p>${status.can_bootstrap ? 'A configuração oficial será aberta em uma nova aba. Depois de concluir no GitHub, esta tela detectará o App automaticamente.' : 'A configuração inicial precisa ser concluída pelo proprietário.'}</p>${status.can_bootstrap ? '<button class="primary" data-connect>Criar GitHub App</button>' : ''}</div>`);
      $('[data-connect]', view)?.addEventListener('click', beginGithubAuth); return;
    }
    if (!status.connected) {
      const view = render('github','GitHub','Autorize os repositórios que o Decrypter poderá acessar',`<div class="ld49-state"><div class="ld49-bigmark">GH</div><h3>Autorizar GitHub</h3><p>Escolha no GitHub todos os repositórios ou apenas os que deseja disponibilizar ao Decrypter.</p><button class="primary" data-connect>Autorizar em nova aba</button></div>`);
      $('[data-connect]', view).onclick = beginGithubAuth; return;
    }
    const settings = await runtime({ type:'LD2_SETTINGS_GET' }).catch(() => ({}));
    const selected = settings.github?.owner && settings.github?.repo ? `${settings.github.owner}/${settings.github.repo}` : '';
    const repos = Array.isArray(status.repositories) ? status.repositories : [];
    const view = render('github','GitHub','Conta autorizada e sincronização do projeto',`
      <section class="ld49-summary"><div><small>CONTA</small><b>${esc(status.installation?.account_login || 'GitHub')}</b></div><div><small>REPOSITÓRIOS</small><b>${repos.length}</b></div><div><small>STATUS</small><b class="ok">Conectado</b></div></section>
      <label class="ld49-field"><span>Repositório deste projeto</span><select data-repo>${repos.map(repo => `<option value="${esc(repo.full_name)}" ${repo.full_name === selected ? 'selected' : ''}>${esc(repo.full_name)}${repo.private ? ' · privado' : ''}</option>`).join('')}</select></label>
      <div class="ld49-actions"><button class="secondary" data-reauth>Alterar autorização</button><button class="primary" data-save ${repos.length ? '' : 'disabled'}>Usar repositório</button></div>`);
    $('[data-reauth]', view).onclick = beginGithubAuth;
    $('[data-save]', view).onclick = async () => { try { await saveGithubRepository(status, $('[data-repo]',view).value); await openGithub(); } catch (e) { notify(e.message,true); } };
  }

  async function beginSupabaseAuth(action) {
    try {
      const generation = ++authGeneration;
      const flow = await supabase(action);
      openAuthTab(flow?.url, 'supabase');
      const view = render('supabase','Supabase','Autorização em andamento',`<div class="ld49-state"><span class="ld49-orbit"></span><h3>Aguardando o Supabase</h3><p>Conclua a configuração na nova aba. O Decrypter continuará verificando o backend.</p><button class="secondary" data-refresh>Atualizar agora</button></div>`);
      $('[data-refresh]', view).onclick = openSupabase;
      pollUntil('supabase', () => supabase('manager_status'), state => action === 'bootstrap_start' ? state?.app_configured : state?.connected, () => openSupabase(), generation).catch(() => {});
    } catch (error) { notify(error?.message || String(error), true); openSupabase().catch(() => {}); }
  }

  async function bindSupabaseProject(status, ref) {
    const project = (status.projects || []).find(item => item.ref === ref);
    if (!project) throw new Error('Projeto Supabase não autorizado.');
    await supabase('project_test', { project_ref:project.ref });
    const settings = await runtime({ type:'LD2_SETTINGS_GET' });
    const selected = { projectRef:project.ref, projectName:project.name || project.ref, organizationSlug:project.organization_slug || '', url:project.url || `https://${project.ref}.supabase.co` };
    const patch = { supabase:{ ...(settings.supabase || {}), authMode:'oauth', ...selected, anonKey:'', managementToken:'' } };
    if (projectId()) patch.supabaseMappings = { [projectId()]:selected };
    await runtime({ type:'LD2_SETTINGS_PATCH', patch });
    window.dispatchEvent(new CustomEvent('ld2:supabase-connected', { detail:selected }));
    notify(`${selected.projectName} conectado.`);
  }

  async function openSupabase() {
    loading('supabase','Supabase','Consultando Supabase…');
    let status;
    try { status = await supabase('manager_status'); }
    catch (error) {
      const view = render('supabase','Supabase','OAuth e projeto conectado',`<div class="ld49-state error"><h3>Não foi possível consultar o Supabase</h3><p>${esc(error?.message || String(error))}</p><button class="primary" data-retry>Tentar novamente</button></div>`);
      $('[data-retry]',view).onclick = openSupabase; return;
    }
    if (!status.app_configured) {
      const view = render('supabase','Supabase','Configuração inicial do OAuth App',`<div class="ld49-state"><div class="ld49-bigmark sb">SB</div><h3>OAuth App ainda não configurado</h3><p>${status.can_bootstrap ? 'Abra a configuração segura em uma nova aba. O Client ID/Secret será armazenado no Vault do backend, não na extensão.' : 'O proprietário precisa concluir a configuração OAuth.'}</p>${status.can_bootstrap ? '<button class="primary" data-bootstrap>Configurar OAuth App</button>' : ''}</div>`);
      $('[data-bootstrap]',view)?.addEventListener('click', () => beginSupabaseAuth('bootstrap_start')); return;
    }
    if (!status.connected || status.reauthorize_required) {
      const view = render('supabase','Supabase','Autorize sua conta Supabase',`<div class="ld49-state"><div class="ld49-bigmark sb">SB</div><h3>${status.reauthorize_required ? 'Reautorização necessária' : 'Conectar Supabase'}</h3><p>A autorização oficial será aberta em uma nova aba. Nenhuma service_role, PAT ou senha de banco é solicitada pela extensão.</p><button class="primary" data-connect>${status.reauthorize_required ? 'Reautorizar' : 'Autorizar Supabase'}</button></div>`);
      $('[data-connect]',view).onclick = () => beginSupabaseAuth('connect'); return;
    }
    const settings = await runtime({ type:'LD2_SETTINGS_GET' }).catch(() => ({}));
    const mapping = projectId() && settings.supabaseMappings?.[projectId()] ? settings.supabaseMappings[projectId()] : settings.supabase || {};
    const projects = Array.isArray(status.projects) ? status.projects : [];
    const view = render('supabase','Supabase','Conta autorizada e projeto conectado',`
      <section class="ld49-summary"><div><small>STATUS</small><b class="ok">Conectado</b></div><div><small>PROJETOS</small><b>${projects.length}</b></div><div><small>ATUAL</small><b>${esc(mapping.projectName || mapping.projectRef || '—')}</b></div></section>
      <label class="ld49-field"><span>Projeto Supabase deste Lovable</span><select data-project>${projects.map(p => `<option value="${esc(p.ref)}" ${p.ref === mapping.projectRef ? 'selected' : ''}>${esc(p.name || p.ref)} · ${esc(p.ref)}</option>`).join('')}</select></label>
      <div class="ld49-actions"><button class="secondary" data-reauth>Reautorizar conta</button><button class="primary" data-save ${projects.length ? '' : 'disabled'}>Usar projeto</button></div>`);
    $('[data-reauth]',view).onclick = () => beginSupabaseAuth('connect');
    $('[data-save]',view).onclick = async () => { try { await bindSupabaseProject(status,$('[data-project]',view).value); await openSupabase(); } catch(e){ notify(e.message,true); } };
  }

  async function openLovable(mode = 'overview') {
    const context = window.LovableDecrypterProjectRuntime?.getContext?.() || {};
    const workspace = window.LovableDecrypterWorkspace;
    if (mode === 'create') return createLovableProject();
    const view = render('lovable','Lovable','Projeto e workspace atuais',`
      <section class="ld49-summary"><div><small>PROJETO</small><b>${esc(context.projectId || projectId() || 'Não identificado')}</b></div><div><small>GITSYNC</small><b>${esc(context.gitSync?.fullName || 'Não conectado')}</b></div><div><small>BRANCH</small><b>${esc(context.gitSync?.branch || '—')}</b></div></section>
      <div class="ld49-callout"><b>Workspace do projeto</b><p>Consulte arquivos, contexto e informações reais do projeto sem abrir um segundo painel legado.</p></div>
      <div class="ld49-actions"><button class="secondary" data-workspace ${workspace?.open ? '' : 'disabled'}>Abrir Workspace</button><button class="primary" data-new>Novo projeto</button></div>`);
    $('[data-workspace]',view).onclick = () => { close(); workspace?.open?.(); };
    $('[data-new]',view).onclick = createLovableProject;
  }

  async function createLovableProject() {
    const creator = window.LovableDecrypterProjectCreator;
    if (!creator?.listWorkspaces || !creator?.createProject) {
      return render('lovable','Lovable','Criar projeto',`<div class="ld49-state error"><h3>Project Creator indisponível</h3><p>Recarregue a página e tente novamente.</p></div>`);
    }
    loading('lovable','Lovable','Lendo workspaces…');
    try {
      const result = await creator.listWorkspaces();
      const list = Array.isArray(result?.workspaces) ? result.workspaces : [];
      const view = render('lovable','Lovable','Criar projeto vazio',`
        <label class="ld49-field"><span>Nome</span><input data-name maxlength="80" placeholder="Meu novo projeto"></label>
        <label class="ld49-field"><span>Workspace</span><select data-workspace>${list.map(ws => `<option value="${esc(ws.id)}">${esc(ws.name)} · Build ${esc(ws.totalRemaining ?? '—')} · Diário ${esc(ws.dailyRemaining ?? '—')}</option>`).join('')}</select></label>
        <div class="ld49-callout"><b>Sem prompt automático</b><p>A operação cria apenas um projeto Modern, privado e vazio no Lovable.</p></div>
        <div class="ld49-actions"><button class="secondary" data-back>Voltar</button><button class="primary" data-create ${list.length ? '' : 'disabled'}>Criar projeto</button></div>`);
      $('[data-back]',view).onclick = () => openLovable();
      $('[data-create]',view).onclick = async button => {
        const name = $('[data-name]',view).value.trim(); if (!name) return notify('Informe o nome do projeto.',true);
        const id = $('[data-workspace]',view).value; const target = button.currentTarget; target.disabled = true; target.textContent = 'Criando…';
        try {
          const created = await creator.createProject({ workspaceId:id, name });
          const done = render('lovable','Lovable','Projeto criado',`<div class="ld49-state success"><div class="ld49-success">✓</div><h3>${esc(created.name || name)}</h3><p>Projeto criado sem envio automático de prompt.</p><button class="primary" data-open>Abrir projeto</button></div>`);
          $('[data-open]',done).onclick = () => { const url=String(created.url||''); if(/^https:\/\/lovable\.dev\/projects\/[a-z0-9-]+$/i.test(url)) location.assign(url); };
        } catch(e){ notify(e.message||String(e),true); target.disabled=false; target.textContent='Criar projeto'; }
      };
    } catch (error) { render('lovable','Lovable','Criar projeto',`<div class="ld49-state error"><h3>Não foi possível ler seus workspaces</h3><p>${esc(error?.message || String(error))}</p><button class="primary" data-retry>Tentar novamente</button></div>`); $('[data-retry]',overlay).onclick=createLovableProject; }
  }

  const SAFE_FREE_MODELS = ['gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'];
  async function openGemini() {
    const settings = await runtime({ type:'LD2_SETTINGS_GET' });
    const gem = settings.gemini || {};
    const models = [...new Set([gem.model, gem.advancedModel, ...SAFE_FREE_MODELS].filter(Boolean))];
    const view = render('gemini','Gemini','IA do Decrypter · somente Free Tier',`
      <div class="ld49-zero"><b>ZERO COST</b><span>Nenhum fallback pago é permitido. Se a cota gratuita acabar, a operação para e informa o motivo.</span></div>
      <label class="ld49-field"><span>API Key</span><input type="password" data-key value="${esc(gem.apiKey || '')}" autocomplete="off" placeholder="AIza…"></label>
      <div class="ld49-grid"><label class="ld49-field"><span>Modelo principal</span><select data-model>${models.map(id=>`<option value="${esc(id)}" ${id===gem.model?'selected':''}>${esc(id)}</option>`).join('')}</select></label><label class="ld49-field"><span>Modelo avançado</span><select data-advanced>${models.map(id=>`<option value="${esc(id)}" ${id===gem.advancedModel?'selected':''}>${esc(id)}</option>`).join('')}</select></label></div>
      <div class="ld49-status" data-status>Use “Atualizar modelos” para consultar os modelos compatíveis da sua chave sem executar um prompt.</div>
      <div class="ld49-actions"><button class="secondary" data-models>Atualizar modelos</button><button class="secondary" data-test>Testar conexão</button><button class="primary" data-save>Salvar</button></div>`);
    const read = () => ({ apiKey:$('[data-key]',view).value.trim(), model:$('[data-model]',view).value, advancedModel:$('[data-advanced]',view).value, maxOutputTokens:Number(gem.maxOutputTokens || 32768), billingMode:'free', zeroCost:true, dynamicModels:true });
    $('[data-save]',view).onclick = async () => { try { await runtime({type:'LD2_SETTINGS_PATCH',patch:{gemini:{...gem,...read()}}}); $('[data-status]',view).textContent='Configuração salva em modo gratuito.'; } catch(e){ notify(e.message,true); } };
    $('[data-test]',view).onclick = async () => { const st=$('[data-status]',view); st.textContent='Testando conexão…'; try { const out=await runtime({type:'LD2_GEMINI_TEST',config:{...gem,...read()}}); st.textContent=`Conexão concluída · ${out?.text || 'OK'}`; } catch(e){ st.textContent=`Falha: ${e.message||String(e)}`; } };
    $('[data-models]',view).onclick = async () => {
      const st=$('[data-status]',view); st.textContent='Consultando modelos…';
      try {
        const out=await runtime({type:'LD2_GEMINI_MODELS',config:{...gem,...read()}}); const free=(out.models||[]).filter(m=>m.compatible!==false&&m.freeTierVerified);
        if(!free.length) throw new Error('Nenhum modelo Free Tier compatível foi retornado.');
        for(const sel of [$('[data-model]',view),$('[data-advanced]',view)]){const chosen=sel.value;sel.innerHTML=free.map(m=>`<option value="${esc(m.id)}" ${m.id===chosen?'selected':''}>${esc(m.displayName||m.id)} · FREE</option>`).join('');if(!sel.value)sel.value=free[0].id;}
        st.textContent=`${free.length} modelo(s) Free Tier compatíveis encontrados.`;
      } catch(e){st.textContent=`Falha: ${e.message||String(e)}`;}
    };
  }

  function installProviders() {
    const registry = window.LovableDecrypterUIActions;
    if (!registry?.register) return false;
    registry.register('github', openGithub);
    registry.register('github-sync', openGithub);
    registry.register('supabase', openSupabase);
    registry.register('lovable', () => openLovable('overview'));
    registry.register('lovable-new-project', () => openLovable('create'));
    registry.register('gemini', openGemini);
    return true;
  }

  window.LovableDecrypterIntegrations = Object.freeze({ build:49, version:VERSION, github:openGithub, supabase:openSupabase, lovable:openLovable, gemini:openGemini, close });
  if (!installProviders()) window.addEventListener('ld48:action-registered', installProviders, { once:false });
  window.addEventListener('ld2:ui-mounted', installProviders);
})();
