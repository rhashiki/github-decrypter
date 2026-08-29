(() => {
  'use strict';
  if (window.__LD2_DECRYPTER_CHAT_CORE__) return;
  window.__LD2_DECRYPTER_CHAT_CORE__ = true;

  const MAX_HISTORY_MESSAGES = 120;
  const MAX_MESSAGE_CHARS = 40000;
  const MAX_DRIFT = 220;
  const text = value => String(value ?? '');
  const trim = value => text(value).trim();
  const unique = values => [...new Set((values || []).map(value => trim(value)).filter(Boolean))];

  function historyKey(projectId) {
    const clean = trim(projectId).replace(/[^a-z0-9-]/gi, '').slice(0, 100);
    return `ld2_decrypter_chat_history_v1_${clean || 'unknown'}`;
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function renderMarkdown(value) {
    let source = text(value).replace(/\r\n?/g, '\n');
    const blocks = [];
    source = source.replace(/```([a-z0-9_+.-]*)\n([\s\S]*?)```/gi, (_all, lang, code) => {
      const token = `@@LD2_CODE_${blocks.length}@@`;
      blocks.push(`<pre class="ldc-code"><div class="ldc-code-head">${escapeHtml(lang || 'code')}</div><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
      return token;
    });
    source = escapeHtml(source);
    source = source.replace(/`([^`\n]+)`/g, '<code class="ldc-inline-code">$1</code>');
    source = source.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    source = source.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    source = source.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    source = source.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    source = source.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    const lines = source.split('\n');
    const out = [];
    let list = '';
    const closeList = () => { if (list) { out.push(`</${list}>`); list = ''; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-*]\s+(.+)$/);
      const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (ul) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${ul[1]}</li>`);
        continue;
      }
      if (ol) {
        if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${ol[1]}</li>`);
        continue;
      }
      closeList();
      if (!line.trim()) out.push('<div class="ldc-gap"></div>');
      else if (/^<h[1-3]>/.test(line)) out.push(line);
      else if (/^@@LD2_CODE_\d+@@$/.test(line.trim())) out.push(line.trim());
      else out.push(`<p>${line}</p>`);
    }
    closeList();
    let html = out.join('');
    blocks.forEach((block, index) => { html = html.replace(`@@LD2_CODE_${index}@@`, block); });
    return html;
  }

  function sanitizeAttachments(items = []) {
    return (Array.isArray(items) ? items : []).slice(0, 8).map(item => ({
      name: trim(item?.name).slice(0, 240),
      mimeType: trim(item?.mimeType || item?.type).slice(0, 160),
      size: Math.max(0, Number(item?.size || 0) || 0)
    })).filter(item => item.name);
  }

  function sanitizeMessage(item = {}) {
    const role = ['user', 'assistant', 'system'].includes(String(item?.role)) ? String(item.role) : 'assistant';
    return {
      id: trim(item?.id).slice(0, 100) || crypto.randomUUID(),
      role,
      mode: ['chat', 'plan', 'build', 'system'].includes(String(item?.mode)) ? String(item.mode) : 'chat',
      content: text(item?.content).slice(0, MAX_MESSAGE_CHARS),
      at: trim(item?.at).slice(0, 80) || new Date().toISOString(),
      attachments: sanitizeAttachments(item?.attachments),
      files: (Array.isArray(item?.files) ? item.files : []).slice(0, 80).map(file => ({
        path: trim(file?.path || file).slice(0, 1000),
        action: trim(file?.action).slice(0, 40),
        reason: trim(file?.reason || file?.explanation).slice(0, 1200),
        preview: trim(file?.preview).slice(0, 8000)
      })).filter(file => file.path),
      steps: (Array.isArray(item?.steps) ? item.steps : []).slice(0, 30).map(value => trim(value).slice(0, 2000)).filter(Boolean),
      warnings: (Array.isArray(item?.warnings) ? item.warnings : []).slice(0, 30).map(value => trim(value).slice(0, 2000)).filter(Boolean),
      metadata: item?.metadata && typeof item.metadata === 'object' ? {
        provider: trim(item.metadata.provider).slice(0, 120),
        model: trim(item.metadata.model).slice(0, 240),
        status: trim(item.metadata.status).slice(0, 80),
        readOnly: item.metadata.readOnly === true,
        commitCreated: item.metadata.commitCreated === true
      } : {}
    };
  }

  function sanitizeHistory(items = []) {
    return (Array.isArray(items) ? items : []).slice(-MAX_HISTORY_MESSAGES).map(sanitizeMessage);
  }

  function safeProjectState(graph = {}) {
    const state = graph && typeof graph === 'object' ? graph : {};
    return {
      schema: trim(state.schema).slice(0, 80),
      projectId: trim(state.projectId).slice(0, 100),
      status: trim(state.status).slice(0, 40),
      sources: state.sources && typeof state.sources === 'object' ? structuredClone(state.sources) : {},
      backend: state.backend && typeof state.backend === 'object' ? structuredClone(state.backend) : {},
      files: {
        counts: state.files?.counts && typeof state.files.counts === 'object' ? structuredClone(state.files.counts) : {},
        revisionsMatch: state.files?.revisionsMatch === true,
        entries: (Array.isArray(state.files?.entries) ? state.files.entries : [])
          .filter(item => item?.state !== 'same')
          .slice(0, MAX_DRIFT)
          .map(item => ({ path: trim(item?.path).slice(0, 1000), state: trim(item?.state).slice(0, 40), reason: trim(item?.reason).slice(0, 160) }))
      },
      migrations: {
        missing: unique(state.migrations?.missing || []).slice(0, 500),
        remoteOnly: unique(state.migrations?.remoteOnly || []).slice(0, 500),
        matched: unique(state.migrations?.matched || []).slice(0, 500)
      },
      edgeFunctions: {
        missing: unique(state.edgeFunctions?.missing || []).slice(0, 300),
        remoteOnly: unique(state.edgeFunctions?.remoteOnly || []).slice(0, 300),
        matched: unique(state.edgeFunctions?.matched || []).slice(0, 300),
        deployed: (Array.isArray(state.edgeFunctions?.deployed) ? state.edgeFunctions.deployed : []).slice(0, 300).map(item => ({
          slug: trim(item?.slug || item?.name).slice(0, 160), status: trim(item?.status).slice(0, 40), version: Number(item?.version || 0) || 0
        }))
      },
      database: {
        relationCount: Number(state.database?.relationCount || 0) || 0,
        columnCount: Number(state.database?.columnCount || 0) || 0,
        policyCount: Number(state.database?.policyCount || 0) || 0,
        routineCount: Number(state.database?.routineCount || 0) || 0,
        triggerCount: Number(state.database?.triggerCount || 0) || 0,
        relations: (Array.isArray(state.database?.relations) ? state.database.relations : []).slice(0, 1000).map(item => ({
          schema_name: trim(item?.schema_name).slice(0, 120), relation_name: trim(item?.relation_name).slice(0, 240), relation_type: trim(item?.relation_type).slice(0, 80), rls_enabled: item?.rls_enabled === true
        })),
        routines: (Array.isArray(state.database?.routines) ? state.database.routines : []).slice(0, 800).map(item => ({
          schema_name: trim(item?.schema_name).slice(0, 120), routine_name: trim(item?.routine_name).slice(0, 240), routine_type: trim(item?.routine_type).slice(0, 80)
        }))
      },
      auth: state.auth ? {
        site_url: trim(state.auth?.site_url).slice(0, 1000),
        uri_allow_list: (Array.isArray(state.auth?.uri_allow_list) ? state.auth.uri_allow_list : []).slice(0, 100).map(value => trim(value).slice(0, 1000)),
        google: {
          enabled: state.auth?.google?.enabled === true,
          client_id_present: state.auth?.google?.client_id_present === true,
          client_secret_present: state.auth?.google?.client_secret_present === true
        }
      } : null,
      secretNames: unique(state.secretNames || []).slice(0, 500),
      diagnostics: state.diagnostics && typeof state.diagnostics === 'object' ? {
        deepCompare: state.diagnostics.deepCompare === true,
        workspaceComplete: state.diagnostics.workspaceComplete === true,
        githubComplete: state.diagnostics.githubComplete === true,
        supabaseAvailable: state.diagnostics.supabaseAvailable === true,
        sensitiveWorkspaceFiles: Number(state.diagnostics.sensitiveWorkspaceFiles || 0) || 0
      } : {}
    };
  }

  function changedWindow(before, after, action = 'update') {
    const oldLines = text(before).split('\n');
    const newLines = text(after).split('\n');
    if (action === 'create') return { removed: [], added: newLines.slice(0, 16), prefix: [], suffix: [], truncated: newLines.length > 16 };
    if (action === 'delete') return { removed: oldLines.slice(0, 16), added: [], prefix: [], suffix: [], truncated: oldLines.length > 16 };
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    return {
      prefix: oldLines.slice(Math.max(0, start - 2), start),
      removed: oldLines.slice(start, Math.min(oldEnd + 1, start + 14)),
      added: newLines.slice(start, Math.min(newEnd + 1, start + 14)),
      suffix: newLines.slice(Math.max(start, newEnd + 1), Math.min(newLines.length, newEnd + 3)),
      truncated: oldEnd - start + 1 > 14 || newEnd - start + 1 > 14
    };
  }

  function diffPreview(before, after, action = 'update') {
    const part = changedWindow(before, after, action);
    const lines = [];
    part.prefix.forEach(line => lines.push(`  ${line}`));
    part.removed.forEach(line => lines.push(`- ${line}`));
    part.added.forEach(line => lines.push(`+ ${line}`));
    part.suffix.forEach(line => lines.push(`  ${line}`));
    if (part.truncated) lines.push('  … diff resumido …');
    return lines.join('\n').slice(0, 8000);
  }

  function chunkText(value, size = 90) {
    const source = text(value);
    const limit = Math.max(16, Math.min(500, Number(size || 90)));
    const chunks = [];
    let from = 0;
    while (from < source.length) {
      let end = Math.min(source.length, from + limit);
      if (end < source.length) {
        const boundary = source.lastIndexOf(' ', end);
        if (boundary > from + Math.floor(limit * 0.55)) end = boundary + 1;
      }
      chunks.push(source.slice(from, end));
      from = end;
    }
    return chunks;
  }

  window.LovableDecrypterChatCore = Object.freeze({
    schema: 'ld-decrypter-chat-core/1',
    historyKey,
    escapeHtml,
    renderMarkdown,
    sanitizeAttachments,
    sanitizeMessage,
    sanitizeHistory,
    safeProjectState,
    diffPreview,
    chunkText
  });
})();
