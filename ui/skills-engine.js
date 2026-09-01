(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_SKILLS_UI__) return;
  window.__LOVABLE_DECRYPTER_SKILLS_UI__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const router = () => window.LovableDecrypterSkillRouter;
  let overlay = null;
  let state = { busy: false, filter: 'all', search: '', catalog: { official: [], custom: [], all: [] }, auto: true };

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ld2-skills-overlay';
    overlay.innerHTML = `
      <section class="ld2-skills-shell" role="dialog" aria-modal="true" aria-label="Skills">
        <header class="ld2-skills-head">
          <div class="ld2-skills-title"><span>✳</span><div><b>Skills</b><small>Skills oficiais + personalizadas</small></div></div>
          <button type="button" class="ld2-skills-close" data-skills-close aria-label="Fechar">×</button>
        </header>
        <div class="ld2-skills-toolbar">
          <label class="ld2-skills-auto"><span><b>Auto Skill</b><small>Seleciona somente Skills relevantes antes do agente pensar.</small></span><input type="checkbox" data-skills-auto><i></i></label>
          <div class="ld2-skills-search"><span>⌕</span><input type="search" placeholder="Buscar Skill" data-skills-search></div>
        </div>
        <div class="ld2-skills-tabs">
          <button type="button" data-skills-filter="all" class="active">Todas</button>
          <button type="button" data-skills-filter="official">Oficiais</button>
          <button type="button" data-skills-filter="custom">Minhas Skills</button>
        </div>
        <div class="ld2-skills-body">
          <aside class="ld2-skills-install">
            <div class="ld2-skills-install-head"><div><b>Instalar Skill personalizada</b><small>Mesmo conceito do Nexus PRO, mas com gatilho e limites explícitos.</small></div><span>PRO+</span></div>
            <label>Nome<input type="text" maxlength="80" data-custom-name placeholder="Ex.: Revisar pagamentos"></label>
            <label>Use when<textarea rows="2" maxlength="2000" data-custom-use placeholder="Use when o pedido envolver checkout, cobrança ou webhook de pagamento."></textarea></label>
            <label>Avoid when<textarea rows="2" maxlength="2000" data-custom-avoid placeholder="Evite quando o pedido for apenas visual ou não tocar pagamentos."></textarea></label>
            <label>Definição<textarea rows="7" maxlength="90000" data-custom-definition placeholder="Descreva o playbook da Skill, regras, passos e validações..."></textarea></label>
            <label class="ld2-skills-check"><input type="checkbox" data-custom-auto checked><span>Ativar após instalar e permitir Auto Skill</span></label>
            <button type="button" class="ld2-skills-primary" data-custom-install>Instalar Skill</button>
            <small class="ld2-skills-form-status" data-skills-form-status></small>
          </aside>
          <main class="ld2-skills-catalog">
            <div class="ld2-skills-summary" data-skills-summary>Carregando catálogo…</div>
            <div class="ld2-skills-grid" data-skills-grid></div>
          </main>
        </div>
      </section>`;
    document.documentElement.appendChild(overlay);

    $('[data-skills-close]', overlay).onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    $('[data-skills-search]', overlay).addEventListener('input', e => { state.search = String(e.target.value || '').trim().toLowerCase(); renderCatalog(); });
    $$('[data-skills-filter]', overlay).forEach(btn => btn.onclick = () => {
      state.filter = btn.dataset.skillsFilter;
      $$('[data-skills-filter]', overlay).forEach(x => x.classList.toggle('active', x === btn));
      renderCatalog();
    });
    $('[data-skills-auto]', overlay).onchange = async e => {
      try {
        e.target.disabled = true;
        state.auto = await router().setEnabled(e.target.checked);
      } catch (err) {
        e.target.checked = state.auto;
        status(err?.message || String(err), true);
      } finally { e.target.disabled = false; }
    };
    $('[data-custom-install]', overlay).onclick = installCustom;
    return overlay;
  }

  async function open() {
    ensureOverlay();
    overlay.classList.add('open');
    document.documentElement.classList.add('ld2-skills-open');
    await refresh(true);
    setTimeout(() => $('[data-skills-search]', overlay)?.focus(), 40);
  }

  function close() {
    overlay?.classList.remove('open');
    document.documentElement.classList.remove('ld2-skills-open');
  }

  function status(text, error = false) {
    const el = $('[data-skills-form-status]', overlay);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', Boolean(error));
  }

  function riskLabel(risk) {
    return risk === 'high' ? 'alto risco' : risk === 'medium' ? 'médio risco' : 'baixo risco';
  }

  function skillCard(skill) {
    const official = skill.official !== false && !skill.custom;
    const enabled = skill.enabled !== false;
    const pinned = Boolean(skill.pinned);
    const auto = skill.auto_activation !== false;
    return `<article class="ld2-skill-card ${enabled ? '' : 'disabled'}" data-skill="${esc(skill.slug)}" data-kind="${official ? 'official' : 'custom'}">
      <div class="ld2-skill-card-head">
        <div class="ld2-skill-icon">${official ? '◆' : '✦'}</div>
        <div class="ld2-skill-name"><b>${esc(skill.display_name || skill.slug)}</b><small>${esc(skill.description || skill.use_when || 'Sem descrição')}</small></div>
      </div>
      <div class="ld2-skill-badges">
        <span>${official ? 'OFICIAL' : 'PERSONALIZADA'}</span>
        <span>${esc(skill.category || 'custom')}</span>
        <span class="risk-${esc(skill.risk || 'low')}">${riskLabel(skill.risk)}</span>
      </div>
      ${!official && skill.use_when ? `<div class="ld2-skill-trigger"><b>Use when</b>${esc(skill.use_when)}</div>` : ''}
      <div class="ld2-skill-controls">
        <label title="Disponível para uso"><input type="checkbox" data-skill-enabled ${enabled ? 'checked' : ''}><span>Ativa</span></label>
        <label title="Sempre incluir quando possível"><input type="checkbox" data-skill-pinned ${pinned ? 'checked' : ''}><span>Fixar</span></label>
        ${!official ? `<label title="Permite seleção automática"><input type="checkbox" data-skill-auto ${auto ? 'checked' : ''}><span>Auto</span></label>` : ''}
        ${!official ? '<button type="button" class="ld2-skill-delete" data-skill-delete>Excluir</button>' : ''}
      </div>
    </article>`;
  }

  function renderCatalog() {
    if (!overlay) return;
    const all = state.catalog.all || [];
    const query = state.search;
    const filtered = all.filter(skill => {
      if (state.filter === 'official' && (skill.official === false || skill.custom)) return false;
      if (state.filter === 'custom' && !skill.custom) return false;
      if (!query) return true;
      return [skill.display_name, skill.slug, skill.description, skill.category, skill.use_when].some(v => String(v || '').toLowerCase().includes(query));
    });
    const summary = $('[data-skills-summary]', overlay);
    const officialCount = state.catalog.official?.length || 0;
    const customCount = state.catalog.custom?.length || 0;
    summary.innerHTML = `<b>${officialCount}</b> oficiais <span>·</span> <b>${customCount}</b> personalizadas <span>·</span> <b>${filtered.length}</b> exibidas`;
    const grid = $('[data-skills-grid]', overlay);
    grid.innerHTML = filtered.length ? filtered.map(skillCard).join('') : '<div class="ld2-skills-empty">Nenhuma Skill encontrada.</div>';

    $$('.ld2-skill-card', grid).forEach(card => {
      const slug = card.dataset.skill;
      const skill = all.find(x => String(x.slug) === slug);
      if (!skill) return;
      $('[data-skill-enabled]', card).onchange = e => changeSkill(skill, { enabled: e.target.checked });
      $('[data-skill-pinned]', card).onchange = e => changeSkill(skill, { pinned: e.target.checked });
      const autoInput = $('[data-skill-auto]', card);
      if (autoInput) autoInput.onchange = e => changeSkill(skill, { auto_activation: e.target.checked });
      const del = $('[data-skill-delete]', card);
      if (del) del.onclick = () => deleteCustom(skill);
    });
  }

  async function refresh(force = false) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!router()) throw new Error('Skills Engine ainda não foi carregado.');
      const [catalog, auto] = await Promise.all([router().list(force), router().enabled()]);
      state.catalog = catalog;
      state.auto = auto;
      const autoInput = $('[data-skills-auto]', overlay);
      if (autoInput) autoInput.checked = auto;
      renderCatalog();
    } catch (err) {
      const grid = $('[data-skills-grid]', overlay);
      if (grid) grid.innerHTML = `<div class="ld2-skills-empty error">${esc(err?.message || String(err))}</div>`;
    } finally { state.busy = false; }
  }

  async function changeSkill(skill, patch) {
    try {
      if (skill.custom) {
        await router().updateCustom(skill.slug, patch);
      } else {
        await router().setOfficialPreference(skill.slug, {
          enabled: patch.enabled != null ? patch.enabled : skill.enabled !== false,
          pinned: patch.pinned != null ? patch.pinned : Boolean(skill.pinned),
          settings: skill.settings || {}
        });
      }
      await refresh(true);
    } catch (err) {
      status(err?.message || String(err), true);
      await refresh(true);
    }
  }

  async function installCustom() {
    if (state.busy) return;
    const name = $('[data-custom-name]', overlay).value.trim();
    const useWhen = $('[data-custom-use]', overlay).value.trim();
    const avoidWhen = $('[data-custom-avoid]', overlay).value.trim();
    const definition = $('[data-custom-definition]', overlay).value.trim();
    const enabled = $('[data-custom-auto]', overlay).checked;
    if (!name || !useWhen || !definition) {
      status('Preencha Nome, Use when e Definição.', true);
      return;
    }
    state.busy = true;
    status('Instalando…');
    try {
      await router().createCustom({
        display_name: name,
        use_when: useWhen,
        avoid_when: avoidWhen,
        definition,
        enabled,
        auto_activation: enabled
      });
      $('[data-custom-name]', overlay).value = '';
      $('[data-custom-use]', overlay).value = '';
      $('[data-custom-avoid]', overlay).value = '';
      $('[data-custom-definition]', overlay).value = '';
      status('Skill instalada e persistida na sua licença.');
      state.filter = 'custom';
      $$('[data-skills-filter]', overlay).forEach(x => x.classList.toggle('active', x.dataset.skillsFilter === 'custom'));
    } catch (err) {
      status(err?.message || String(err), true);
    } finally {
      state.busy = false;
      await refresh(true);
    }
  }

  async function deleteCustom(skill) {
    if (!confirm(`Excluir a Skill “${skill.display_name || skill.slug}”?`)) return;
    try {
      await router().deleteCustom(skill.slug);
      status('Skill personalizada excluída.');
      await refresh(true);
    } catch (err) { status(err?.message || String(err), true); }
  }

  document.addEventListener('click', e => {
    const trigger = e.target?.closest?.('#ld2-root [data-action="skills"]');
    if (!trigger) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }, true);

  window.addEventListener('ld2:skills-routed', e => {
    const detail = e.detail || {};
    if (!overlay?.classList.contains('open')) return;
    const summary = $('[data-skills-summary]', overlay);
    if (!summary || !detail.slugs?.length) return;
    const names = (detail.skills || []).map(x => x.display_name || x.slug).filter(Boolean);
    const warning = detail.warning === 'skill-context-skipped-attachment-limit' ? ' · contexto não anexado: 8 mídias já ocupavam o limite' : '';
    summary.innerHTML = `<b>Último roteamento:</b> ${esc(names.join(', ') || detail.slugs.join(', '))}${esc(warning)}`;
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) close();
  });
})();
