import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-model-routing.mjs';

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
  'apps/local/src/ai-model-routing.ts',
  (source) => `${source}\nexport const unsafeRoutingNetwork = () => fetch('https://example.invalid');\n`,
  'AG354',
);

expectFailure(
  'apps/local/src/ai-model-routing.ts',
  (source) => `${source}\nexport const installModel = () => undefined;\n`,
  'AG354',
);

expectFailure(
  'apps/local/src/ai-model-routing.ts',
  (source) => source.replace("capability: 'READ', resource: LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE", "capability: 'WRITE', resource: LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE"),
  'AG353',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIModelRoutingAuthority.routingPersistence = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG354',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIModelRoutingAuthority.runtimeExecution = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG354',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.modelManagerAuthority.automaticRouting = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG357',
);

expectFailure(
  'apps/local/src/daemon.ts',
  (source) => source.replace('await this.#aiModelRouting.initialize()', 'await Promise.resolve(this.#aiModelRouting.status())'),
  'AG355',
);

const requiredDoc = 'docs/architecture/LOCAL_AI_MODEL_ROUTING.md';
const temporaryDoc = `${requiredDoc}.build37-negative`;
if (fs.existsSync(requiredDoc)) {
  try {
    fs.renameSync(requiredDoc, temporaryDoc);
    const result = runGuardian();
    assert.notEqual(result.status, 0, 'Missing required Build 37 artifact unexpectedly passed.');
    assert.match(`${result.stdout}\n${result.stderr}`, /AG359/);
  } finally {
    if (fs.existsSync(temporaryDoc)) fs.renameSync(temporaryDoc, requiredDoc);
  }
}

const final = runGuardian();
assert.equal(final.status, 0, `${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build37-model-routing-guardian-negative/1',
  directNetworkRejected: true,
  installerAuthorityRejected: true,
  readCapabilityProtected: true,
  persistenceRejected: true,
  runtimeExecutionRejected: true,
  managerOwnershipProtected: true,
  daemonLifecycleProtected: true,
  requiredArtifactsProtected: true,
}, null, 2));