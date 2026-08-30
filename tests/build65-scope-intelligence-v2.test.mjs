import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  SCOPE_INTELLIGENCE_SCHEMA,
  deriveHumanIntentLocks,
  evaluateScopeIntelligence,
  scopeIntelligenceFingerprint
} from '../core/scope-intelligence-v2.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const runtime = read('background/scope-intelligence-runtime.js');
const approval = read('background/approval-runtime.js');
const approvalTx = read('core/approval-transaction.js');
const toolRuntime = read('background/tool-runtime.js');
const scope = read('core/scope-intelligence-v2.js');
const context = read('core/context-engine-v2.js');
const userEdit = read('content/user-edit-context.js');

assert.equal(manifest.version, '2.6.65');
assert.match(manifest.version_name, /Build 65 · Scope Intelligence v2 \+ Human Intent/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.65'"));
assert.ok(settings.includes("SCOPE_INTELLIGENCE_SCHEMA = 'ld-scope-intelligence/2'"));
assert.equal(SCOPE_INTELLIGENCE_SCHEMA, 'ld-scope-intelligence/2');

assert.ok(entry.includes("import { installScopeIntelligenceRuntime } from './scope-intelligence-runtime.js';"));
assert.ok(entry.includes('installScopeIntelligenceRuntime();'));
for (const token of [
  "PORT_NAME = 'ld2-scope-intelligence'",
  "comparison: 'request->approved-plan->prepared-diff'",
  "enforcement: 'fail-closed-before-write'",
  "humanIntentPolicy: 'USER_EDIT > AI_EDIT'",
  'skipApprovalBypassesScope: false'
]) assert.ok(runtime.includes(token), token);

for (const token of [
  'deriveHumanIntentLocks',
  "level: lock.count >= 2 ? 'strong' : 'soft'",
  'human-intent-override-required',
  'outside-approved-plan',
  'broad-rewrite',
  'external-change-signal',
  "policy: 'USER_EDIT > AI_EDIT'",
  "enforcement: 'fail-closed-before-write'",
  'scopeIntelligenceFingerprint'
]) assert.ok(scope.includes(token), token);

for (const token of [
  'assertScopeIntelligence',
  'scopeIntelligenceFingerprint',
  'loadRecentUserEdits',
  'scopeIntelligenceHash',
  'SCOPE_INTELLIGENCE_CHANGED_AFTER_VALIDATION',
  'Revalidando intenção humana imediatamente antes do write',
  'humanIntentOverrides: tx.humanIntentOverrides',
  'scopeIntelligence: error?.scopeIntelligence || null',
  'scopeIntelligenceCanBeSkipped: false',
  'genericPlanApprovalOverridesHumanIntent: false'
]) assert.ok(approval.includes(token), token);

for (const token of [
  'humanIntentOverrides',
  'scopeIntelligenceHash',
  'scopeIntelligenceV2: true',
  'humanIntentLocks: true',
  'genericPlanApprovalOverridesHumanIntent: false'
]) assert.ok(approvalTx.includes(token), token);

assert.ok(toolRuntime.includes("writePolicy: 'validated-approval+scope-intelligence-v2'"));
assert.ok(toolRuntime.includes('scopeIntelligenceHash'));
assert.ok(toolRuntime.includes('scopeIntelligenceValidated: true'));
assert.ok(toolRuntime.includes('scopeIntelligenceRequiredForWrites: true'));
assert.ok(context.includes('explicit-user-manual-edit'));
assert.ok(userEdit.includes('rawKeystrokesPersisted: false'));
assert.ok(userEdit.includes('contentPersisted: false'));

const now = Date.parse('2026-08-30T15:00:00Z');
const recentEdits = [
  { id:'u1', origin:'user', observedAt:'2026-08-30T14:00:00Z', paths:['src/App.tsx'], evidence:['recent-code-editor-input'] },
  { id:'u2', origin:'user', observedAt:'2026-08-30T14:30:00Z', paths:['src/App.tsx'], evidence:['workspace-revision-changed'] },
  { id:'u3', origin:'user', observedAt:'2026-08-30T14:40:00Z', paths:['src/Profile.tsx'], evidence:['recent-code-editor-input'] },
  { id:'x1', origin:'external', observedAt:'2026-08-30T14:45:00Z', paths:['src/api.ts'], evidence:['workspace-revision-changed'] }
];
const locks = deriveHumanIntentLocks(recentEdits, { now });
assert.equal(locks.find(lock => lock.path === 'src/App.tsx')?.level, 'strong');
assert.equal(locks.find(lock => lock.path === 'src/App.tsx')?.count, 2);
assert.equal(locks.find(lock => lock.path === 'src/Profile.tsx')?.level, 'soft');

const approvedPlan = {
  summary: 'Ajustar sidebar',
  plan: ['Alterar a largura da sidebar'],
  files: [{ path:'src/App.tsx', reason:'Ajustar a sidebar existente' }]
};
const before = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
const smallAfter = before.replace('line 50', 'line 50 changed');
const files = [{ path:'src/App.tsx', action:'update', before, content:smallAfter }];

const blockedHuman = evaluateScopeIntelligence({
  command:'Ajuste a sidebar sem alterar outras áreas',
  approvedPlan,
  files,
  recentUserEdits: recentEdits,
  now
});
assert.equal(blockedHuman.allowed, false);
assert.ok(blockedHuman.violations.some(item => item.code === 'human-intent-override-required'));
assert.deepEqual(blockedHuman.humanIntent.overridesRequired, ['src/App.tsx']);

const explicitOverride = evaluateScopeIntelligence({
  command:'Ajuste a sidebar sem alterar outras áreas',
  approvedPlan,
  files,
  recentUserEdits: recentEdits,
  humanIntentOverrides:['src/App.tsx'],
  now
});
assert.equal(explicitOverride.allowed, true);
assert.deepEqual(explicitOverride.humanIntent.overridesUsed, ['src/App.tsx']);
assert.ok(explicitOverride.warnings.some(item => item.code === 'human-intent-explicit-override'));

const softExplicitTarget = evaluateScopeIntelligence({
  command:'Ajuste especificamente src/Profile.tsx',
  approvedPlan:{ files:[{path:'src/Profile.tsx',reason:'Ajustar perfil'}] },
  files:[{ path:'src/Profile.tsx', action:'update', before:'a\nb\nc', content:'a\nb2\nc' }],
  recentUserEdits: recentEdits,
  now
});
assert.equal(softExplicitTarget.allowed, true);
assert.ok(softExplicitTarget.warnings.some(item => item.code === 'human-intent-soft-lock-explicit-target'));

const outOfPlan = evaluateScopeIntelligence({
  command:'Ajuste a sidebar',
  approvedPlan,
  files:[...files, { path:'src/extra.ts', action:'create', before:'', content:'export const extra=true;' }],
  recentUserEdits:[],
  now
});
assert.equal(outOfPlan.allowed, false);
assert.ok(outOfPlan.violations.some(item => item.code === 'outside-approved-plan' && item.path === 'src/extra.ts'));

const broadAfter = Array.from({ length: 100 }, (_, i) => i < 70 ? `rewritten ${i}` : `line ${i}`).join('\n');
const broad = evaluateScopeIntelligence({
  command:'Ajuste um detalhe da sidebar em src/App.tsx',
  approvedPlan,
  files:[{ path:'src/App.tsx', action:'update', before, content:broadAfter }],
  recentUserEdits:[],
  now
});
assert.equal(broad.allowed, false);
assert.ok(broad.violations.some(item => item.code === 'broad-rewrite'));

const external = evaluateScopeIntelligence({
  command:'Ajuste src/api.ts',
  approvedPlan:{ files:[{path:'src/api.ts',reason:'Ajustar API'}] },
  files:[{path:'src/api.ts',action:'update',before:'a\nb',content:'a\nc'}],
  recentUserEdits,
  now
});
assert.equal(external.allowed, true);
assert.ok(external.warnings.some(item => item.code === 'external-change-signal'));

const fp1 = JSON.stringify(scopeIntelligenceFingerprint(explicitOverride));
const fp2 = JSON.stringify(scopeIntelligenceFingerprint(explicitOverride));
assert.equal(fp1, fp2);
assert.ok(!fp1.includes('generatedAt'));

assert.match(pkg.notes, /Build65/);
assert.match(pkg.notes, /USER_EDIT > AI_EDIT/);
assert.match(pkg.notes, /MCP 2026-07-28 Trust Gateway/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log('Build65 Scope Intelligence v2 + Human Intent contract OK');
