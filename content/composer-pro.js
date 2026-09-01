(() => {
  'use strict';
  if (window.__LOVABLE_DECRYPTER_COMPOSER_PRO__) return;
  window.__LOVABLE_DECRYPTER_COMPOSER_PRO__ = true;

  const THINK_KEY = 'ld2_think_mode_enabled';
  const THINK_MARKER = '\n\n[DECRYPTER THINK MODE]';
  const REWRITE_MODEL = 'gemini-2.5-flash-lite';
  const api = window.LovableDecrypterV2;
  if (!api?.runtime) return;
  const previousRuntime = api.runtime.bind(api);
  let selecting = false;
  let visualBox = null;
  let visualTarget = null;
  let speech = null;

  async function thinkEnabled() {
    const data = await chrome.storage.local.get(THINK_KEY);
    return data[THINK_KEY] === true;
  }
  api.runtime = async message => {
    const type = String(message?.type || '');
    if (!['LD2_PLAN_ONLY', 'LD2_BUILD_EXECUTE', 'LD2_PLAN_APPROVE'].includes(type) || !await thinkEnabled()) return previousRuntime(message);
    const command = String(message?.command || '');
    if (command.includes(THINK_MARKER)) return previousRuntime(message);
    const think = `${THINK_MARKER}\nAntes de propor ou aplicar mudanças, faça uma análise mais profunda de dependências, impacto, riscos, arquivos afetados e critérios de validação. Preserve rigorosamente o escopo original. Não adicione features, refatorações ou mudanças extras. Quando houver UI, considere mobile e desktop. Quando houver backend, avalie contratos e segurança antes da alteração.`;
    return previousRuntime({ ...message, command: `${command}${think}` });
  };

  function bar() { return [...document.querySelectorAll('.ld2-native-bridge')].find(el => el.getBoundingClientRect().width > 0) || null; }
  function inputFor(b) {
    const host = b?.nextElementSibling;
    return host?.matches?.('textarea,[contenteditable="true"],[role="textbox"]') ? host : host?.querySelector?.('textarea,[contenteditable="true"],[role="textbox"]');
  }
  function readInput(input) { return !input ? '' : ('value' in input ? String(input.value || '') : String(input.innerText || input.textContent || '')); }
  function writeInput(input, value) {
    if (!input) return;
    if ('value' in input) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      if (setter) setter.call(input, value); else input.value = value;
    } else input.textContent = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus?.();
  }
  function setStatus(text, kind = '') {
    const el = bar()?.querySelector('[data-ld2-bridge-status]');
    if (!el) return; el.textContent = text; el.dataset.kind = kind;
  }

  async function rewritePrompt() {
    const b = bar(), input = inputFor(b), original = readInput(input).trim();
    if (!original) return setStatus('Digite um prompt antes de usar Rewrite.', 'error');
    const cfg = await previousRuntime({ type: 'LD2_SETTINGS_GET' });
    const key = String(cfg?.gemini?.apiKey || '');
    if (!key) return setStatus('Configure sua Gemini API Key.', 'error');
    setStatus('Rewrite · refinando prompt…', 'active');
    try {
      const schema = { type: 'object', properties: { rewritten_prompt: { type: 'string' } }, required: ['rewritten_prompt'] };
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          model: REWRITE_MODEL,
          input: [{ type: 'text', text: original.slice(0, 30000) }],
          system_instruction: 'Reescreva o pedido como um prompt técnico claro para um agente de programação. Preserve exatamente a intenção e o escopo. Não acrescente funcionalidades, decisões ou requisitos que o usuário não pediu. Não execute nem responda ao pedido; apenas devolva o prompt reescrito.',
          response_format: { type: 'text', mime_type: 'application/json', schema },
          store: false,
          generation_config: { max_output_tokens: 4096 }
        })
      });
      if (res.status === 429) throw new Error('REWRITE_FREE_QUOTA_EXHAUSTED');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Rewrite HTTP ${res.status}`);
      let text = data?.output_text || '';
      if (!text) {
        const chunks = [];
        for (const step of Array.isArray(data?.steps) ? data.steps : []) if (step?.type === 'model_output') for (const p of Array.isArray(step.content) ? step.content : []) if (p?.type === 'text') chunks.push(p.text);
        text = chunks.join('');
      }
      const parsed = JSON.parse(text);
      const rewritten = String(parsed?.rewritten_prompt || '').trim();
      if (!rewritten) throw new Error('Rewrite retornou conteúdo vazio.');
      writeInput(input, rewritten);
      setStatus('Rewrite pronto · revise antes de enviar.', 'success');
    } catch (error) {
      setStatus(error?.message === 'REWRITE_FREE_QUOTA_EXHAUSTED' ? 'Rewrite parou: cota gratuita do Gemini esgotada.' : (error?.message || String(error)), 'error');
    }
  }

  function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return setStatus('Reconhecimento de voz indisponível neste navegador.', 'error');
    if (speech) { try { speech.stop(); } catch (_) {} speech = null; return; }
    const b = bar(), input = inputFor(b);
    speech = new Speech();
    speech.lang = 'pt-BR'; speech.continuous = false; speech.interimResults = false; speech.maxAlternatives = 1;
    speech.onstart = () => { b?.querySelector('[data-pro-voice]')?.classList.add('active'); setStatus('Voice · ouvindo…', 'active'); };
    speech.onresult = event => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) writeInput(input, `${readInput(input).trim()}${readInput(input).trim() ? ' ' : ''}${transcript}`);
    };
    speech.onerror = event => setStatus(`Voice · ${event.error || 'falha no reconhecimento'}`, 'error');
    speech.onend = () => { b?.querySelector('[data-pro-voice]')?.classList.remove('active'); speech = null; setStatus('Voice · transcrição adicionada.', 'success'); };
    try { speech.start(); } catch (error) { speech = null; setStatus(error?.message || String(error), 'error'); }
  }

  function selectorFor(el) {
    if (!el) return '';
    if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
    const classes = [...el.classList].filter(x => !/^ld2-/.test(x)).slice(0, 4);
    return `${el.tagName.toLowerCase()}${classes.length ? '.' + classes.join('.') : ''}`;
  }
  function visualContext(el) {
    const r = el.getBoundingClientRect();
    const attrs = ['role','aria-label','name','type','href','placeholder'].map(k => el.getAttribute?.(k) ? `${k}="${String(el.getAttribute(k)).slice(0,120)}"` : '').filter(Boolean).join(' ');
    const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    return `[ELEMENTO VISUAL SELECIONADO]\nSeletor aproximado: ${selectorFor(el)}\nElemento: ${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}\nDimensões visíveis: ${Math.round(r.width)}x${Math.round(r.height)} px\nTexto visível: ${text || '(sem texto)'}\nUse este contexto apenas para identificar o elemento citado pelo usuário. Não altere outros elementos sem necessidade.\n[/ELEMENTO VISUAL SELECIONADO]`;
  }
  function cleanupVisual() {
    selecting = false; visualTarget = null; visualBox?.remove(); visualBox = null;
    document.removeEventListener('pointermove', visualMove, true); document.removeEventListener('click', visualClick, true); document.removeEventListener('keydown', visualKey, true);
    bar()?.querySelector('[data-pro-visual]')?.classList.remove('active');
  }
  function visualMove(event) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el.closest?.('#ld2-root') || el.closest?.('.ld2-native-bridge') || el === visualBox) return;
    visualTarget = el;
    const r = el.getBoundingClientRect();
    if (!visualBox) { visualBox = document.createElement('div'); visualBox.className = 'ld2-visual-highlight'; document.documentElement.appendChild(visualBox); }
    Object.assign(visualBox.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }
  function visualClick(event) {
    if (!selecting || !visualTarget) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const input = inputFor(bar()); const ctx = visualContext(visualTarget); const current = readInput(input).trim();
    writeInput(input, `${current}${current ? '\n\n' : ''}${ctx}`);
    cleanupVisual(); setStatus('Visual · elemento anexado ao prompt.', 'success');
  }
  function visualKey(event) { if (event.key === 'Escape') { event.preventDefault(); cleanupVisual(); setStatus('Visual cancelado.', ''); } }
  function startVisual() {
    if (selecting) return cleanupVisual();
    selecting = true; bar()?.querySelector('[data-pro-visual]')?.classList.add('active'); setStatus('Visual · clique no elemento desejado · Esc cancela', 'active');
    document.addEventListener('pointermove', visualMove, true); document.addEventListener('click', visualClick, true); document.addEventListener('keydown', visualKey, true);
  }

  async function refreshThink(btn) {
    const enabled = await thinkEnabled(); btn.classList.toggle('active', enabled); btn.textContent = enabled ? 'Think ✓' : 'Think'; btn.title = enabled ? 'Think Mode ativo' : 'Ativar Think Mode';
  }
  function reconcile() {
    const b = bar(); if (!b) return;
    const main = b.querySelector('.ld2-bridge-main'); if (!main || main.querySelector('.ld2-pro-controls')) return;
    const wrap = document.createElement('div'); wrap.className = 'ld2-pro-controls';
    wrap.innerHTML = '<button type="button" data-pro-think>Think</button><button type="button" data-pro-rewrite>Rewrite</button><button type="button" data-pro-visual>Visual</button><button type="button" data-pro-voice title="Ditado por voz">🎤</button>';
    const spacer = main.querySelector('.ld2-bridge-spacer'); main.insertBefore(wrap, spacer || null);
    const think = wrap.querySelector('[data-pro-think]'); refreshThink(think);
    think.onclick = async () => { await chrome.storage.local.set({ [THINK_KEY]: !await thinkEnabled() }); refreshThink(think); };
    wrap.querySelector('[data-pro-rewrite]').onclick = rewritePrompt;
    wrap.querySelector('[data-pro-voice]').onclick = startVoice;
    wrap.querySelector('[data-pro-visual]').onclick = startVisual;
  }

  new MutationObserver(reconcile).observe(document.documentElement, { childList: true, subtree: true });
  reconcile();
})();