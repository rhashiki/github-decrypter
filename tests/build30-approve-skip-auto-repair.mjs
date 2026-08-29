import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  APPROVAL_SCHEMA,
  normalizeApprovalPlan,
  approvalFileWhitelist,
  canonicalApprovalPayload,
  validatePreparedFiles,
  assertRevision,
  assertHead,
  publicApproval
} from '../core/approval-transaction.js';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const entry = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const runtime = fs.readFileSync('background/approval-runtime.js', 'utf8');
const ui = fs.readFileSync('content/approval-auto-repair.js', 'utf8');

assert.equal(manifest.version, '2.4.30');
assert.equal(manifest.version_name, '2.4 Build 30 · Approve Skip Auto Repair');
assert.match(manifest.action.default_title, /Build 30 · Approve Skip Auto Repair/);
assert.match(config, /export const VERSION = '2\.4\.30'/);
assert.match(config, /TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const boot = manifest.content_scripts?.[0]?.js || [];
const chatIndex = boot.indexOf('content/decrypter-chat.js');
const approvalIndex = boot.indexOf('content/approval-auto-repair.js');
assert.ok(chatIndex >= 0 && approvalIndex > chatIndex, 'Build 30 approval UI must boot after Decrypter Chat');
assert.match(entry, /installApprovalRuntime/);
assert.match(entry, /\.\/approval-runtime\.js/);

assert.match(runtime, /ld2-approval-transaction/);
assert.match(runtime, /agent\.processCommand/);
assert.match(runtime, /assertScopeLock/);
assert.match(runtime, /validatePreparedFiles/);
assert.match(runtime, /assertRevision/);
assert.match(runtime, /assertHead/);
assert.match(runtime, /validationHash/);
assert.match(runtime, /atomicCommit/);
assert.match(runtime, /APPROVAL_ALREADY_APPLIED/);
assert.match(runtime, /humanApprovalCanBeSkipped:\s*true/);
assert.match(runtime, /protectionsCanBeSkipped:\s*false/);
assert.match(runtime, /directLovableSend:\s*false/);
assert.match(runtime, /arbitraryAssetFetch:\s*false/);
assert.match(runtime, /secretRecovery:\s*false/);
assert.doesNotMatch(runtime, /LD2_SUPABASE_SQL|runSupabaseSql|createRelease|publishRelease/);

assert.match(ui, />Aprovar</);
assert.match(ui, />Pular</);
assert.match(ui, /Pular aprovação, não proteções/);
assert.match(ui, /Auto Repair/);
assert.match(ui, /não invente valores de secrets/i);
assert.match(ui, /não crie placeholders/i);
assert.match(ui, /Não baixe assets de URLs arbitrárias/i);
assert.match(ui, /Project State indisponível; a transação foi bloqueada/);
assert.doesNotMatch(ui, /new\s+MutationObserver/);
assert.doesNotMatch(ui, /window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);
assert.doesNotMatch(ui, /new\s+KeyboardEvent|dispatchEvent\(new\s+KeyboardEvent/);

const plan = normalizeApprovalPlan({
  summary: 'Corrigir integração',
  plan: ['Ajustar cliente', 'Criar migration idempotente'],
  files: [
    { path: 'src/api.ts', reason: 'cliente' },
    { path: 'supabase/migrations/repair.sql', reason: 'schema' },
    { path: 'src/api.ts', reason: 'duplicado permitido no plano bruto' }
  ],
  warnings: ['credential missing']
});
assert.equal(plan.files.length, 3);
assert.deepEqual(approvalFileWhitelist(plan), ['src/api.ts', 'supabase/migrations/repair.sql']);
const canonical = canonicalApprovalPayload({ projectId: 'p1', command: 'corrija', plan, baseHeadSha: 'A'.repeat(40), stateRevision: 'state-1', decision: 'skip', source: 'doctor' });
assert.equal(canonical.schema, APPROVAL_SCHEMA);
assert.equal(canonical.decision, 'skip');
assert.equal(canonical.baseHeadSha, 'a'.repeat(40));

const allowed = validatePreparedFiles([{ path: 'src/api.ts', action: 'update' }], approvalFileWhitelist(plan));
assert.equal(allowed.ok, true);
const escaped = validatePreparedFiles([{ path: 'src/extra.ts', action: 'create' }], approvalFileWhitelist(plan));
assert.equal(escaped.ok, false);
assert.ok(escaped.violations.includes('outside_plan:src/extra.ts'));
assert.throws(() => assertRevision('state-1', 'state-2'), /APPROVAL_STATE_REVISION_CHANGED/);
assert.throws(() => assertHead('abc', 'def'), /APPROVAL_BASE_HEAD_CHANGED/);

const pub = publicApproval({ id: 't1', hash: 'h', decision: 'skip', projectId: 'p1', baseHeadSha: 'abc', stateRevision: 's1', authorizedFiles: ['src/api.ts'], status: 'frozen', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString() });
assert.equal(pub.protections.humanApprovalSkipped, true);
assert.equal(pub.protections.scopeWhitelist, true);
assert.equal(pub.protections.shadowBuild, true);
assert.equal(pub.protections.validationGate, true);
assert.equal(pub.protections.scopeLock, true);
assert.equal(pub.protections.guardedCommit, true);
assert.equal(pub.protections.baseHeadLock, true);
assert.equal(pub.protections.stateRevisionLock, true);
assert.equal(pub.protections.trustProtocol, '2.4.21');

console.log(JSON.stringify({
  ok: true,
  build: 30,
  version: manifest.version,
  schema: APPROVAL_SCHEMA,
  approve: true,
  skip_human_approval_only: true,
  auto_repair: true,
  shadow_build: true,
  validation_gate: true,
  scope_lock: true,
  guarded_commit: true,
  state_revision_lock: true,
  trust_protocol: '2.4.21',
  secret_recovery: false,
  arbitrary_asset_fetch: false
}, null, 2));
