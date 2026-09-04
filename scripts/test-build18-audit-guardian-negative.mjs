import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian-audit.mjs');
const rejected = [];

function expect(code) {
  const result = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Audit Guardian unexpectedly accepted ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Expected ${code}.\n${result.stdout}\n${result.stderr}`);
  rejected.push(code);
}

const studioProbe = path.join(root, 'apps/studio/src/__audit_probe.ts');
try {
  fs.writeFileSync(studioProbe, "export const table = 'gd_audit_entries';\n");
  expect('AG161');
} finally { fs.rmSync(studioProbe, { force: true }); }

const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
const migrationOriginal = fs.readFileSync(migrationPath, 'utf8');
try {
  fs.writeFileSync(migrationPath, migrationOriginal.replace('CREATE TRIGGER gd_audit_entries_no_update', 'CREATE TRIGGER gd_audit_entries_update_allowed'));
  expect('AG162');
} finally { fs.writeFileSync(migrationPath, migrationOriginal); }

const authorityPath = path.join(root, 'apps/local/src/audit-ledger.ts');
const authorityOriginal = fs.readFileSync(authorityPath, 'utf8');
try {
  fs.writeFileSync(authorityPath, authorityOriginal.replaceAll("createHash('sha256')", "createHash('sha1')"));
  expect('AG163');
} finally { fs.writeFileSync(authorityPath, authorityOriginal); }

try {
  fs.writeFileSync(authorityPath, `${authorityOriginal}\nexport const forbiddenMutation = 'UPDATE gd_audit_entries SET actor = actor';\n`);
  expect('AG164');
} finally { fs.writeFileSync(authorityPath, authorityOriginal); }

const serverPath = path.join(root, 'apps/local/src/server.ts');
const serverOriginal = fs.readFileSync(serverPath, 'utf8');
try {
  fs.writeFileSync(serverPath, `${serverOriginal}\nexport const forbiddenAuditEndpoint = '/v1/audit-ledger';\n`);
  expect('AG165');
} finally { fs.writeFileSync(serverPath, serverOriginal); }

try {
  fs.writeFileSync(authorityPath, `${authorityOriginal}\nexport const forbiddenSensitiveReference = 'gd_approval_v1_';\n`);
  expect('AG166');
} finally { fs.writeFileSync(authorityPath, authorityOriginal); }

const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.auditAuthority.appendOnly = false;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  expect('AG167');
} finally { fs.writeFileSync(policyPath, policyOriginal); }

try {
  fs.writeFileSync(authorityPath, `${authorityOriginal}\nexport class TransactionLedger {}\n`);
  expect('AG168');
} finally { fs.writeFileSync(authorityPath, authorityOriginal); }

const final = spawnSync(process.execPath, [guardian], { cwd: root, encoding: 'utf8' });
assert.equal(final.status, 0, `Audit Guardian did not recover.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build18-audit-guardian-negative/1',
  rejected,
  restoredTreePasses: true,
}, null, 2));
