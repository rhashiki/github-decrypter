(() => {
  'use strict';
  if (window.__LD2_HARDENING_CORE__) return;
  window.__LD2_HARDENING_CORE__ = true;

  const CAPABILITY_IDS = Object.freeze([
    'workspace.tree',
    'workspace.file',
    'workspace.metadata',
    'workspace.download',
    'project.state_graph',
    'recovery.scan',
    'composer.mount',
    'chat.host',
    'plan.surface',
    'approval.transaction'
  ]);

  const text = value => String(value ?? '').trim();
  const allowedStatus = new Set(['ready', 'degraded', 'unavailable', 'inactive']);

  function normalizeCapability(item = {}) {
    const id = text(item.id);
    return Object.freeze({
      id,
      required: item.required === true,
      status: allowedStatus.has(text(item.status).toLowerCase()) ? text(item.status).toLowerCase() : 'unavailable',
      reason: text(item.reason).slice(0, 240),
      build: Number(item.build || 0) || 0
    });
  }

  function summarizeCapabilities(items = [], { routingEnabled = true } = {}) {
    const capabilities = (Array.isArray(items) ? items : []).map(normalizeCapability).filter(item => item.id);
    const missingIds = CAPABILITY_IDS.filter(id => !capabilities.some(item => item.id === id));
    const required = capabilities.filter(item => item.required && !(item.id === 'chat.host' && !routingEnabled));
    const unavailable = required.filter(item => item.status === 'unavailable');
    const degraded = required.filter(item => item.status === 'degraded');
    const status = unavailable.length ? 'broken' : degraded.length ? 'degraded' : missingIds.length ? 'partial' : 'ready';
    return Object.freeze({
      schema: 'ld-capability-summary/1',
      status,
      counts: Object.freeze({
        total: capabilities.length,
        ready: capabilities.filter(item => item.status === 'ready').length,
        degraded: capabilities.filter(item => item.status === 'degraded').length,
        unavailable: capabilities.filter(item => item.status === 'unavailable').length,
        inactive: capabilities.filter(item => item.status === 'inactive').length
      }),
      missingIds,
      requiredUnavailable: unavailable.map(item => item.id),
      requiredDegraded: degraded.map(item => item.id),
      capabilities
    });
  }

  function evaluateHardening({ online = true, routingEnabled = true, chat = null, capabilitySummary = null } = {}) {
    if (!routingEnabled) return Object.freeze({ phase: 'READY', reason: 'native_mode', failClosed: false });
    if (!online) return Object.freeze({ phase: 'LOCKED', reason: 'offline', failClosed: true });

    const chatPhase = text(chat?.phase).toUpperCase();
    if (chatPhase === 'LOCKED') return Object.freeze({ phase: 'LOCKED', reason: text(chat?.reason) || 'chat_locked', failClosed: true });
    if (!chat?.mounted || chatPhase === 'DEGRADED') return Object.freeze({ phase: 'DEGRADED', reason: text(chat?.reason) || 'chat_not_mounted', failClosed: true });
    if (capabilitySummary?.status === 'broken') return Object.freeze({ phase: 'DEGRADED', reason: 'required_capability_unavailable', failClosed: true });
    if (capabilitySummary?.status === 'degraded' || capabilitySummary?.status === 'partial') return Object.freeze({ phase: 'DEGRADED', reason: 'capability_health_degraded', failClosed: true });
    if (chatPhase === 'BUSY') return Object.freeze({ phase: 'BUSY', reason: text(chat?.reason) || 'chat_busy', failClosed: true });
    return Object.freeze({ phase: 'READY', reason: 'protected', failClosed: true });
  }

  function shouldBlockNativeIntent({
    routingEnabled = false,
    ownSurface = false,
    kind = '',
    composer = false,
    sendLike = false,
    key = '',
    shiftKey = false,
    altKey = false,
    isComposing = false
  } = {}) {
    if (!routingEnabled || ownSurface) return false;
    const type = text(kind).toLowerCase();
    if (type === 'keydown') return composer && key === 'Enter' && !shiftKey && !altKey && !isComposing;
    if (type === 'click') return sendLike && composer;
    if (type === 'submit') return composer;
    return false;
  }

  window.LovableDecrypterHardeningCore = Object.freeze({
    build: 31,
    schema: 'ld-hardening-core/1',
    capabilityIds: CAPABILITY_IDS,
    normalizeCapability,
    summarizeCapabilities,
    evaluateHardening,
    shouldBlockNativeIntent
  });
})();