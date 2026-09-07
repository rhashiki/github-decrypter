import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-model-manager.mjs';

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
  'apps/local/src/ai-model-manager.ts',
  (source) => `${source}\nexport const unsafeManagerNetwork = () => fetch('https://example.invalid');\n`,
  'AG344',
);

expectFailure(
  'apps/local/src/ai-model-manager.ts',
  (source) => `${source}\nexport const routeModel = () => undefined;\n`,
  'AG344',
);

expectFailure(
  'apps/local/src/ai-model-manager.ts',
  (source) => source.replace("{ capability: 'DESTRUCTIVE', resource },", "{ capability: 'WRITE', resource },"),
  'AG343',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.modelManagerAuthority.externalProviderManagement = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG342',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.modelManagerAuthority.automaticRouting = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG344',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.modelManagerAuthority.defaultSelectionPersistence = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG344',
);

expectFailure(
  'apps/local/src/daemon.ts',
  (source) => source.replace('await this.#aiModelManager.initialize()', 'await Promise.resolve(this.#aiModelManager.status())'),
  'AG345',
);

const requiredDoc = 'docs/architecture/LOCAL_AI_MODEL_MANAGER.md';
const temporaryDoc = `${requiredDoc}.build36-negative`;
if (fs.existsSync(requiredDoc)) {
  try {
    fs.renameSync(requiredDoc, temporaryDoc);
    const result = runGuardian();
    assert.notEqual(result.status, 0, 'Missing required Build 36 artifact unexpectedly passed.');
    assert.match(`${result.stdout}\n${result.stderr}`, /AG349/);
  } finally {
    if (fs.existsSync(temporaryDoc)) fs.renameSync(temporaryDoc, requiredDoc);
  }
}

const final = runGuardian();
assert.equal(final.status, 0, `${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build36-model-manager-guardian-negative/1',
  directNetworkRejected: true,
  prematureRoutingRejected: true,
  destructiveRemovalProtected: true,
  externalProviderManagementRejected: true,
  automaticRoutingPolicyProtected: true,
  defaultPersistenceProtected: true,
  daemonLifecycleProtected: true,
  requiredArtifactsProtected: true,
}, null, 2));