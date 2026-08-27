(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CONTROL_CENTER__) return;
  window.__LOVABLE_DECRYPTER_CONTROL_CENTER__ = true;

  const VERSION = chrome.runtime.getManifest().version;
  const ROOT_ID = 'ld2-root';
  const MOUNT_ATTR = 'data-ld2-control-center';
  const LICENSE_TIMEOUT_MS = 8000;
  const GITHUB_POLL_MS = 1500;
  const GITHUB_POLL_LIMIT = 60;
  const SUPABASE_POLL_MS = 1500;
  const SUPABASE_POLL_LIMIT = 60;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

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

  function githubRuntime(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'ld2-github-app' });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        try { port.disconnect(); } catch (_) {}
        reject(new Error('A integração GitHub não respondeu dentro do tempo limite.'));
      }, 35000);

      const finish = fn => value => {
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };

      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve)(message.data);
        else finish(reject)(new Error(message.error || 'Falha na integração GitHub.'));
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          clearTimeout(timer);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
      port.postMessage({ id, action, payload });
    });
  }


  function supabaseRuntime(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'ld2-supabase-oauth' });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        try { port.disconnect(); } catch (_) {}
        reject(new Error('A integração Supabase não respondeu dentro do tempo limite.'));
      }, 40000);
      const finish = fn => value => {
        clearTimeout(timer);
        try { port.disconnect(); } catch (_) {}
        fn(value);
      };
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message.ok) finish(resolve)(message.data);
        else finish(reject)(new Error(message.error || 'Falha na integração Supabase.'));
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          clearTimeout(timer);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
      port.postMessage({ id, action, payload });
    });
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

  function openModal(root, html) {
    const modal = $('.ld2-modal', root);
    const card = $('.ld2-card', root);
    if (!modal || !card) return null;
    card.innerHTML = html;
    modal.classList.add('open');
    return { modal, card };
  }

  function closeModal(root) {
    $('.ld2-modal', root)?.classList.remove('open');
  }

  function githubModalShell(inner) {
    return `
      <div class="ld2-gh-modal">
        <div class="ld2-gh-head">
          <div><span class="ld2-gh-mark">GH</span><div><small>INTEGRAÇÃO OFICIAL</small><h2>GitHub</h2></div></div>
          <button type="button" class="ld2-gh-close" data-gh-close aria-label="Fechar">×</button>
        </div>
        <div class="ld2-gh-body">${inner}</div>
      </div>`;
  }

  function githubLoading(root, text = 'Consultando autorização no GitHub…') {
    const view = openModal(root, githubModalShell(`
      <div class="ld2-gh-loading"><span></span><b>${esc(text)}</b><small>Nenhum token pessoal é necessário.</small></div>`));
    view?.card.querySelector('[data-gh-close]')?.addEventListener('click', () => closeModal(root));
    return view;
  }

  function repositoryOption(repo, selectedFullName) {
    const selected = repo.full_name === selectedFullName ? ' selected' : '';
    const privacy = repo.private ? ' · privado' : ' · público';
    return `<option value="${esc(repo.full_name)}"${selected}>${esc(repo.full_name)}${privacy}</option>`;
  }

  async function saveSelectedRepository(root, status, repository) {
    if (!repository || !status?.installation?.id) throw new Error('Selecione um repositório autorizado.');
    const current = await runtime({ type: 'LD2_SETTINGS_GET' });
    const projectId = window.LovableDecrypterV2?.getProjectId?.() || '';
    const github = {
      ...(current.github || {}),
      authMode: 'github_app',
      installationId: Number(status.installation.id),
      accountLogin: String(status.installation.account_login || ''),
      appSlug: String(status.app?.slug || ''),
      token: '',
      owner: String(repository.owner || repository.full_name.split('/')[0] || ''),
      repo: String(repository.name || repository.full_name.split('/')[1] || ''),
      branch: String(repository.default_branch || 'main'),
      createBranch: false,
      createPr: false
    };
    const patch = { github };
    if (projectId) {
      patch.projectMappings = {
        [projectId]: {
          owner: github.owner,
          repo: github.repo,
          branch: github.branch
        }
      };
    }
    await runtime({ type: 'LD2_SETTINGS_PATCH', patch });
    toast(root, `${repository.full_name} conectado ao projeto atual.`);
  }

  function trustedGithubFlowUrl(value) {
    let url;
    try { url = new URL(String(value || '')); } catch { return false; }
    return url.protocol === 'https:' && (
      url.hostname === 'github.com' ||
      url.hostname === 'kkzxxnfxgrouhkzyszxs.supabase.co'
    );
  }

  async function beginGithubAuthorization(root) {
    const popup = window.open('about:blank', 'ld2-github-auth', 'popup,width=1080,height=800,resizable=yes,scrollbars=yes');
    if (!popup) {
      toast(root, 'O navegador bloqueou o pop-up do GitHub. Permita pop-ups para lovable.dev e tente novamente.', true);
      return;
    }
    try {
      popup.document.title = 'Conectando ao GitHub…';
      popup.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Abrindo autorização oficial do GitHub…</p>';
    } catch (_) {}

    try {
      const flow = await githubRuntime('connect');
      if (!trustedGithubFlowUrl(flow?.url)) throw new Error('O backend retornou uma URL de autorização não confiável.');
      popup.location.href = flow.url;
      pollGithubConnection(root, popup);
    } catch (error) {
      try { popup.close(); } catch (_) {}
      toast(root, error?.message || String(error), true);
      await renderGithubModal(root).catch(() => {});
    }
  }

  async function pollGithubConnection(root, popup) {
    for (let attempt = 0; attempt < GITHUB_POLL_LIMIT; attempt++) {
      await new Promise(resolve => setTimeout(resolve, GITHUB_POLL_MS));
      const modal = $('.ld2-modal', root);
      if (!modal?.classList.contains('open')) return;
      try {
        const status = await githubRuntime('status');
        if (status?.connected) {
          try { if (popup && !popup.closed) popup.close(); } catch (_) {}
          await renderGithubModal(root, status);
          toast(root, 'GitHub autorizado. Agora selecione o repositório deste projeto.');
          return;
        }
      } catch (_) {}
      try {
        if (popup?.closed && attempt > 2) {
          await renderGithubModal(root);
          return;
        }
      } catch (_) {}
    }
    await renderGithubModal(root).catch(() => {});
  }

  async function disconnectGithub(root) {
    try {
      await githubRuntime('disconnect');
      const current = await runtime({ type: 'LD2_SETTINGS_GET' });
      await runtime({
        type: 'LD2_SETTINGS_PATCH',
        patch: {
          github: {
            ...(current.github || {}),
            authMode: 'github_app',
            installationId: null,
            accountLogin: '',
            appSlug: '',
            token: '',
            owner: '',
            repo: '',
            branch: 'main',
            createBranch: false,
            createPr: false
          }
        }
      });
      toast(root, 'GitHub desconectado do Lovable Decrypter.');
      await renderGithubModal(root);
    } catch (error) {
      toast(root, error?.message || String(error), true);
    }
  }

  async function renderGithubModal(root, suppliedStatus = null) {
    githubLoading(root);
    let status;
    try {
      status = suppliedStatus || await githubRuntime('status');
    } catch (error) {
      const view = openModal(root, githubModalShell(`
        <div class="ld2-gh-error"><b>Não foi possível consultar o GitHub</b><p>${esc(error?.message || String(error))}</p><button type="button" class="primary" data-gh-retry>Tentar novamente</button></div>`));
      view?.card.querySelector('[data-gh-close]')?.addEventListener('click', () => closeModal(root));
      view?.card.querySelector('[data-gh-retry]')?.addEventListener('click', () => renderGithubModal(root));
      return;
    }

    if (!status.app_configured) {
      const canBootstrap = !!status.can_bootstrap;
      const view = openModal(root, githubModalShell(`
        <div class="ld2-gh-state">
          <span class="ld2-gh-state-icon">${canBootstrap ? '↗' : '!'}</span>
          <h3>${canBootstrap ? 'Criar integração GitHub' : 'GitHub App ainda não configurado'}</h3>
          <p>${canBootstrap
            ? 'Na primeira configuração, o GitHub abrirá sua página oficial para criar o GitHub App do Lovable Decrypter. Em seguida você escolherá quais repositórios podem ser acessados.'
            : 'A integração precisa ser criada pelo proprietário do Lovable Decrypter antes que esta licença possa autorizar repositórios.'}</p>
          ${canBootstrap ? '<button type="button" class="primary" data-gh-connect>Criar GitHub App no GitHub</button>' : ''}
        </div>`));
      view?.card.querySelector('[data-gh-close]')?.addEventListener('click', () => closeModal(root));
      view?.card.querySelector('[data-gh-connect]')?.addEventListener('click', () => beginGithubAuthorization(root));
      return;
    }

    if (!status.connected) {
      const view = openModal(root, githubModalShell(`
        <div class="ld2-gh-state">
          <span class="ld2-gh-state-icon">GH</span>
          <h3>Autorize seus repositórios</h3>
          <p>O GitHub abrirá a instalação oficial do <b>${esc(status.app?.name || 'Lovable Decrypter')}</b>. Lá você escolhe <b>Todos os repositórios</b> ou <b>Somente repositórios selecionados</b>.</p>
          ${status.stale_installation ? '<div class="ld2-gh-warning">A instalação anterior não existe mais no GitHub. Autorize novamente.</div>' : ''}
          <button type="button" class="primary" data-gh-connect>Autorizar no GitHub</button>
        </div>`));
      view?.card.querySelector('[data-gh-close]')?.addEventListener('click', () => closeModal(root));
      view?.card.querySelector('[data-gh-connect]')?.addEventListener('click', () => beginGithubAuthorization(root));
      return;
    }

    const repositories = Array.isArray(status.repositories) ? status.repositories : [];
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' }).catch(() => ({}));
    const selectedFullName = settings.github?.owner && settings.github?.repo
      ? `${settings.github.owner}/${settings.github.repo}`
      : '';
    const account = status.installation?.account_login || 'GitHub';
    const selection = status.installation?.repository_selection === 'all' ? 'Todos os repositórios' : 'Repositórios selecionados';

    const view = openModal(root, githubModalShell(`
      <div class="ld2-gh-connected">
        <div class="ld2-gh-account"><span class="ready"></span><div><small>CONECTADO</small><b>${esc(account)}</b><p>${esc(selection)} · ${repositories.length} disponível(is)</p></div></div>
        <label class="ld2-gh-field"><span>Repositório deste projeto</span>
          <select data-gh-repository ${repositories.length ? '' : 'disabled'}>
            ${repositories.length ? repositories.map(repo => repositoryOption(repo, selectedFullName)).join('') : '<option>Nenhum repositório autorizado</option>'}
          </select>
        </label>
        <div class="ld2-gh-repo-detail" data-gh-repo-detail></div>
        <div class="ld2-gh-actions">
          <button type="button" class="primary" data-gh-use-repo ${repositories.length ? '' : 'disabled'}>Usar neste projeto</button>
          <button type="button" data-gh-manage>Gerenciar repositórios no GitHub</button>
          <button type="button" class="danger" data-gh-disconnect>Desconectar</button>
        </div>
        <small class="ld2-gh-foot">A extensão usa token temporário da instalação. Nenhum PAT é armazenado no fluxo normal.</small>
      </div>`));

    const card = view?.card;
    card?.querySelector('[data-gh-close]')?.addEventListener('click', () => closeModal(root));
    const select = card?.querySelector('[data-gh-repository]');
    const detail = card?.querySelector('[data-gh-repo-detail]');

    const updateDetail = () => {
      const repo = repositories.find(item => item.full_name === select?.value) || repositories[0];
      if (!detail) return;
      detail.innerHTML = repo
        ? `<b>${esc(repo.full_name)}</b><span>${repo.private ? 'Privado' : 'Público'} · branch padrão: ${esc(repo.default_branch || 'main')}</span>`
        : 'Nenhum repositório disponível.';
    };
    select?.addEventListener('change', updateDetail);
    updateDetail();

    card?.querySelector('[data-gh-use-repo]')?.addEventListener('click', async buttonEvent => {
      const button = buttonEvent.currentTarget;
      const repo = repositories.find(item => item.full_name === select?.value) || repositories[0];
      if (!repo) return;
      button.disabled = true;
      button.textContent = 'Validando acesso…';
      try {
        await saveSelectedRepository(root, status, repo);
        const verified = await runtime({ type: 'LD2_GITHUB_TEST', projectId: window.LovableDecrypterV2?.getProjectId?.() || '' });
        toast(root, `GitHub pronto: ${verified?.name || repo.full_name}`);
        button.textContent = 'Repositório conectado ✓';
        setTimeout(() => closeModal(root), 900);
      } catch (error) {
        toast(root, error?.message || String(error), true);
        button.disabled = false;
        button.textContent = 'Usar neste projeto';
      }
    });

    card?.querySelector('[data-gh-manage]')?.addEventListener('click', () => {
      const manageUrl = String(status.installation?.manage_url || '');
      let parsed;
      try { parsed = new URL(manageUrl); } catch { parsed = null; }
      if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
        return toast(root, 'URL de gerenciamento do GitHub inválida.', true);
      }
      window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
    });

    card?.querySelector('[data-gh-disconnect]')?.addEventListener('click', () => disconnectGithub(root));
  }


  function supabaseModalShell(inner) {
    return `
      <div class="ld2-gh-modal ld2-sb-modal">
        <div class="ld2-gh-head">
          <div><span class="ld2-gh-mark">SB</span><div><small>INTEGRAÇÃO OFICIAL</small><h2>Supabase</h2></div></div>
          <button type="button" class="ld2-gh-close" data-sb-close aria-label="Fechar">×</button>
        </div>
        <div class="ld2-gh-body">${inner}</div>
      </div>`;
  }

  function supabaseLoading(root, text = 'Consultando autorização no Supabase…') {
    const view = openModal(root, supabaseModalShell(`
      <div class="ld2-gh-loading"><span></span><b>${esc(text)}</b><small>Tokens OAuth ficam somente no backend do Decrypter.</small></div>`));
    view?.card.querySelector('[data-sb-close]')?.addEventListener('click', () => closeModal(root));
    return view;
  }

  function trustedSupabaseFlowUrl(value) {
    let url;
    try { url = new URL(String(value || '')); } catch { return false; }
    return url.protocol === 'https:' && url.hostname === 'api.supabase.com' && url.pathname.startsWith('/v1/oauth/authorize');
  }

  async function beginSupabaseAuthorization(root) {
    const popup = window.open('about:blank', 'ld2-supabase-auth', 'popup,width=1080,height=800,resizable=yes,scrollbars=yes');
    if (!popup) return toast(root, 'O navegador bloqueou o pop-up do Supabase. Permita pop-ups para lovable.dev e tente novamente.', true);
    try {
      popup.document.title = 'Conectando ao Supabase…';
      popup.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Abrindo autorização oficial do Supabase…</p>';
    } catch (_) {}
    try {
      const flow = await supabaseRuntime('connect');
      if (!trustedSupabaseFlowUrl(flow?.url)) throw new Error('O backend retornou uma URL de autorização Supabase não confiável.');
      popup.location.href = flow.url;
      pollSupabaseConnection(root, popup);
    } catch (error) {
      try { popup.close(); } catch (_) {}
      toast(root, error?.message || String(error), true);
      await renderSupabaseModal(root).catch(() => {});
    }
  }

  async function pollSupabaseConnection(root, popup) {
    for (let attempt = 0; attempt < SUPABASE_POLL_LIMIT; attempt++) {
      await new Promise(resolve => setTimeout(resolve, SUPABASE_POLL_MS));
      const modal = $('.ld2-modal', root);
      if (!modal?.classList.contains('open')) return;
      try {
        const status = await supabaseRuntime('status');
        if (status?.connected) {
          try { if (popup && !popup.closed) popup.close(); } catch (_) {}
          await renderSupabaseModal(root, status);
          toast(root, 'Supabase autorizado. Agora selecione o projeto deste Lovable.');
          return;
        }
      } catch (_) {}
      try {
        if (popup?.closed && attempt > 2) {
          await renderSupabaseModal(root);
          return;
        }
      } catch (_) {}
    }
    await renderSupabaseModal(root).catch(() => {});
  }

  async function saveSelectedSupabaseProject(root, project) {
    if (!project?.ref) throw new Error('Selecione um projeto Supabase autorizado.');
    const pid = window.LovableDecrypterV2?.getProjectId?.() || '';
    await runtime({ type: 'LD2_SUPABASE_TEST', projectRef: project.ref, projectId: pid });
    const current = await runtime({ type: 'LD2_SETTINGS_GET' });
    const supabase = {
      ...(current.supabase || {}),
      authMode: 'oauth',
      projectRef: String(project.ref),
      projectName: String(project.name || project.ref),
      organizationSlug: String(project.organization_slug || ''),
      url: String(project.url || `https://${project.ref}.supabase.co`),
      anonKey: '',
      managementToken: ''
    };
    const patch = { supabase };
    if (pid) {
      patch.supabaseMappings = {
        [pid]: {
          projectRef: supabase.projectRef,
          projectName: supabase.projectName,
          organizationSlug: supabase.organizationSlug,
          url: supabase.url
        }
      };
    }
    await runtime({ type: 'LD2_SETTINGS_PATCH', patch });
    toast(root, `${supabase.projectName} conectado ao projeto Lovable atual.`);
  }

  async function disconnectSupabase(root) {
    try {
      await supabaseRuntime('disconnect');
      const current = await runtime({ type: 'LD2_SETTINGS_GET' });
      const pid = window.LovableDecrypterV2?.getProjectId?.() || '';
      const patch = {
        supabase: {
          ...(current.supabase || {}),
          authMode: 'oauth', projectRef: '', projectName: '', organizationSlug: '', url: '', anonKey: '', managementToken: ''
        }
      };
      if (pid) patch.supabaseMappings = { [pid]: { projectRef: '', projectName: '', organizationSlug: '', url: '' } };
      await runtime({ type: 'LD2_SETTINGS_PATCH', patch });
      toast(root, 'Supabase desconectado do Lovable Decrypter.');
      await renderSupabaseModal(root);
    } catch (error) {
      toast(root, error?.message || String(error), true);
    }
  }

  async function renderSupabaseModal(root, suppliedStatus = null) {
    supabaseLoading(root);
    let status;
    try {
      status = suppliedStatus || await supabaseRuntime('status');
    } catch (error) {
      const view = openModal(root, supabaseModalShell(`
        <div class="ld2-gh-error"><b>Não foi possível consultar o Supabase</b><p>${esc(error?.message || String(error))}</p><button type="button" class="primary" data-sb-retry>Tentar novamente</button></div>`));
      view?.card.querySelector('[data-sb-close]')?.addEventListener('click', () => closeModal(root));
      view?.card.querySelector('[data-sb-retry]')?.addEventListener('click', () => renderSupabaseModal(root));
      return;
    }

    if (!status.app_configured) {
      const scopes = Array.isArray(status.required_scopes) ? status.required_scopes.join(' · ') : 'projects:read · database:read · database:write';
      const view = openModal(root, supabaseModalShell(`
        <div class="ld2-gh-state">
          <span class="ld2-gh-state-icon">SB</span>
          <h3>OAuth App do Supabase ainda não configurado</h3>
          <p>O Supabase exige que o proprietário cadastre o OAuth App uma única vez no Dashboard da organização. Depois disso, os usuários conectam apenas pelo pop-up oficial.</p>
          <div class="ld2-gh-warning">Escopos necessários: ${esc(scopes)}</div>
          <small class="ld2-gh-foot">Nenhum Management Token, anon key ou service_role será solicitado pela extensão.</small>
        </div>`));
      view?.card.querySelector('[data-sb-close]')?.addEventListener('click', () => closeModal(root));
      return;
    }

    if (!status.connected) {
      const view = openModal(root, supabaseModalShell(`
        <div class="ld2-gh-state">
          <span class="ld2-gh-state-icon">SB</span>
          <h3>Autorize sua conta Supabase</h3>
          <p>O Supabase abrirá a página oficial de consentimento do <b>${esc(status.app?.name || 'Lovable Decrypter')}</b>. Depois você escolhe neste painel qual projeto pertence ao Lovable atual.</p>
          ${status.stale_connection ? '<div class="ld2-gh-warning">A autorização anterior expirou ou foi revogada. Autorize novamente.</div>' : ''}
          <button type="button" class="primary" data-sb-connect>Autorizar no Supabase</button>
        </div>`));
      view?.card.querySelector('[data-sb-close]')?.addEventListener('click', () => closeModal(root));
      view?.card.querySelector('[data-sb-connect]')?.addEventListener('click', () => beginSupabaseAuthorization(root));
      return;
    }

    const projects = Array.isArray(status.projects) ? status.projects : [];
    const settings = await runtime({ type: 'LD2_SETTINGS_GET' }).catch(() => ({}));
    const pid = window.LovableDecrypterV2?.getProjectId?.() || '';
    const mappedRef = pid && settings.supabaseMappings?.[pid]?.projectRef;
    const selectedRef = mappedRef || settings.supabase?.projectRef || '';
    const options = projects.map(project => `<option value="${esc(project.ref)}"${project.ref === selectedRef ? ' selected' : ''}>${esc(project.name)} · ${esc(project.ref)}</option>`).join('');

    const view = openModal(root, supabaseModalShell(`
      <div class="ld2-gh-connected">
        <div class="ld2-gh-account"><span class="ready"></span><div><small>CONECTADO</small><b>Supabase</b><p>${projects.length} projeto(s) disponível(is)</p></div></div>
        <label class="ld2-gh-field"><span>Projeto Supabase deste Lovable</span>
          <select data-sb-project ${projects.length ? '' : 'disabled'}>${projects.length ? options : '<option>Nenhum projeto autorizado</option>'}</select>
        </label>
        <div class="ld2-gh-repo-detail" data-sb-project-detail></div>
        <div class="ld2-gh-actions">
          <button type="button" class="primary" data-sb-use ${projects.length ? '' : 'disabled'}>Usar neste projeto</button>
          <button type="button" class="danger" data-sb-disconnect>Desconectar</button>
        </div>
        <small class="ld2-gh-foot">Tokens OAuth e refresh tokens permanecem somente no backend/Vault do Decrypter.</small>
      </div>`));
    const card = view?.card;
    card?.querySelector('[data-sb-close]')?.addEventListener('click', () => closeModal(root));
    const select = card?.querySelector('[data-sb-project]');
    const detail = card?.querySelector('[data-sb-project-detail]');
    const updateDetail = () => {
      const project = projects.find(item => item.ref === select?.value) || projects[0];
      if (!detail) return;
      detail.innerHTML = project
        ? `<b>${esc(project.name)}</b><span>${esc(project.ref)} · ${esc(project.region || 'região não informada')} · ${esc(project.status || '')}</span>`
        : 'Nenhum projeto disponível.';
    };
    select?.addEventListener('change', updateDetail);
    updateDetail();
    card?.querySelector('[data-sb-use]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const project = projects.find(item => item.ref === select?.value) || projects[0];
      if (!project) return;
      button.disabled = true;
      button.textContent = 'Validando banco…';
      try {
        await saveSelectedSupabaseProject(root, project);
        button.textContent = 'Projeto conectado ✓';
        setTimeout(() => closeModal(root), 900);
      } catch (error) {
        toast(root, error?.message || String(error), true);
        button.disabled = false;
        button.textContent = 'Usar neste projeto';
      }
    });
    card?.querySelector('[data-sb-disconnect]')?.addEventListener('click', () => disconnectSupabase(root));
  }

  function render(root) {
    if (!root) return;

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
          <button class="ld2-cc-card accent" type="button" data-cc-github><span>GH</span><div><b>GitHub</b><small>Autorização oficial e repositórios permitidos</small></div></button>
          <button class="ld2-cc-card accent" type="button" data-cc-supabase><span>SB</span><div><b>Supabase</b><small>OAuth oficial e projeto autorizado</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="migrate"><span>⇄</span><div><b>Migrations</b><small>Aplicar migrations existentes com controle</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="zip"><span>⇩</span><div><b>Exportar ZIP</b><small>Gerar uma cópia do projeto atual</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="notes"><span>▤</span><div><b>Notas</b><small>Anotações persistentes do projeto</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-section">
        <div class="ld2-cc-section-head"><div><small>SISTEMA</small><h3>Controle e segurança</h3></div></div>
        <div class="ld2-cc-grid">
          <button class="ld2-cc-card" type="button" data-cc-action="diag"><span>◇</span><div><b>Diagnóstico</b><small>Verificar integrações e ambiente</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-settings><span>⚙</span><div><b>Configurações</b><small>Gemini, Supabase e preferências</small></div></button>
          <button class="ld2-cc-card" type="button" data-cc-action="license"><span>◉</span><div><b>Licença</b><small>KEY, dispositivo, plano e créditos</small></div></button>
          <button class="ld2-cc-card accent" type="button" data-cc-action="update"><span>↻</span><div><b>Atualizar</b><small>Verificar e aplicar OTA assinado</small></div></button>
        </div>
      </section>

      <section class="ld2-cc-native-chat">
        <div><span>⌘</span><div><b>Composer do Lovable integrado</b><small>Plan/Build, anexos e progresso trabalham sobre o composer nativo sem enviar o prompt ao Lovable enquanto o Decrypter está ativo.</small></div></div>
        <span class="ld2-cc-status">PRONTO</span>
      </section>`;
    body.appendChild(workspace);

    $$('[data-cc-action]', workspace).forEach(button => {
      button.addEventListener('click', () => triggerLegacyAction(root, button.dataset.ccAction));
    });
    $('[data-cc-github]', workspace)?.addEventListener('click', () => renderGithubModal(root));
    $('[data-cc-supabase]', workspace)?.addEventListener('click', () => renderSupabaseModal(root));
    $('[data-cc-settings]', workspace)?.addEventListener('click', () => triggerSettings(root));
    $('[data-cc-batch]', workspace)?.addEventListener('click', () => {
      toast(root, 'A fila avançada continua desativada nesta build segura e será reativada em etapa própria.');
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
