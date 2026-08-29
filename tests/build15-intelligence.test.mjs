import assert from 'node:assert/strict';
import {
  classifyIntent,
  createExecutionBrief,
  serializeExecutionBrief,
  validateProviderResult,
  assertProviderResult,
  publicIntelligenceSummary
} from '../core/decrypter-intelligence.js';

const context = {
  branch: 'main',
  treePaths: ['src/App.tsx', 'src/auth/login.ts', 'supabase/migrations/001.sql'],
  files: [
    { path: 'src/App.tsx', content: 'export default function App(){}' },
    { path: 'src/auth/login.ts', content: 'export const login = true;' }
  ]
};

assert.equal(classifyIntent('Corrija o bug de login e OAuth').primary, 'auth');
assert.equal(classifyIntent('Melhore a UI responsiva do modal mobile').primary, 'ui');
assert.equal(classifyIntent('Crie uma migration Supabase com RLS').primary, 'database');

const planBrief = createExecutionBrief({
  mode: 'plan',
  command: 'Planeje a correção do login',
  context,
  agentRules: 'Preserve arquitetura atual.',
  attachments: []
});
assert.equal(planBrief.identity, 'Decrypter Intelligence');
assert.equal(planBrief.provider.role, 'executor_only');
assert.equal(planBrief.provider.gateway_active, true);
assert.equal(planBrief.provider.gateway_build, 17);
assert.equal(planBrief.provider.gateway_authority, 'server');
assert.equal(planBrief.provider.cross_provider_fallback, false);
assert.equal(planBrief.knowledge.active, false);
assert.equal(planBrief.strategy, 'plan_only');
assert.match(serializeExecutionBrief(planBrief), /DECRYPTER_INTELLIGENCE_V1/);

const approvedPlan = {
  summary: 'Ajustar login',
  plan: ['Editar login'],
  files: [{ path: 'src/auth/login.ts', reason: 'Correção necessária' }]
};
const buildBrief = createExecutionBrief({
  mode: 'build',
  command: 'Corrija o login conforme o plano aprovado',
  context,
  agentRules: 'Não tocar em outros arquivos.',
  approvedPlan,
  attachments: []
});
assert.equal(buildBrief.strategy, 'approved_plan_execution');
assert.equal(buildBrief.validation.approved_plan_whitelist, true);

const allowed = validateProviderResult({ files: [{ path: 'src/auth/login.ts', action: 'update' }] }, buildBrief);
assert.equal(allowed.allowed, true);

const outside = validateProviderResult({ files: [{ path: 'src/App.tsx', action: 'update' }] }, buildBrief);
assert.equal(outside.allowed, false);
assert.match(outside.violations.join(' '), /outside approved plan/i);

const secret = validateProviderResult({ files: [{ path: '.env', action: 'update' }] }, createExecutionBrief({
  mode: 'build', command: 'Atualize a tela', context, agentRules: '', attachments: []
}));
assert.equal(secret.allowed, false);
assert.match(secret.violations.join(' '), /Secret file blocked/);

const deleteBrief = createExecutionBrief({ mode: 'build', command: 'Ajuste o componente', context, agentRules: '', attachments: [] });
assert.throws(() => assertProviderResult({ files: [{ path: 'src/App.tsx', action: 'delete' }] }, deleteBrief), /DECRYPTER_INTELLIGENCE_BLOCKED/);

const summary = publicIntelligenceSummary(buildBrief, allowed);
assert.equal(summary.identity, 'Decrypter Intelligence');
assert.equal(summary.validation.allowed, true);
assert.equal(Object.hasOwn(summary, 'goal'), false);
assert.equal(Object.hasOwn(summary, 'scope'), false);

console.log('Build 15 Intelligence tests passed');
