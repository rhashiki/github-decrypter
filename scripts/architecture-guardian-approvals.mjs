import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.approvalAuthority;
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

if (!rule || rule.ownerRoot !== 'apps/local' || rule.minimumBuild !== 17 || rule.auditLedgerBuild !== 18) {
  violations.push({ code: 'AG150', message: 'Approval Transactions policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_approval_transactions\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({ code: 'AG151', message: 'Approval persistence authority escaped apps/local.', detail: relative });
    }
  }

  const migrationPath = path.join(root, rule.ownerRoot, 'src/database-migrations.ts');
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  for (const marker of ['CREATE TABLE gd_approval_transactions','payload_digest TEXT NOT NULL','receipt_hash TEXT UNIQUE',"'pending', 'approved', 'denied', 'consumed', 'expired', 'cancelled'"]) {
    if (!migration.includes(marker)) violations.push({ code: 'AG152', message: 'Approval persistence invariant missing.', detail: marker });
  }
  if (/\breceipt\s+TEXT\b/i.test(migration) && !/receipt_hash\s+TEXT/i.test(migration)) {
    violations.push({ code: 'AG153', message: 'Approval receipt must never be persisted as plaintext.' });
  }

  const authorityPath = path.join(root, rule.ownerRoot, 'src/approval-transactions.ts');
  const authority = fs.existsSync(authorityPath) ? fs.readFileSync(authorityPath, 'utf8') : '';
  for (const marker of ["APPROVAL_RECEIPT_PREFIX = 'gd_approval_v1_'",'randomBytes(32)',"createHash('sha256')",'payloadDigest',"state = 'consumed'",'receipt_hash = NULL','externalDecisionTransport: false']) {
    if (!authority.includes(marker)) violations.push({ code: 'AG154', message: 'Approval one-shot/fail-closed invariant missing.', detail: marker });
  }

  const serverPath = path.join(root, rule.ownerRoot, 'src/server.ts');
  const server = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
  if (/\/v\d+\/(?:approvals?|approval-transactions?)(?:\b|\/)/i.test(server)) violations.push({ code: 'AG155', message: 'External Approval Transaction decision transport arrived before its owning UI/transport phase.' });

  if (policy.currentBuild < rule.auditLedgerBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bAuditLedger\b|\bgd_audit_ledger\b|\bauditLedger\b/.test(source)) violations.push({ code: 'AG156', message: `Audit Ledger arrived before Build ${rule.auditLedgerBuild}.`, detail: relative });
    }
  }

  if (rule.oneShotReceipts !== true || rule.plaintextReceiptPersistence !== false || rule.payloadDigestBinding !== 'sha256' || rule.jobBinding !== true || rule.externalDecisionTransport !== false) {
    violations.push({ code: 'AG157', message: 'Approval Transaction machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [`${rule.ownerRoot}/src/approval-transactions.ts`,'docs/architecture/APPROVAL_TRANSACTIONS.md','docs/builds/BUILD_17_APPROVAL_TRANSACTIONS.md']) {
      if (!fs.existsSync(path.join(root, relative))) violations.push({ code: 'AG158', message: 'Required Build 17 artifact is missing.', detail: relative });
    }
  }
}

const report = { ok: violations.length === 0, schema: 'gd-architecture-guardian-approvals-report/1', currentBuild: policy.currentBuild, ownerRoot: rule?.ownerRoot ?? null, oneShotReceipts: rule?.oneShotReceipts ?? null, plaintextReceiptPersistence: rule?.plaintextReceiptPersistence ?? null, externalDecisionTransport: rule?.externalDecisionTransport ?? null, violations };
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
