const INTELLIGENCE_SCHEMA = 'ld-intelligence/1';
const INTELLIGENCE_NAME = 'Decrypter Intelligence';
const MAX_RULE_CHARS = 160000;
const MAX_PATHS = 80;

const INTENTS = Object.freeze({
  database: [/\bsupabase\b/i, /\bpostgres/i, /\bsql\b/i, /\bmigration/i, /\bmigra[cç][aã]o/i, /\brls\b/i, /\bpolicy/i, /\bschema\b/i, /\bbanco\b/i],
  auth: [/\bauth\b/i, /\blogin\b/i, /\boauth\b/i, /\bsess(?:ion|[aã]o)/i, /\bpermission/i, /\bpermiss/i],
  github: [/\bgithub\b/i, /\bworkflow\b/i, /\bbranch\b/i, /\bcommit\b/i, /\bpull request\b/i, /\bci\b/i, /\bcd\b/i],
  ui: [/\bui\b/i, /\bux\b/i, /\bdesign\b/i, /\bcss\b/i, /\bresponsiv/i, /\bmobile\b/i, /\bdesktop\b/i, /\bmodal\b/i, /\blauncher\b/i, /\bfab\b/i],
  debugging: [/\berro\b/i, /\bbug\b/i, /\bfalha\b/i, /\bquebr/i, /\bdebug/i, /\bcorrig/i, /\bfix\b/i, /\btrav/i, /\bcarreg/i],
  security: [/\bseguran[cç]a\b/i, /\bsecurity\b/i, /\bvulnerab/i, /\bsecret/i, /\btoken\b/i, /\brls\b/i, /\bpermission/i],
  integration: [/\bapi\b/i, /\bwebhook\b/i, /\bintegra/i, /\boauth\b/i, /\bmercado pago\b/i, /\bstripe\b/i, /\binfinity/i],
  performance: [/\bperformance\b/i, /\bdesempenho\b/i, /\botimiz/i, /\blento\b/i, /\blat[eê]ncia\b/i],
  refactor: [/\brefator/i, /\bmodular/i, /\breorgan/i, /\barquitet/i],
  testing: [/\btest/i, /\bci\b/i, /\bregress/i, /\bvalid/i],
  docs: [/\bdoc(?:s|umenta)/i, /\breadme\b/i, /\bmanual\b/i],
  migration: [/\bmigra/i, /\bcloud\b/i, /\blovable cloud\b/i]
});

const HIGH_RISK_INTENTS = new Set(['database', 'auth', 'security', 'integration', 'migration']);

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unique(values) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];
}

function scoreIntent(command, patterns) {
  const source = String(command || '');
  return patterns.reduce((score, pattern) => score + (pattern.test(source) ? 1 : 0), 0);
}

export function classifyIntent(command = '') {
  const scores = Object.entries(INTENTS)
    .map(([intent, patterns]) => ({ intent, score: scoreIntent(command, patterns) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));

  if (!scores.length) return { primary: 'general', secondary: [], confidence: 0.5, signals: [] };
  const max = scores[0].score;
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  return {
    primary: scores[0].intent,
    secondary: scores.slice(1, 4).map(item => item.intent),
    confidence: Math.min(0.98, Math.max(0.55, max / Math.max(1, total) + 0.35)),
    signals: scores.slice(0, 6)
  };
}

function decodeBase64(value = '') {
  try {
    const raw = atob(String(value || ''));
    return new TextDecoder().decode(Uint8Array.from(raw, ch => ch.charCodeAt(0)));
  } catch (_) {
    return '';
  }
}

export function extractSkillSlugs(attachments = []) {
  const slugs = [];
  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    if (String(attachment?.name || '') !== 'lovable-decrypter-skill-stack.md' || !attachment?.data) continue;
    const text = decodeBase64(attachment.data);
    for (const match of text.matchAll(/^Slug:\s*([^\s]+)\s*$/gmi)) slugs.push(match[1]);
  }
  return unique(slugs).slice(0, 12);
}

function pathCategory(path = '') {
  const p = String(path || '').toLowerCase();
  if (/^\.env(?:\.|$)/.test(p) && !/^\.env\.example$/.test(p)) return 'secret';
  if (/^supabase\/migrations\//.test(p) || /(?:^|\/)migrations?\/.*\.sql$/.test(p)) return 'database';
  if (/^\.github\/workflows\//.test(p)) return 'github';
  if (/(?:auth|oauth|session|permission|security|rls|policy)/.test(p)) return 'security';
  if (/(?:payment|checkout|mercado|stripe|billing|pix|webhook)/.test(p)) return 'integration';
  if (/(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(p)) return 'dependencies';
  return 'application';
}

function inferRisk(intent, context = {}, approvedPlan = null) {
  const relevantPaths = (Array.isArray(context?.files) ? context.files : []).map(file => String(file?.path || '')).filter(Boolean);
  const categories = unique(relevantPaths.map(pathCategory));
  let score = HIGH_RISK_INTENTS.has(intent.primary) ? 2 : 0;
  if (categories.includes('database')) score += 2;
  if (categories.includes('security')) score += 2;
  if (categories.includes('secret')) score += 5;
  if (categories.includes('integration')) score += 1;
  if (approvedPlan) score = Math.max(0, score - 1);
  const level = score >= 6 ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { level, score, categories };
}

function toolRoute(intent, context = {}) {
  const recommended = ['github_repository'];
  if (['database', 'auth', 'security'].includes(intent.primary)) recommended.push('supabase');
  if (intent.primary === 'migration') recommended.push('cloud_migrator');
  if (intent.primary === 'github') recommended.push('github_workflow');
  return {
    policy: 'advisory-only-build15',
    recommended: unique(recommended),
    auto_invocation: false,
    note: 'Build 15 decides the tool route, but does not add new privileged auto-invocation. Existing authoritative runtimes remain in control.'
  };
}

function executionStrategy(mode, risk, approvedPlan) {
  if (mode === 'plan') return 'plan_only';
  if (approvedPlan) return 'approved_plan_execution';
  if (risk.level === 'high' || risk.level === 'critical') return 'scoped_build_with_strict_validation';
  return 'scoped_build';
}

function trimRuleText(value) {
  const text = String(value || '').trim();
  return text.length > MAX_RULE_CHARS ? `${text.slice(0, MAX_RULE_CHARS)}\n...[constraints truncated by Decrypter Intelligence]` : text;
}

export function createExecutionBrief({ mode = 'build', command = '', context = {}, agentRules = '', attachments = [], approvedPlan = null } = {}) {
  const cleanCommand = String(command || '').trim();
  if (!cleanCommand) throw new Error('DECRYPTER_INTELLIGENCE_COMMAND_REQUIRED');

  const intent = classifyIntent(cleanCommand);
  const risk = inferRisk(intent, context, approvedPlan);
  const relevantPaths = unique((Array.isArray(context?.files) ? context.files : []).map(file => file?.path)).slice(0, MAX_PATHS);
  const skillSlugs = extractSkillSlugs(attachments);
  const approvedPaths = unique((Array.isArray(approvedPlan?.files) ? approvedPlan.files : []).map(file => file?.path)).slice(0, MAX_PATHS);

  return Object.freeze({
    schema: INTELLIGENCE_SCHEMA,
    identity: INTELLIGENCE_NAME,
    created_at: new Date().toISOString(),
    mode: mode === 'plan' ? 'plan' : 'build',
    goal: cleanCommand,
    intent,
    risk,
    strategy: executionStrategy(mode, risk, approvedPlan),
    tool_route: toolRoute(intent, context),
    scope: {
      approved_plan: Boolean(approvedPlan),
      approved_paths: approvedPaths,
      relevant_paths: relevantPaths,
      branch: String(context?.branch || ''),
      tree_size: Array.isArray(context?.treePaths) ? context.treePaths.length : null,
      project_constraints: trimRuleText(agentRules),
      non_goals: [
        'Do not expand scope beyond the user request.',
        'Do not perform opportunistic refactors, cleanup, renames or dependency changes.',
        'Do not modify secret files or use private/internal Lovable APIs.',
        'Do not bypass Scope Lock, checkpoints, queue authority or commit validation.'
      ]
    },
    skills: { slugs: skillSlugs, count: skillSlugs.length },
    knowledge: { active: false, build: 16, label: 'Decrypter Knowledge / RAG' },
    provider: { role: 'executor_only', gateway_active: false, gateway_build: 17 },
    validation: {
      provider_result_required: true,
      scope_lock_required: mode !== 'plan',
      approved_plan_whitelist: Boolean(approvedPlan && approvedPaths.length),
      secret_file_block: true,
      explicit_delete_required: true,
      max_files: 30
    }
  });
}

export function serializeExecutionBrief(brief) {
  if (!brief || brief.schema !== INTELLIGENCE_SCHEMA) throw new Error('DECRYPTER_INTELLIGENCE_BRIEF_INVALID');
  const payload = JSON.stringify(brief);
  return [
    '[DECRYPTER_INTELLIGENCE_V1]',
    'You are the execution provider, not the product brain.',
    'The Decrypter Intelligence Execution Brief below is authoritative for goal, scope, risk, tool policy and validation.',
    'Execute only the requested mode. Never broaden scope or invent additional work.',
    'The existing runtime will independently enforce Scope Lock, minimal patches, checkpoints and commit authority.',
    '<DECRYPTER_EXECUTION_BRIEF>',
    payload,
    '</DECRYPTER_EXECUTION_BRIEF>'
  ].join('\n');
}

function explicitDelete(command = '') {
  return /\b(remov(?:a|er)|exclu(?:a|ir)|apag(?:ue|ar)|delet(?:e|ar)|delete|remove)\b/i.test(normalize(command));
}

export function validateProviderResult(result, brief) {
  const violations = [];
  const warnings = [];
  if (!result || typeof result !== 'object') violations.push('Provider returned an invalid result object.');

  const files = Array.isArray(result?.files) ? result.files : [];
  if (files.length > Number(brief?.validation?.max_files || 30)) violations.push(`Provider returned too many files (${files.length}).`);

  const approved = new Set(brief?.scope?.approved_paths || []);
  for (const file of files) {
    const path = String(file?.path || '');
    const action = String(file?.action || '').toLowerCase();
    if (!path) violations.push('Provider returned a file without path.');
    if (pathCategory(path) === 'secret') violations.push(`Secret file blocked by Decrypter Intelligence: ${path}`);
    if (action === 'delete' && !explicitDelete(brief?.goal || '')) violations.push(`Delete outside explicit user intent: ${path}`);
    if (brief?.validation?.approved_plan_whitelist && path && !approved.has(path)) violations.push(`File outside approved plan: ${path}`);
  }

  if (brief?.mode === 'plan' && files.some(file => Object.prototype.hasOwnProperty.call(file || {}, 'content') || Object.prototype.hasOwnProperty.call(file || {}, 'edits'))) {
    warnings.push('Plan provider returned implementation-shaped fields; runtime will ignore code content.');
  }

  const allowed = violations.length === 0;
  return { allowed, violations, warnings, checked_at: new Date().toISOString() };
}

export function assertProviderResult(result, brief) {
  const validation = validateProviderResult(result, brief);
  if (!validation.allowed) {
    const error = new Error(`DECRYPTER_INTELLIGENCE_BLOCKED: ${validation.violations.join(' | ')}`);
    error.code = 'DECRYPTER_INTELLIGENCE_BLOCKED';
    error.intelligenceValidation = validation;
    throw error;
  }
  return validation;
}

export function publicIntelligenceSummary(brief, validation = null) {
  return Object.freeze({
    schema: brief?.schema || INTELLIGENCE_SCHEMA,
    identity: INTELLIGENCE_NAME,
    mode: brief?.mode || 'build',
    intent: brief?.intent || { primary: 'general', secondary: [], confidence: 0 },
    risk: brief?.risk || { level: 'low', score: 0, categories: [] },
    strategy: brief?.strategy || 'scoped_build',
    tool_route: brief?.tool_route || { recommended: ['github_repository'], auto_invocation: false },
    skills: brief?.skills || { slugs: [], count: 0 },
    knowledge: brief?.knowledge || { active: false, build: 16 },
    provider: brief?.provider || { role: 'executor_only', gateway_active: false, gateway_build: 17 },
    validation: validation ? { allowed: validation.allowed, warnings: validation.warnings || [] } : null,
    created_at: brief?.created_at || new Date().toISOString()
  });
}

export const DecrypterIntelligence = Object.freeze({
  schema: INTELLIGENCE_SCHEMA,
  name: INTELLIGENCE_NAME,
  classifyIntent,
  createExecutionBrief,
  serializeExecutionBrief,
  validateProviderResult,
  assertProviderResult,
  publicIntelligenceSummary,
  extractSkillSlugs
});
