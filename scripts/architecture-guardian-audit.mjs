import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.auditAuthority;
const violations = [];

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.minimumBuild !== 18 || rule.transactionLedgerBuild !== 77) {
  violations.push({ code: 'AG160', message: 'Audit Ledger policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_audit_entries\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({ code: 'AG161', message: 'Audit Ledger persistence authority escaped apps/local.', detail: relative });
    }
  }

  const migrationPath = path.join(root, rule.ownerRoot, 'src/database-migrations.ts');
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  for (const marker of [
    'CREATE TABLE gd_audit_entries',
    'previous_hash TEXT NOT NULL',
    'entry_hash TEXT NOT NULL UNIQUE',
    'CREATE TRIGGER gd_audit_entries_no_update',
    'CREATE TRIGGER gd_audit_entries_no_delete',
    "RAISE(ABORT, 'gd_audit_entries is append-only')",
  ]) {
    if (!migration.includes(marker)) violations.push({ code: 'AG162', message: 'Audit Ledger append-only persistence invariant missing.', detail: marker });
  }

  const authorityPath = path.join(root, rule.ownerRoot, 'src/audit-ledger.ts');
  const authority = fs.existsSync(authorityPath) ? fs.readFileSync(authorityPath, 'utf8') : '';
  for (const marker of [
    'class AuditLedger',
    "AUDIT_ENTRY_SCHEMA = 'gd-audit-entry/1'",
    "createHash('sha256')",
    'AUDIT_GENESIS_HASH',
    'verifyIntegrity()',
    'appendOnly: true',
    "hashChain: 'sha256'",
    'externalTransport: false',
  ]) {
    if (!authority.includes(marker)) violations.push({ code: 'AG163', message: 'Audit Ledger chain/integrity invariant missing.', detail: marker });
  }

  for (const absolute of walk(`${rule.ownerRoot}/src`)) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (relative.endsWith('/database-migrations.ts')) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bUPDATE\s+gd_audit_entries\b|\bDELETE\s+FROM\s+gd_audit_entries\b/i.test(source)) {
      violations.push({ code: 'AG164', message: 'Audit Ledger source attempted mutable audit persistence.', detail: relative });
    }
  }

  const serverPath = path.join(root, rule.ownerRoot, 'src/server.ts');
  const server = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
  if (/\/v\d+\/(?:audit|audits|audit-ledger|ledger)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG165', message: 'External Audit Ledger transport arrived before its owning UI/transport phase.' });
  }

  for (const marker of ['gd_cap_v1_', 'gd_approval_v1_', 'readSecret(', 'resource_ciphertext', 'value_ciphertext']) {
    if (authority.includes(marker)) violations.push({ code: 'AG166', message: 'Audit Ledger source references sensitive payload material instead of metadata-only events.', detail: marker });
  }

  if (
    rule.appendOnly !== true
    || rule.hashChain !== 'sha256'
    || rule.integrityVerificationOnStartup !== true
    || rule.securityEventMetadataOnly !== true
    || rule.externalTransport !== false
    || JSON.stringify(rule.requiredCategories) !== JSON.stringify(['capability', 'vault', 'approval', 'runtime'])
  ) {
    violations.push({ code: 'AG167', message: 'Audit Ledger machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild < rule.transactionLedgerBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bTransactionLedger\b|\bgd_transaction_ledger\b/.test(source)) {
        violations.push({ code: 'AG168', message: `Transaction Ledger arrived before Build ${rule.transactionLedgerBuild}.`, detail: relative });
      }
    }
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      `${rule.ownerRoot}/src/audit-ledger.ts`,
      'docs/architecture/AUDIT_LEDGER.md',
      'docs/builds/BUILD_18_AUDIT_LEDGER.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) violations.push({ code: 'AG169', message: 'Required Build 18 artifact is missing.', detail: relative });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-audit-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  appendOnly: rule?.appendOnly ?? null,
  hashChain: rule?.hashChain ?? null,
  integrityVerificationOnStartup: rule?.integrityVerificationOnStartup ?? null,
  securityEventMetadataOnly: rule?.securityEventMetadataOnly ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
