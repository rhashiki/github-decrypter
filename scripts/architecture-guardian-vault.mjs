import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.vaultAuthority;
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

if (!rule
  || typeof rule.ownerRoot !== 'string'
  || !Number.isSafeInteger(rule.minimumBuild)
  || typeof rule.cipher !== 'string'
  || typeof rule.kdf !== 'string'
  || typeof rule.keyBackend !== 'string') {
  violations.push({ code: 'AG140', message: 'Secrets Vault authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_vault_(?:metadata|secrets)\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG141',
        message: 'Secrets Vault persistence authority escaped apps/local.',
        detail: relative,
      });
    }
  }

  const migrationPath = path.join(root, rule.ownerRoot, 'src/database-migrations.ts');
  const migrationSource = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  const encryptedColumnsPresent = [
    'resource_hmac TEXT NOT NULL UNIQUE',
    'resource_ciphertext BLOB NOT NULL',
    'value_ciphertext BLOB NOT NULL',
    'resource_nonce BLOB NOT NULL',
    'value_nonce BLOB NOT NULL',
  ].every((marker) => migrationSource.includes(marker));
  const plaintextColumn = /\b(?:secret_?value|value|resource)\s+TEXT\b/i.test(
    migrationSource.match(/CREATE TABLE gd_vault_secrets[\s\S]*?\) STRICT;/)?.[0] ?? '',
  );
  if (!encryptedColumnsPresent || plaintextColumn) {
    violations.push({
      code: 'AG142',
      message: 'Secrets Vault schema must persist encrypted BLOBs and HMAC lookup metadata, never plaintext secret/resource columns.',
      detail: `${rule.ownerRoot}/src/database-migrations.ts`,
    });
  }

  const keyStorePath = path.join(root, rule.ownerRoot, 'src/vault-key-store.ts');
  const keyStoreSource = fs.existsSync(keyStorePath) ? fs.readFileSync(keyStorePath, 'utf8') : '';
  if (!keyStoreSource.includes('randomBytes(LOCAL_VAULT_KEY_BYTES)')
    || !keyStoreSource.includes('0o600')
    || keyStoreSource.includes('gd_vault_metadata')
    || keyStoreSource.includes('gd_vault_secrets')) {
    violations.push({
      code: 'AG143',
      message: 'Vault master-key backend must remain random, owner-only and outside SQLite.',
      detail: `${rule.ownerRoot}/src/vault-key-store.ts`,
    });
  }

  const vaultPath = path.join(root, rule.ownerRoot, 'src/secrets-vault.ts');
  const vaultSource = fs.existsSync(vaultPath) ? fs.readFileSync(vaultPath, 'utf8') : '';
  for (const marker of [
    "SECRETS_VAULT_CIPHER = 'AES-256-GCM'",
    "SECRETS_VAULT_KDF = 'HKDF-SHA256'",
    "createCipheriv('aes-256-gcm'",
    "createDecipheriv('aes-256-gcm'",
    "createHmac('sha256'",
    "capability: 'SECRETS'",
  ]) {
    if (!vaultSource.includes(marker)) {
      violations.push({ code: 'AG144', message: 'Secrets Vault cryptographic/capability invariant is missing.', detail: marker });
    }
  }

  const serverPath = path.join(root, rule.ownerRoot, 'src/server.ts');
  const serverSource = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
  if (/\/v\d+\/(?:vault|vaults|secret|secrets)(?:\b|\/)/i.test(serverSource)
    || /(?:putSecret|readSecret|deleteSecret)\s*\(/.test(serverSource)) {
    violations.push({
      code: 'AG145',
      message: 'External Secrets Vault transport is not authorized by Build 16.',
      detail: `${rule.ownerRoot}/src/server.ts`,
    });
  }

  if (fs.existsSync(path.join(root, 'security/vault.js'))) {
    violations.push({
      code: 'AG146',
      message: 'Inherited remote predecessor Vault must not remain as a second active authority after Build 16.',
      detail: 'security/vault.js',
    });
  }

  if (rule.cipher !== 'AES-256-GCM'
    || rule.kdf !== 'HKDF-SHA256'
    || rule.keyBackend !== 'local-key-file-v1'
    || rule.keyFileMode !== '0600'
    || rule.plaintextPersistence !== false
    || rule.plaintextResourcePersistence !== false
    || rule.masterKeyInDatabase !== false
    || rule.externalTransport !== false) {
    violations.push({
      code: 'AG147',
      message: 'Secrets Vault policy invariants are missing or weakened.',
      detail: 'architecture.guardian.json',
    });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      `${rule.ownerRoot}/src/secrets-vault.ts`,
      `${rule.ownerRoot}/src/vault-key-store.ts`,
      'docs/architecture/SECRETS_VAULT.md',
      'docs/builds/BUILD_16_SECRETS_VAULT.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) {
        violations.push({ code: 'AG148', message: 'Secrets Vault authority artifact is missing.', detail: relative });
      }
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-vault-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  cipher: rule?.cipher ?? null,
  kdf: rule?.kdf ?? null,
  keyBackend: rule?.keyBackend ?? null,
  plaintextPersistence: rule?.plaintextPersistence ?? null,
  plaintextResourcePersistence: rule?.plaintextResourcePersistence ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
