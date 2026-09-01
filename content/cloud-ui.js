(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_CLOUD_UI__) return;
  window.__LOVABLE_DECRYPTER_CLOUD_UI__ = true;

  const SELECTED_SKILLS_KEY = 'ld2_selected_skill_slugs';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const runtime = message => window.LovableDecrypterV2?.runtime?.(message);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  let settingsCache = null;
  let settingsAt = 0;
  let selectedSkills = [];
  let queueCount = 0;
  let queueRefreshTimer = null;

  async function settings(force = false) {
    if (!force && settingsCache && Date.now() - settingsAt < 10000) return settingsCache;
    settingsCache = await runtime({ type: 'LD2_SETTINGS_GET' });
    settingsAt = Date.now();
    return settingsCache;
  }

  async function cloud(slug, body = {}, withGemini = false) {
    const cfg = await settings();
    const base = String(cfg?.auth?.backendBase || '').replace(/\/+$/, '');
    const key = String(cfg?.auth?.licenseKey || '');
    const device = String(cfg?.auth?.deviceId || '');
    if (!base || !key) throw new Error('Ative uma licença antes de usar os recursos Cloud.');
    const headers = {
      'content-type': 'application/json',
      'x-license-key': key,
      ...(device ? { 'x-device-id': device } : {})
    };
    if (withGemini && cfg?.gemini?.apiKey) headers['x-gemini-key'] = String(cfg.gemini.apiKey);
    const res = await fetch(`${base}/${slug}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out?.ok === false) throw new Error(out?.code || `HTTP_${res.status}`);
    return out;
  }

  function modalParts() {
    const root = $('#ld2-root');
    const modal = root?.querySelector('.ld2-modal');
    const card = modal?.querySelector('.ld2-card');
    return { root, modal, card };
  }

  function openModal(html, cls = '') {
    const { modal, card } = modalParts();
    if (!modal || !card) throw new Error('Control Center ainda não está pronto.');
    card.className = `ld2-card ld2-cloud-card ${cls}`.trim();
    card.innerHTML = html;
    modal.classList.add('open');
    card.querySelector('[data-cloud-close]')?.addEventListener('click', closeModal);
    return card;
  }

  function closeModal() {
    const { modal, card } = modalParts();
    modal?.classList.remove('open');
    if (card) { card.className = 'ld2-card'; card.innerHTML = ''; }
  }

  function notify(text, error = false) {
    const root = $('#ld2-root');
    const wrap = root?.querySelector('.ld2-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ld2-toast${error ? ' error' : ''}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  async function loadSelectedSkills() {
    const data = await chrome.storage.local.get(SELECTED_SKILLS_KEY);
    selectedSkills = Array.isArray(data[SELECTED_SKILLS_KEY]) ? data[SELECTED_SKILLS_KEY].map(String).slice(0, 12) : [];
  }

  async function saveSelectedSkills() {
    selectedSkills = [...new Set(selectedSkills)].slice(0, 12);
    await chrome.storage.local.set({ [SELECTED_SKILLS_KEY]: selectedSkills });
    refreshComposerCloudControls();
  }

  async function openSkills() {
    const card = openModal(`
      <div class="ld2-cloud-head"><div><small>SKILLS CLOUD</small><h2>Skills</h2><p>Selecione até 12 Skills para compor o próximo stack manual.</p></div><button type="button" data-cloud-close>×</button></div>
      <div class="ld2-cloud-loading">Carregando biblioteca…</div>`, 'skills');
    try {
      await loadSelectedSkills();
      const out = await cloud('ld-skills', { action: 'list' });
      const skills = Array.isArray(out.skills) ? out.skills : [];
      card.innerHTML = `
        <div class="ld2-cloud-head"><div><small>SKILLS CLOUD · ${skills.length}</small><h2>Skills</h2><p>Selecione Skills para o stack manual. Auto Skill será ligado pelo Router.</p></div><button type="button" data-cloud-close>×</button></div>
        <div class="ld2-cloud-toolbar"><input type="search" data-skill-search placeholder="Buscar Skill…"><span data-skill-selected>${selectedSkills.length}/12 selecionadas</span></div>
        <div class="ld2-skill-list">${skills.map(skill => skillRow(skill)).join('')}</div>`;
      card.querySelector('[data-cloud-close]').onclick = closeModal;
      const search = card.querySelector('[data-skill-search]');
      search.oninput = () => filterSkills(card, search.value);
      bindSkillRows(card, skills);
    } catch (error) {
      card.querySelector('.ld2-cloud-loading').textContent = error?.message || String(error);
    }
  }

  function skillRow(skill) {
    const enabled = skill?.user?.enabled !== false;
    const pinned = Boolean(skill?.user?.pinned);
    const selected = selectedSkills.includes(String(skill.slug));
    return `<article class="ld2-skill-row" data-skill-row data-search="${esc(`${skill.display_name} ${skill.slug} ${skill.category} ${skill.description}`.toLowerCase())}">
      <label class="ld2-skill-select"><input type="checkbox" data-skill-use value="${esc(skill.slug)}" ${selected ? 'checked' : ''} ${enabled ? '' : 'disabled'}><span></span></label>
      <div class="ld2-skill-copy"><div><b>${esc(skill.display_name)}</b><em>${esc(skill.category || 'geral')}</em></div><small>${esc(skill.description || skill.slug)}</small></div>
      <button type="button" class="ld2-skill-pin ${pinned ? 'active' : ''}" data-skill-pin data-slug="${esc(skill.slug)}" data-pinned="${pinned ? '1' : '0'}" title="Favoritar">★</button>
      <button type="button" class="ld2-skill-enable ${enabled ? 'active' : ''}" data-skill-enable data-slug="${esc(skill.slug)}" data-enabled="${enabled ? '1' : '0'}">${enabled ? 'ON' : 'OFF'}</button>
    </article>`;
  }

  function filterSkills(card, value) {
    const q = String(value || '').trim().toLowerCase();
    $$('[data-skill-row]', card).forEach(row => row.hidden = Boolean(q && !String(row.dataset.search || '').includes(q)));
  }

  function updateSkillCounter(card) {
    const el = card.querySelector('[data-skill-selected]');
    if (el) el.textContent = `${selectedSkills.length}/12 selecionadas`;
  }

  function bindSkillRows(card) {
    $$('[data-skill-use]', card).forEach(input => input.onchange = async () => {
      const slug = String(input.value);
      if (input.checked) {
        if (selectedSkills.length >= 12) { input.checked = false; return notify('O stack manual aceita no máximo 12 Skills.', true); }
        selectedSkills.push(slug);
      } else selectedSkills = selectedSkills.filter(x => x !== slug);
      await saveSelectedSkills();
      updateSkillCounter(card);
    });
    $$('[data-skill-pin]', card).forEach(btn => btn.onclick = async () => {
      const pinned = btn.dataset.pinned !== '1';
      btn.disabled = true;
      try {
        await cloud('ld-skills', { action: 'set_preference', slug: btn.dataset.slug, pinned });
        btn.dataset.pinned = pinned ? '1' : '0';
        btn.classList.toggle('active', pinned);
      } catch (error) { notify(error?.message || String(error), true); }
      finally { btn.disabled = false; }
    });
    $$('[data-skill-enable]', card).forEach(btn => btn.onclick = async () => {
      const enabled = btn.dataset.enabled !== '1';
      btn.disabled = true;
      try {
        await cloud('ld-skills', { action: 'set_preference', slug: btn.dataset.slug, enabled });
        btn.dataset.enabled = enabled ? '1' : '0';
        btn.classList.toggle('active', enabled);
        btn.textContent = enabled ? 'ON' : 'OFF';
        const checkbox = btn.closest('[data-skill-row]')?.querySelector('[data-skill-use]');
        if (checkbox) checkbox.disabled = !enabled;
        if (!enabled && selectedSkills.includes(btn.dataset.slug)) {
          selectedSkills = selectedSkills.filter(x => x !== btn.dataset.slug);
          if (checkbox) checkbox.checked = false;
          await saveSelectedSkills();
          updateSkillCounter(card);
        }
      } catch (error) { notify(error?.message || String(error), true); }
      finally { btn.disabled = false; }
    });
  }

  function statusLabel(status) {
    return ({ queued:'Aguardando', running:'Executando', paused:'Pausada', blocked:'Bloqueada', completed:'Concluída', failed:'Falhou', cancelled:'Cancelada' })[status] || status;
  }

  async function getQueue() {
    return cloud('ld-queue', { action: 'list', limit: 150 });
  }

  async function refreshQueueCount() {
    try {
      const out = await getQueue();
      const c = out.counts || {};
      queueCount = Number(c.queued || 0) + Number(c.running || 0) + Number(c.paused || 0) + Number(c.blocked || 0) + Number(c.failed || 0);
      refreshComposerCloudControls();
      const health = $('#ld2-root .ld2-cc-health>div:nth-child(3)');
      if (health) {
        health.querySelector('.ld2-cc-dot')?.classList.add('ready');
        const b = health.querySelector('b'); if (b) b.textContent = queueCount ? `${queueCount} pendente(s)` : 'UI ativa';
      }
      return out;
    } catch (_) { return null; }
  }

  async function openQueue() {
    const card = openModal(`
      <div class="ld2-cloud-head"><div><small>COMMAND QUEUE</small><h2>Fila</h2><p>Execuções persistentes desta licença.</p></div><button type="button" data-cloud-close>×</button></div>
      <div class="ld2-cloud-loading">Carregando fila…</div>`, 'queue');
    try { await renderQueue(card, await getQueue()); }
    catch (error) { card.querySelector('.ld2-cloud-loading').textContent = error?.message || String(error); }
  }

  async function renderQueue(card, out) {
    const items = Array.isArray(out?.items) ? out.items : [];
    const c = out?.counts || {};
    card.innerHTML = `
      <div class="ld2-cloud-head"><div><small>COMMAND QUEUE</small><h2>Fila</h2><p>${items.length} item(ns) registrados.</p></div><button type="button" data-cloud-close>×</button></div>
      <div class="ld2-queue-counts"><span><b>${Number(c.running||0)}</b> executando</span><span><b>${Number(c.queued||0)}</b> aguardando</span><span><b>${Number(c.paused||0)}</b> pausadas</span><span><b>${Number(c.failed||0)+Number(c.blocked||0)}</b> falhas</span></div>
      <div class="ld2-queue-controls"><button type="button" data-queue-control="pause">Pausar</button><button type="button" data-queue-control="resume">Continuar</button><button type="button" class="danger" data-queue-control="cancel_pending">Cancelar pendentes</button><button type="button" data-queue-refresh>Atualizar</button></div>
      <div class="ld2-queue-list">${items.length ? items.map(queueRow).join('') : '<div class="ld2-cloud-empty">A fila está vazia.</div>'}</div>`;
    card.querySelector('[data-cloud-close]').onclick = closeModal;
    card.querySelector('[data-queue-refresh]').onclick = async () => renderQueue(card, await getQueue());
    $$('[data-queue-control]', card).forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await cloud('ld-queue', { action: 'control', operation: btn.dataset.queueControl }); await renderQueue(card, await getQueue()); await refreshQueueCount(); }
      catch (error) { notify(error?.message || String(error), true); btn.disabled = false; }
    });
    $$('[data-queue-cancel]', card).forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await cloud('ld-queue', { action: 'cancel_item', item_id: btn.dataset.queueCancel }); await renderQueue(card, await getQueue()); await refreshQueueCount(); }
      catch (error) { notify(error?.message || String(error), true); btn.disabled = false; }
    });
    $$('[data-queue-retry]', card).forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await cloud('ld-queue', { action: 'retry_failed', item_id: btn.dataset.queueRetry }); await renderQueue(card, await getQueue()); await refreshQueueCount(); }
      catch (error) { notify(error?.message || String(error), true); btn.disabled = false; }
    });
  }

  function queueRow(item) {
    const cancellable = ['queued','paused'].includes(item.status);
    const retryable = ['failed','blocked'].includes(item.status);
    return `<article class="ld2-queue-row status-${esc(item.status)}"><div class="ld2-queue-pos">${Number(item.queue_position || item.batch_position || 0)}</div><div class="ld2-queue-copy"><div><b>${esc(statusLabel(item.status))}</b><em>${esc(item.mode || 'build')}</em></div><p>${esc(item.command_text || '')}</p>${Array.isArray(item.skill_slugs)&&item.skill_slugs.length?`<small>Skills: ${esc(item.skill_slugs.join(', '))}</small>`:''}${item.error_code?`<small class="error">${esc(item.error_code)}</small>`:''}</div><div class="ld2-queue-actions">${cancellable?`<button type="button" data-queue-cancel="${esc(item.id)}">×</button>`:''}${retryable?`<button type="button" data-queue-retry="${esc(item.id)}">↻</button>`:''}</div></article>`;
  }

  function bridgeInput(bar) {
    const host = bar?.nextElementSibling;
    return host?.matches?.('textarea,[contenteditable="true"],[role="textbox"]') ? host : host?.querySelector?.('textarea,[contenteditable="true"],[role="textbox"]');
  }

  function readComposer(input) {
    if (!input) return '';
    return 'value' in input ? String(input.value || '') : String(input.innerText || input.textContent || '');
  }

  function clearComposer(input) {
    if (!input) return;
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, ''); else input.value = '';
    } else input.textContent = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function fragmentPreview(bar) {
    const input = bridgeInput(bar);
    const prompt = readComposer(input).trim();
    if (!prompt) return notify('Digite um comando no composer do Lovable.', true);
    const mode = bar.querySelector('[data-ld2-mode].active')?.dataset.ld2Mode === 'plan' ? 'plan' : 'build';
    const card = openModal(`
      <div class="ld2-cloud-head"><div><small>PROMPT FRAGMENTER</small><h2>Identificando ações</h2><p>O prompt ainda não foi adicionado à fila.</p></div><button type="button" data-cloud-close>×</button></div>
      <div class="ld2-cloud-loading">Analisando estrutura do comando…</div>`, 'fragment');
    try {
      await loadSelectedSkills();
      const out = await cloud('ld-queue', { action: 'fragment_preview', prompt }, true);
      renderFragmentPreview(card, { prompt, mode, out, input });
    } catch (error) {
      card.querySelector('.ld2-cloud-loading').textContent = error?.message === 'FRAGMENTATION_FREE_QUOTA_EXHAUSTED' ? 'A cota gratuita do Gemini para fragmentação acabou. Nenhum comando foi enfileirado.' : (error?.message || String(error));
    }
  }

  function renderFragmentPreview(card, ctx) {
    const actions = Array.isArray(ctx.out?.actions) ? ctx.out.actions : [];
    card.innerHTML = `
      <div class="ld2-cloud-head"><div><small>PROMPT FRAGMENTER · ${esc(ctx.out?.fragmentation_method || '')}</small><h2>${actions.length} ação(ões) identificada(s)</h2><p>Revise, edite, remova ou adicione ações antes de criar a fila.</p></div><button type="button" data-cloud-close>×</button></div>
      <div class="ld2-fragment-list">${actions.map((a,i)=>fragmentRow(i+1,a.command)).join('')}</div>
      <div class="ld2-fragment-footer"><button type="button" data-fragment-add>+ Adicionar ação</button><span>${selectedSkills.length ? `${selectedSkills.length} Skill(s) no stack` : 'Sem Skill manual'}</span><button type="button" class="primary" data-fragment-enqueue>Adicionar à fila</button></div>`;
    card.querySelector('[data-cloud-close]').onclick = closeModal;
    bindFragmentRows(card);
    card.querySelector('[data-fragment-add]').onclick = () => {
      const list = card.querySelector('.ld2-fragment-list');
      const index = list.children.length + 1;
      list.insertAdjacentHTML('beforeend', fragmentRow(index, ''));
      bindFragmentRows(card);
      renumberFragments(card);
    };
    card.querySelector('[data-fragment-enqueue]').onclick = async e => {
      const commands = $$('[data-fragment-command]', card).map(x => String(x.value || '').trim()).filter(Boolean);
      if (!commands.length) return notify('Mantenha pelo menos uma ação.', true);
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Enfileirando…';
      try {
        const out = await cloud('ld-queue', { action: 'enqueue_many', prompt: ctx.prompt, commands, mode: ctx.mode, source: 'native_composer', skill_slugs: selectedSkills });
        clearComposer(ctx.input);
        closeModal();
        await refreshQueueCount();
        notify(`${out.count || commands.length} ação(ões) adicionada(s) à fila.`);
      } catch (error) { notify(error?.message || String(error), true); btn.disabled = false; btn.textContent = 'Adicionar à fila'; }
    };
  }

  function fragmentRow(position, command) {
    return `<div class="ld2-fragment-row"><span data-fragment-number>${position}</span><textarea data-fragment-command rows="2">${esc(command)}</textarea><button type="button" data-fragment-remove title="Remover">×</button></div>`;
  }

  function bindFragmentRows(card) {
    $$('[data-fragment-remove]', card).forEach(btn => {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.onclick = () => { btn.closest('.ld2-fragment-row')?.remove(); renumberFragments(card); };
    });
  }

  function renumberFragments(card) {
    $$('.ld2-fragment-row', card).forEach((row, i) => { const n = row.querySelector('[data-fragment-number]'); if (n) n.textContent = String(i + 1); });
  }

  function refreshComposerCloudControls() {
    $$('.ld2-native-bridge').forEach(bar => {
      let wrap = bar.querySelector('.ld2-cloud-controls');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'ld2-cloud-controls';
        wrap.innerHTML = `<button type="button" data-cloud-skills>Skills</button><button type="button" data-cloud-queue>☷ Fila</button><button type="button" class="accent" data-cloud-add-queue>+ Fila</button>`;
        const spacer = bar.querySelector('.ld2-bridge-spacer');
        spacer?.parentElement?.insertBefore(wrap, spacer);
        wrap.querySelector('[data-cloud-skills]').onclick = openSkills;
        wrap.querySelector('[data-cloud-queue]').onclick = openQueue;
        wrap.querySelector('[data-cloud-add-queue]').onclick = () => fragmentPreview(bar);
      }
      const skills = wrap.querySelector('[data-cloud-skills]'); if (skills) skills.textContent = selectedSkills.length ? `Skills ${selectedSkills.length}` : 'Skills';
      const queue = wrap.querySelector('[data-cloud-queue]'); if (queue) queue.textContent = queueCount ? `☷ Fila ${queueCount}` : '☷ Fila';
    });
  }

  function interceptControlCenterClicks(event) {
    const skills = event.target.closest?.('#ld2-root [data-cc-action="skills"]');
    if (skills) { event.preventDefault(); event.stopImmediatePropagation(); openSkills().catch(e => notify(e.message, true)); return; }
    const queue = event.target.closest?.('#ld2-root [data-cc-future="queue"]');
    if (queue) { event.preventDefault(); event.stopImmediatePropagation(); openQueue().catch(e => notify(e.message, true)); }
  }

  let scheduled = false;
  function reconcile() {
    scheduled = false;
    refreshComposerCloudControls();
    const queueCard = $('#ld2-root [data-cc-future="queue"]');
    if (queueCard) {
      queueCard.classList.remove('future');
      queueCard.querySelector('em')?.remove();
      const small = queueCard.querySelector('small'); if (small) small.textContent = 'Fila Cloud persistente';
    }
  }
  function schedule() { if (scheduled) return; scheduled = true; setTimeout(reconcile, 120); }

  document.addEventListener('click', interceptControlCenterClicks, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  loadSelectedSkills().then(() => { reconcile(); refreshQueueCount(); }).catch(() => reconcile());
  queueRefreshTimer = setInterval(refreshQueueCount, 30000);
  addEventListener('beforeunload', () => clearInterval(queueRefreshTimer), { once: true });
})();
