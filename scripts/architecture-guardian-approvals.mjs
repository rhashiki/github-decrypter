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
  violations.push({ code: 'AG150', message: 'Approval Transactions authority policy is missing or invalid.' });
} else {
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_approval_transactions\b/.test(source) && !relative.startsWith('apps/local/')) {
      violations.push({ code: 'AG151', message: 'Approval persistence authority escaped apps/local.', detail: relative });
    }
  }

  const migrationPath = path.join(root, 'apps/local/src/database-migrations.ts');
  const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  if (!migration.includes('CREATE TABLE gd_approval_transactions')
    || !/receipt_hash\s+TEXT/.test(migration)
    || /\breceipt\s+TEXT\b/.test(migration)) {
    violations.push({ code: 'AG152', message: 'Approval receipts must be hash-only and schema 7 must exist.', detail: 'apps/local/src/database-migrations.ts' });
  }

  const authorityPath = path.join(root, 'apps/local/src/approval-transactions.ts');
  const authority = fs.existsSync(authorityPath) ? fs.readFileSync(authorityPath, 'utf8') : '';
  for (const marker of ['reviewerKind', "'human'", 'payloadDigest', 'receiptHash', 'oneShotReceipts', 'plaintextReceiptPersistence: false']) {
    if (!authority.includes(marker)) {
      violations.push({ code: 'AG153', message: `Approval invariant missing: ${marker}.`, detail: 'apps/local/src/approval-transactions.ts' });
    }
  }

  const serverPath = path.join(root, 'apps/local/src/server.ts');
  const server = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
  if (/\/v\d+\/(?:approvals?|approve|deny|decisions?)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG154', message: 'External Approval Transaction decision transport is not authorized in Build 17.', detail: 'apps/local/src/server.ts' });
  }

  if (policy.currentBuild < rule.auditLedgerBuild) {
    for (const absolute of walk('apps/local/src')) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bAuditLedger\b|\bgd_audit_ledger\b|\bauditLedger\b/.test(source)) {
        violations.push({ code: 'AG155', message: `Audit Ledger arrived before Build ${rule.auditLedgerBuild}.`, detail: relative });
      }
    }
  }

  if (rule.humanReviewRequired !== true
    || rule.oneShotReceipts !== true
    || rule.plaintextReceiptPersistence !== false
    || rule.payloadDigestBinding !== true
    || rule.externalDecisionTransport !== false) {
    violations.push({ code: 'AG156', message: 'Approval Transactions machine-readable invariants were weakened.', detail: 'architecture.guardian.json' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      'apps/local/src/approval-transactions.ts',
      'docs/architecture/APPROVAL_TRANSACTIONS.md',
      'docs/builds/BUILD_17_APPROVAL_TRANSACTIONS.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) {
        violations.push({ code: 'AG157', message: 'Required Build 17 Approval Transactions artifact is missing.', detail: relative });
      }
    }
  }
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-approvals-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  humanReviewRequired: rule?.humanReviewRequired ?? null,
  oneShotReceipts: rule?.oneShotReceipts ?? null,
  payloadDigestBinding: rule?.payloadDigestBinding ?? null,
  externalDecisionTransport: rule?.externalDecisionTransport ?? null,
  violations,
}, null, 2));
if (violations.length > 0) process.exit(1);
