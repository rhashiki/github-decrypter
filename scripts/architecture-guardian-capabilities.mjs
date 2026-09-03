import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.capabilityAuthority;
const violations = [];
const requiredCapabilities = [
  'READ',
  'WRITE',
  'EXECUTE',
  'NETWORK',
  'DATABASE_WRITE',
  'GIT_WRITE',
  'DESTRUCTIVE',
  'SECRETS',
];

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

if (!rule
  || typeof rule.ownerRoot !== 'string'
  || !Number.isSafeInteger(rule.minimumBuild)
  || !Number.isSafeInteger(rule.secretsVaultBuild)
  || !Number.isSafeInteger(rule.approvalTransactionsBuild)
  || !Number.isSafeInteger(rule.auditLedgerBuild)) {
  violations.push({ code: 'AG130', message: 'Capability Security authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  const allAuthorityFiles = [...walk('apps'), ...walk('packages')];

  for (const absolute of allAuthorityFiles) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_capability_(?:grants|claims)\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG131',
        message: 'Capability persistence authority escaped apps/local.',
        detail: relative,
      });
    }
  }

  const migrationPath = path.join(root, rule.ownerRoot, 'src/database-migrations.ts');
  const migrationSource = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  if (!/\btoken_hash\s+TEXT\s+NOT\s+NULL\b/.test(migrationSource)
    || /\b(?:capability_)?token\s+TEXT\b/.test(migrationSource)) {
    violations.push({
      code: 'AG132',
      message: 'Capability tokens must be persisted only as hashes, never plaintext.',
      detail: `${rule.ownerRoot}/src/database-migrations.ts`,
    });
  }

  if (policy.currentBuild < rule.secretsVaultBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bSecretsVault\b|\bgd_secret_vault\b|\bvaultMasterKey\b|\bpersistCapabilityToken\b/.test(source)) {
        violations.push({
          code: 'AG133',
          message: `Secrets Vault authority arrived before Build ${rule.secretsVaultBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild < rule.approvalTransactionsBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bApprovalTransaction\b|\bgd_approval_transactions\b|\bapprovalTransaction\b/.test(source)) {
        violations.push({
          code: 'AG134',
          message: `Approval Transactions arrived before Build ${rule.approvalTransactionsBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild < rule.auditLedgerBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bAuditLedger\b|\bgd_audit_ledger\b|\bauditLedger\b/.test(source)) {
        violations.push({
          code: 'AG135',
          message: `Audit Ledger authority arrived before Build ${rule.auditLedgerBuild}.`,
          detail: relative,
        });
      }
    }
  }

  const serverPath = path.join(root, rule.ownerRoot, 'src/server.ts');
  const serverSource = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
  if (/\/v\d+\/(?:capabilities|capability|grants|grant)(?:\b|\/)/i.test(serverSource)
    || /issueGrant\s*\(/.test(serverSource)) {
    violations.push({
      code: 'AG136',
      message: 'External capability grant transport is not authorized by Build 15.',
      detail: `${rule.ownerRoot}/src/server.ts`,
    });
  }

  const actualCapabilities = Array.isArray(rule.requiredCapabilities) ? [...rule.requiredCapabilities] : [];
  if (JSON.stringify(actualCapabilities) !== JSON.stringify(requiredCapabilities)
    || rule.denyByDefault !== true
    || rule.plaintextTokenPersistence !== false
    || rule.externalGrantTransport !== false) {
    violations.push({
      code: 'AG137',
      message: 'Capability Security invariants are missing or weakened.',
      detail: 'architecture.guardian.json',
    });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      `${rule.ownerRoot}/src/capability-security.ts`,
      'docs/architecture/CAPABILITY_SECURITY_MODEL.md',
      'docs/builds/BUILD_15_CAPABILITY_SECURITY_MODEL.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) {
        violations.push({ code: 'AG138', message: 'Capability Security authority artifact is missing.', detail: relative });
      }
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-capabilities-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  secretsVaultBuild: rule?.secretsVaultBuild ?? null,
  approvalTransactionsBuild: rule?.approvalTransactionsBuild ?? null,
  denyByDefault: rule?.denyByDefault ?? null,
  plaintextTokenPersistence: rule?.plaintextTokenPersistence ?? null,
  externalGrantTransport: rule?.externalGrantTransport ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
