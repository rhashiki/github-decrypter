import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-local-ai-installer.mjs';

function runGuardian() {
  return spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
}

function expectFailure(path, mutate, code) {
  const original = fs.readFileSync(path, 'utf8');
  try {
    const mutated = mutate(original);
    assert.notEqual(mutated, original, `Mutation for ${path} must change the file.`);
    fs.writeFileSync(path, mutated);
    const result = runGuardian();
    assert.notEqual(result.status, 0, `${code} mutation unexpectedly passed.`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(code));
  } finally {
    fs.writeFileSync(path, original);
  }
}

expectFailure(
  'apps/local/src/ai-installer.ts',
  (source) => `${source}\nexport const unsafeInstallerNetwork = () => fetch('https://example.invalid');\n`,
  'AG334',
);

expectFailure(
  'apps/local/src/ai-installer.ts',
  (source) => `${source}\nexport const removeModel = () => undefined;\n`,
  'AG334',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIInstallerAuthority.externalProviderInstallation = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG332',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIInstallerAuthority.networkConditional = false;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG333',
);

expectFailure(
  'apps/local/src/daemon.ts',
  (source) => source.replace('await this.#aiInstaller.initialize()', 'await Promise.resolve(this.#aiInstaller.status())'),
  'AG335',
);

const requiredDoc = 'docs/architecture/LOCAL_AI_INSTALLER.md';
const temporaryDoc = `${requiredDoc}.build35-negative`;
if (fs.existsSync(requiredDoc)) {
  try {
    fs.renameSync(requiredDoc, temporaryDoc);
    const result = runGuardian();
    assert.notEqual(result.status, 0, 'Missing required Build 35 artifact unexpectedly passed.');
    assert.match(`${result.stdout}\n${result.stderr}`, /AG339/);
  } finally {
    if (fs.existsSync(temporaryDoc)) fs.renameSync(temporaryDoc, requiredDoc);
  }
}

const final = runGuardian();
assert.equal(final.status, 0, `${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build35-local-ai-installer-guardian-negative/1',
  directNetworkRejected: true,
  prematureModelManagerRejected: true,
  externalProviderInstallationRejected: true,
  conditionalNetworkPolicyProtected: true,
  daemonLifecycleProtected: true,
  requiredArtifactsProtected: true,
}, null, 2));
