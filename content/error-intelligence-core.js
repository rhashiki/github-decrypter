(() => {
  'use strict';
  if (window.__LD2_ERROR_INTELLIGENCE_CORE__) return;
  window.__LD2_ERROR_INTELLIGENCE_CORE__ = true;

  const MAX_MESSAGE = 700;
  const MAX_DETAIL = 900;
  const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

  const CATALOG = Object.freeze([
    {
      id: 'github',
      match: /github|repo(?:sitory)?|branch|commit|git\b|gh_app|installation/i,
      title: 'Falha na integração com o GitHub',
      cause: 'Credenciais, instalação do GitHub App, repositório, branch ou conectividade podem estar indisponíveis.',
      action: { type: 'github', label: 'Revisar GitHub' }
    },
    {
      id: 'supabase',
      match: /supabase|postgres|edge.?function|storage.?bucket|rpc\b|relation|database/i,
      title: 'Falha na integração com o Supabase',
      cause: 'O projeto, autenticação, recurso de banco, Storage ou Edge Function pode não estar disponível.',
      action: { type: 'diagnostic', label: 'Atualizar diagnóstico' }
    },
    {
      id: 'gemini',
      match: /gemini|generativelanguage|model.?gateway|quota|resource_exhausted|429|free.?tier/i,
      title: 'Falha no modelo Gemini',
      cause: 'A chave, o modelo gratuito selecionado, a cota free tier ou a conectividade podem impedir a chamada.',
      action: { type: 'settings', label: 'Revisar Gemini' }
    },
    {
      id: 'lovable',
      match: /lovable|workspace|lovable_session|lovable_http|project_unavailable/i,
      title: 'Falha no Workspace Lovable',
      cause: 'A sessão do Lovable, o projeto atual ou uma leitura do Workspace pode não estar disponível.',
      action: { type: 'diagnostic', label: 'Atualizar diagnóstico' }
    },
    {
      id: 'license',
      match: /license|licen[cç]a|entitlement|activation|ativa[cç][aã]o|\bkey\b|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i,
      title: 'Problema de licença ou autorização',
      cause: 'A licença pode estar ausente, expirada, inválida ou sem autorização para a operação solicitada.',
      action: { type: 'license', label: 'Ver licença' }
    },
    {
      id: 'security',
      match: /hardening|sentinel|composer.?guardian|composer.?bridge|fail.?closed|routing|native_send|locked|degraded/i,
      title: 'Proteção de execução degradada',
      cause: 'Uma garantia de roteamento, composer ou hardening não pôde ser confirmada. O Decrypter mantém o comportamento fail-closed.',
      action: { type: 'diagnostic', label: 'Verificar proteção' }
    },
    {
      id: 'migration',
      match: /migration|migrat|cloud.?migrator|schema/i,
      title: 'Falha durante a migração',
      cause: 'Uma etapa da migração não foi confirmada ou um recurso de origem/destino ficou indisponível.',
      action: { type: 'migrate', label: 'Abrir migrações' }
    },
    {
      id: 'zip',
      match: /\bzip\b|download|workspace_zip|too_many_files|too_large/i,
      title: 'Falha ao preparar ou baixar o ZIP',
      cause: 'O Workspace pode estar incompleto, grande demais ou temporariamente indisponível para leitura.',
      action: { type: 'zip', label: 'Tentar ZIP novamente' }
    },
    {
      id: 'network',
      match: /network|offline|failed to fetch|fetch failed|timeout|timed out|abort|econn|dns|http_5\d\d|\b5\d\d\b/i,
      title: 'Falha de rede ou serviço',
      cause: 'A conexão ou um serviço remoto necessário não respondeu corretamente.',
      action: { type: 'diagnostic', label: 'Atualizar diagnóstico' }
    }
  ]);

  function text(value) { return String(value ?? '').trim(); }

  function sanitizeUrl(raw) {
    try {
      const url = new URL(raw);
      url.search = url.search ? '?redacted=1' : '';
      url.hash = '';
      return url.toString();
    } catch (_) {
      return raw.replace(/([?&](?:token|key|api[_-]?key|access[_-]?token|authorization)=)[^&#\s]+/gi, '$1[REDACTED]');
    }
  }

  function sanitizeText(value, limit = MAX_MESSAGE) {
    let out = text(value);
    if (!out) return '';
    out = out
      .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_GOOGLE_KEY]')
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
      .replace(/\bLD2\.[A-Za-z0-9._-]{8,}\b/gi, '[REDACTED_LICENSE]')
      .replace(/((?:token|api[_-]?key|access[_-]?token|authorization|license[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
      .replace(/https?:\/\/[^\s<>"']+/gi, match => sanitizeUrl(match));
    return out.slice(0, Math.max(1, Number(limit) || MAX_MESSAGE));
  }

  function sourceHint(value) {
    const source = text(value).toLowerCase();
    if (!source) return '';
    if (/github|repo|git/.test(source)) return 'github';
    if (/supabase|database|storage|edge/.test(source)) return 'supabase';
    if (/gemini|model/.test(source)) return 'gemini';
    if (/lovable|workspace/.test(source)) return 'lovable';
    if (/license|commercial|entitlement/.test(source)) return 'license';
    if (/hardening|composer|sentinel|security/.test(source)) return 'security';
    if (/migrat/.test(source)) return 'migration';
    if (/zip|download/.test(source)) return 'zip';
    return source.replace(/[^a-z0-9._-]+/g, '_').slice(0, 48);
  }

  function severityFor(input, corpus) {
    const explicit = text(input?.severity).toLowerCase();
    if (SEVERITIES.has(explicit)) return explicit;
    if (/critical|panic|corrupt|data.?loss|trust.?violation/i.test(corpus)) return 'critical';
    if (/locked|forbidden|unauthori[sz]ed|failed|failure|falha|unavailable|indispon[ií]vel|\b5\d\d\b/i.test(corpus)) return 'high';
    if (/degraded|warning|aviso|timeout|quota|429/i.test(corpus)) return 'medium';
    return 'low';
  }

  function fingerprint(value) {
    const source = text(value);
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function classify(input = {}) {
    const error = input?.error;
    const rawMessage = input?.message ?? error?.message ?? error ?? 'Erro não identificado.';
    const message = sanitizeText(rawMessage, MAX_MESSAGE) || 'Erro não identificado.';
    const code = sanitizeText(input?.code || error?.code || '', 120).replace(/\s+/g, '_').toUpperCase();
    const hintedSource = sourceHint(input?.source);
    const corpus = `${hintedSource} ${code} ${message}`;
    let definition = hintedSource ? CATALOG.find(item => item.id === hintedSource) : null;
    if (!definition) definition = CATALOG.find(item => item.match.test(corpus)) || null;
    const source = definition?.id || hintedSource || 'runtime';
    const severity = severityFor(input, corpus);
    const title = sanitizeText(input?.title || definition?.title || 'Erro do Lovable Decrypter', 140);
    const cause = sanitizeText(input?.cause || definition?.cause || 'A causa ainda não foi identificada automaticamente.', 320);
    const detail = sanitizeText(input?.detail || '', MAX_DETAIL);
    const recovery = Object.freeze({
      type: text(input?.recovery?.type || definition?.action?.type || 'diagnostic'),
      label: sanitizeText(input?.recovery?.label || definition?.action?.label || 'Atualizar diagnóstico', 80)
    });
    const fp = fingerprint(`${source}|${code}|${title}|${message}`);
    return Object.freeze({
      schema: 'ld-error-intelligence/1',
      id: `lde_${fp}`,
      fingerprint: fp,
      code: code || `LD_${source.toUpperCase()}_ERROR`,
      source,
      severity,
      title,
      message,
      detail,
      cause,
      recovery,
      at: Number(input?.at || Date.now()),
      count: Math.max(1, Number(input?.count || 1))
    });
  }

  window.LovableDecrypterErrorIntelligenceCore = Object.freeze({
    build: 35,
    schema: 'ld-error-intelligence-core/1',
    catalog: CATALOG.map(item => Object.freeze({ id: item.id, title: item.title, cause: item.cause, action: item.action })),
    sanitizeText,
    classify
  });
})();
