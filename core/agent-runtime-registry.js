export const AGENT_RUNTIME_REGISTRY_SCHEMA = 'ld-agent-runtime-registry/1';
export const AGENT_RUNTIME_EVENT_SCHEMA = 'ld-agent-runtime-event/1';
export const AGENT_RUNTIME_TRANSPORT_SCHEMA = 'ld-agent-runtime-transport/1';

const te = new TextEncoder();
const MAX_PROMPT_BYTES = 1_048_576;
const SAFE_WINDOWS_ARGV_BYTES = 24_000;
const SAFE_POSIX_ARGV_BYTES = 96_000;
const EVENT_TYPES = new Set(['status','session','message','delta','tool','diagnostic','proposal','error','done']);
const TRANSPORTS = new Set(['http','websocket','cli','stdio','acp','app-server-jsonrpc','bridge']);

const freeze = value => Object.freeze(value);
const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const bool = value => value === true;
const nowIso = () => new Date().toISOString();

function capabilitySet(input = {}) {
  return freeze({
    read: bool(input.read),
    propose: bool(input.propose),
    diagnostics: bool(input.diagnostics),
    toolEvents: bool(input.toolEvents),
    streaming: bool(input.streaming),
    modelDiscovery: bool(input.modelDiscovery),
    nativeSessions: bool(input.nativeSessions),
    cancel: bool(input.cancel),
    fileContext: bool(input.fileContext),
    imageContext: bool(input.imageContext),
    terminal: bool(input.terminal),
    browser: bool(input.browser),
    mcp: bool(input.mcp),
    writeAuthority: false
  });
}

function transport(id, options = {}) {
  if (!TRANSPORTS.has(id)) throw Object.assign(new Error('AGENT_RUNTIME_TRANSPORT_INVALID'), { code:'AGENT_RUNTIME_TRANSPORT_INVALID' });
  return freeze({
    id,
    directFromExtension: options.directFromExtension === true,
    bridgeRequired: options.bridgeRequired === true,
    structuredEvents: options.structuredEvents === true,
    supportsStdin: options.supportsStdin === true,
    supportsPromptFile: options.supportsPromptFile === true,
    supportsArgv: options.supportsArgv === true,
    notes: text(options.notes, 600)
  });
}

export const AGENT_RUNTIME_DEFINITIONS = freeze([
  freeze({
    id:'decrypter-local',
    label:'Decrypter Local',
    vendor:'Lovable Decrypter',
    family:'local-first',
    defaultEndpoint:'http://127.0.0.1:8000',
    probeKind:'decrypter-local',
    transports:freeze([transport('http',{ directFromExtension:true, structuredEvents:false })]),
    capabilities:capabilitySet({ read:true, propose:true, diagnostics:true, modelDiscovery:true, cancel:true, fileContext:true }),
    nativeSession:freeze({ supported:false, strategy:'none' }),
    compatibility:freeze({ policy:'decrypter-schema', minimumVersion:null, versionProbe:'health' }),
    auth:freeze({ mode:'session-bearer', durable:false, promptVisible:false }),
    authority:freeze({ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true })
  }),
  freeze({
    id:'openhands-agent-server',
    label:'OpenHands Agent Server',
    vendor:'OpenHands',
    family:'agent-server',
    defaultEndpoint:'http://127.0.0.1:8001',
    probeKind:'openhands-server-info',
    transports:freeze([
      transport('http',{ directFromExtension:true, structuredEvents:true }),
      transport('websocket',{ directFromExtension:true, structuredEvents:true })
    ]),
    capabilities:capabilitySet({ read:true, propose:true, diagnostics:true, toolEvents:true, streaming:true, nativeSessions:true, cancel:true, fileContext:true, imageContext:true, terminal:true, browser:true, mcp:true }),
    nativeSession:freeze({ supported:true, strategy:'remote-conversation' }),
    compatibility:freeze({ policy:'semver-observed', minimumVersion:null, versionProbe:'server_info' }),
    auth:freeze({ mode:'optional-bearer', durable:false, promptVisible:false }),
    authority:freeze({ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true })
  }),
  freeze({
    id:'codex-cli',
    label:'Codex CLI',
    vendor:'OpenAI',
    family:'cli-agent',
    defaultEndpoint:null,
    probeKind:'bridge-cli',
    transports:freeze([
      transport('app-server-jsonrpc',{ bridgeRequired:true, structuredEvents:true, supportsStdin:true, supportsPromptFile:true }),
      transport('cli',{ bridgeRequired:true, structuredEvents:true, supportsStdin:true, supportsPromptFile:true, supportsArgv:true })
    ]),
    capabilities:capabilitySet({ read:true, propose:true, diagnostics:true, toolEvents:true, streaming:true, modelDiscovery:true, nativeSessions:true, cancel:true, fileContext:true, imageContext:true, terminal:true, mcp:true }),
    nativeSession:freeze({ supported:true, strategy:'cli-resume' }),
    compatibility:freeze({ policy:'bridge-semver', minimumVersion:null, versionProbe:'codex --version' }),
    auth:freeze({ mode:'runtime-owned', durable:false, promptVisible:false }),
    authority:freeze({ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true })
  }),
  freeze({
    id:'opencode',
    label:'OpenCode',
    vendor:'OpenCode',
    family:'hybrid-server-cli',
    defaultEndpoint:'http://127.0.0.1:4096',
    probeKind:'opencode-openapi',
    transports:freeze([
      transport('http',{ directFromExtension:true, structuredEvents:true }),
      transport('acp',{ bridgeRequired:true, structuredEvents:true, supportsStdin:true }),
      transport('cli',{ bridgeRequired:true, structuredEvents:true, supportsStdin:true, supportsPromptFile:true, supportsArgv:true })
    ]),
    capabilities:capabilitySet({ read:true, propose:true, diagnostics:true, toolEvents:true, streaming:true, modelDiscovery:true, nativeSessions:true, cancel:true, fileContext:true, terminal:true, mcp:true }),
    nativeSession:freeze({ supported:true, strategy:'cli-resume' }),
    compatibility:freeze({ policy:'openapi-or-bridge', minimumVersion:null, versionProbe:'/doc or bridge version' }),
    auth:freeze({ mode:'optional-basic-session', durable:false, promptVisible:false }),
    authority:freeze({ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true })
  }),
  freeze({
    id:'aider',
    label:'Aider',
    vendor:'Aider',
    family:'cli-agent',
    defaultEndpoint:null,
    probeKind:'bridge-cli',
    transports:freeze([
      transport('cli',{ bridgeRequired:true, structuredEvents:false, supportsStdin:true, supportsPromptFile:true, supportsArgv:true })
    ]),
    capabilities:capabilitySet({ read:true, propose:true, diagnostics:true, streaming:true, cancel:true, fileContext:true, imageContext:true, terminal:true }),
    nativeSession:freeze({ supported:false, strategy:'none' }),
    compatibility:freeze({ policy:'bridge-semver', minimumVersion:null, versionProbe:'aider --version' }),
    auth:freeze({ mode:'runtime-owned', durable:false, promptVisible:false }),
    authority:freeze({ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true })
  })
]);

const BY_ID = new Map(AGENT_RUNTIME_DEFINITIONS.map(def => [def.id, def]));

export function getAgentRuntimeDefinition(runtimeId = '') {
  const id = text(runtimeId, 120).toLowerCase();
  const def = BY_ID.get(id);
  if (!def) throw Object.assign(new Error('AGENT_RUNTIME_UNKNOWN'), { code:'AGENT_RUNTIME_UNKNOWN', runtimeId:id });
  return def;
}

export function listAgentRuntimeDefinitions() {
  return AGENT_RUNTIME_DEFINITIONS.map(runtimePublicDefinition);
}

export function runtimePublicDefinition(defOrId) {
  const def = typeof defOrId === 'string' ? getAgentRuntimeDefinition(defOrId) : defOrId;
  return {
    schema:AGENT_RUNTIME_REGISTRY_SCHEMA,
    id:def.id,
    label:def.label,
    vendor:def.vendor,
    family:def.family,
    defaultEndpoint:def.defaultEndpoint,
    probeKind:def.probeKind,
    transports:def.transports.map(item => ({ ...item })),
    capabilities:{ ...def.capabilities, writeAuthority:false },
    nativeSession:{ ...def.nativeSession },
    compatibility:{ ...def.compatibility },
    auth:{ ...def.auth },
    authority:{ canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true }
  };
}

export function normalizeRuntimeCapabilities(input = {}) {
  const known = capabilitySet(input);
  return { ...known, writeAuthority:false };
}

function parseVersion(value = '') {
  const match = String(value || '').match(/(?:^|\s|v)(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?/);
  if (!match) return null;
  return { major:Number(match[1]), minor:Number(match[2]), patch:Number(match[3]), raw:match[0].trim() };
}

export function compareRuntimeVersions(a = '', b = '') {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (const key of ['major','minor','patch']) {
    if (left[key] > right[key]) return 1;
    if (left[key] < right[key]) return -1;
  }
  return 0;
}

export function evaluateRuntimeCompatibility(runtimeId, detectedVersion = '') {
  const def = getAgentRuntimeDefinition(runtimeId);
  const detected = parseVersion(detectedVersion);
  const minimum = parseVersion(def.compatibility.minimumVersion || '');
  if (!detectedVersion) return { compatible:true, state:'unknown', detectedVersion:null, policy:def.compatibility.policy };
  if (!detected) return { compatible:true, state:'unparsed', detectedVersion:text(detectedVersion, 160), policy:def.compatibility.policy };
  if (minimum && compareRuntimeVersions(detectedVersion, def.compatibility.minimumVersion) < 0) {
    return { compatible:false, state:'too-old', detectedVersion:text(detectedVersion,160), minimumVersion:def.compatibility.minimumVersion, policy:def.compatibility.policy };
  }
  return { compatible:true, state:'compatible', detectedVersion:text(detectedVersion,160), policy:def.compatibility.policy };
}

function safeEventType(raw = {}) {
  const candidate = text(raw.type || raw.event || raw.kind || '', 80).toLowerCase().replace(/[^a-z0-9_-]+/g,'_');
  if (EVENT_TYPES.has(candidate)) return candidate;
  if (/error|fail/.test(candidate)) return 'error';
  if (/complete|finish|done|end/.test(candidate)) return 'done';
  if (/tool|command|action/.test(candidate)) return 'tool';
  if (/delta|chunk|token/.test(candidate)) return 'delta';
  if (/session|thread|conversation/.test(candidate)) return 'session';
  return 'status';
}

export function normalizeRuntimeEvent(runtimeId, raw = {}, options = {}) {
  const def = getAgentRuntimeDefinition(runtimeId);
  const type = safeEventType(raw || {});
  const sessionId = text(raw.session_id || raw.sessionId || raw.thread_id || raw.threadId || raw.conversation_id || raw.conversationId || '', 240) || null;
  const textValue = ['message','delta','diagnostic','proposal','error'].includes(type)
    ? text(raw.text ?? raw.message ?? raw.content ?? raw.delta ?? raw.error ?? '', 32000)
    : '';
  const toolName = type === 'tool' ? text(raw.tool || raw.name || raw.command || '', 240) : '';
  const code = type === 'error' ? text(raw.code || raw.error_code || '', 160) : '';
  return {
    schema:AGENT_RUNTIME_EVENT_SCHEMA,
    runtimeId:def.id,
    type,
    timestamp:text(raw.timestamp || raw.created_at || options.timestamp || nowIso(), 80),
    sessionId,
    text:textValue || null,
    tool:toolName || null,
    code:code || null,
    done:type === 'done',
    reasoningOmitted:true,
    rawOmitted:true,
    writeAuthority:false
  };
}

function promptBytes(prompt = '') {
  return te.encode(String(prompt ?? '')).byteLength;
}

function executableRisk(executable = '', platform = '') {
  const exe = String(executable || '').toLowerCase();
  return /^win/i.test(String(platform || '')) && /\.(cmd|bat)$/.test(exe);
}

export function planPromptTransport({
  runtimeId,
  prompt = '',
  transportId = '',
  platform = '',
  executable = '',
  requested = 'auto',
  supportsStdin,
  supportsPromptFile,
  supportsArgv
} = {}) {
  const def = getAgentRuntimeDefinition(runtimeId);
  const selected = transportId ? def.transports.find(item => item.id === transportId) : def.transports[0];
  if (!selected) throw Object.assign(new Error('AGENT_RUNTIME_TRANSPORT_UNSUPPORTED'), { code:'AGENT_RUNTIME_TRANSPORT_UNSUPPORTED' });
  const bytes = promptBytes(prompt);
  if (bytes > MAX_PROMPT_BYTES) throw Object.assign(new Error('AGENT_PROMPT_TOO_LARGE'), { code:'AGENT_PROMPT_TOO_LARGE', bytes, maxBytes:MAX_PROMPT_BYTES });

  const caps = {
    stdin:supportsStdin ?? selected.supportsStdin,
    file:supportsPromptFile ?? selected.supportsPromptFile,
    argv:supportsArgv ?? selected.supportsArgv
  };
  const req = ['auto','stdin','file','argv'].includes(String(requested || '').toLowerCase()) ? String(requested).toLowerCase() : 'auto';
  const windows = /^win/i.test(String(platform || ''));
  const argvLimit = windows ? SAFE_WINDOWS_ARGV_BYTES : SAFE_POSIX_ARGV_BYTES;
  const batchRisk = executableRisk(executable, platform) && /[%!^&|<>\r\n]/.test(String(prompt || ''));

  let delivery = req;
  if (delivery === 'auto') {
    if (caps.stdin) delivery = 'stdin';
    else if (caps.file) delivery = 'file';
    else if (caps.argv && bytes <= argvLimit && !batchRisk) delivery = 'argv';
    else delivery = 'bridge';
  }
  if (delivery === 'stdin' && !caps.stdin) throw Object.assign(new Error('AGENT_PROMPT_STDIN_UNSUPPORTED'), { code:'AGENT_PROMPT_STDIN_UNSUPPORTED' });
  if (delivery === 'file' && !caps.file) throw Object.assign(new Error('AGENT_PROMPT_FILE_UNSUPPORTED'), { code:'AGENT_PROMPT_FILE_UNSUPPORTED' });
  if (delivery === 'argv') {
    if (!caps.argv) throw Object.assign(new Error('AGENT_PROMPT_ARGV_UNSUPPORTED'), { code:'AGENT_PROMPT_ARGV_UNSUPPORTED' });
    if (bytes > argvLimit) throw Object.assign(new Error('AGENT_PROMPT_ARGV_LIMIT'), { code:'AGENT_PROMPT_ARGV_LIMIT', bytes, maxBytes:argvLimit });
    if (batchRisk) throw Object.assign(new Error('AGENT_PROMPT_ENV_EXPANSION_RISK'), { code:'AGENT_PROMPT_ENV_EXPANSION_RISK' });
  }
  if (selected.bridgeRequired && !['stdin','file','argv','bridge'].includes(delivery)) delivery = 'bridge';

  return {
    schema:AGENT_RUNTIME_TRANSPORT_SCHEMA,
    runtimeId:def.id,
    transportId:selected.id,
    bridgeRequired:selected.bridgeRequired,
    delivery,
    bytes,
    maxArgvBytes:argvLimit,
    shell:false,
    shellInterpolation:false,
    environmentExpansion:false,
    promptInEnvironment:false,
    secretInPrompt:false,
    writeAuthority:false
  };
}

export function createRuntimeWatchdog({ firstOutputTimeoutMs = 30000, inactivityTimeoutMs = 120000, totalTimeoutMs = 240000, now = () => Date.now() } = {}) {
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const policy = {
    firstOutputTimeoutMs:clamp(firstOutputTimeoutMs,1000,120000,30000),
    inactivityTimeoutMs:clamp(inactivityTimeoutMs,5000,300000,120000),
    totalTimeoutMs:clamp(totalTimeoutMs,10000,900000,240000)
  };
  const startedAt = now();
  let lastActivityAt = startedAt;
  let firstOutputAt = null;
  let cancelled = false;
  let cancelReason = null;
  return Object.freeze({
    policy:Object.freeze({ ...policy }),
    touch({ output = false } = {}) {
      if (cancelled) return this.status();
      lastActivityAt = now();
      if (output && firstOutputAt === null) firstOutputAt = lastActivityAt;
      return this.status();
    },
    cancel(reason = 'cancelled') {
      cancelled = true;
      cancelReason = text(reason, 160) || 'cancelled';
      return this.status();
    },
    status() {
      const current = now();
      let code = cancelReason;
      if (!cancelled && firstOutputAt === null && current - startedAt > policy.firstOutputTimeoutMs) code = 'AGENT_RUNTIME_FIRST_OUTPUT_TIMEOUT';
      else if (!cancelled && current - lastActivityAt > policy.inactivityTimeoutMs) code = 'AGENT_RUNTIME_INACTIVITY_TIMEOUT';
      else if (!cancelled && current - startedAt > policy.totalTimeoutMs) code = 'AGENT_RUNTIME_TOTAL_TIMEOUT';
      return {
        cancelled:cancelled || Boolean(code),
        code:code || null,
        firstOutputSeen:firstOutputAt !== null,
        startedAt,
        lastActivityAt,
        firstOutputAt,
        elapsedMs:Math.max(0,current-startedAt)
      };
    }
  });
}

export function assertExternalRuntimeNotWriteAuthority(runtimeId) {
  const def = getAgentRuntimeDefinition(runtimeId);
  if (def.authority.canWriteAuthoritative === true || def.capabilities.writeAuthority === true) {
    throw Object.assign(new Error('AGENT_RUNTIME_WRITE_AUTHORITY_FORBIDDEN'), { code:'AGENT_RUNTIME_WRITE_AUTHORITY_FORBIDDEN', runtimeId:def.id });
  }
  return { runtimeId:def.id, canPropose:true, canWriteAuthoritative:false, requiresDecrypterApproval:true };
}
