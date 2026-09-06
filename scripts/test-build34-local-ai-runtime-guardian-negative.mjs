import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-local-ai-runtime.mjs';

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
  'apps/local/src/ai-runtime.ts',
  (source) => `${source}\nexport const unsafeNetwork = () => fetch('https://example.invalid');\n`,
  'AG324',
);

expectFailure(
  'apps/local/src/ai-runtime.ts',
  (source) => `${source}\nexport const registerProvider = () => undefined;\n`,
  'AG324',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIRuntimeAuthority.externalProviderExecution = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG322',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.localAIRuntimeAuthority.networkAuthority = true;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG324',
);

expectFailure(
  'apps/local/src/daemon.ts',
  (source) => source.replace('await this.#aiRuntime.initialize()', 'await Promise.resolve(this.#aiRuntime.status())'),
  'AG325',
);

const requiredDoc = 'docs/architecture/LOCAL_AI_RUNTIME.md';
const temporaryDoc = `${requiredDoc}.build34-negative`;
if (fs.existsSync(requiredDoc)) {
  try {
    fs.renameSync(requiredDoc, temporaryDoc);
    const result = runGuardian();
    assert.notEqual(result.status, 0, 'Missing required Build 34 artifact unexpectedly passed.');
    assert.match(`${result.stdout}\n${result.stderr}`, /AG329/);
  } finally {
    if (fs.existsSync(temporaryDoc)) fs.renameSync(temporaryDoc, requiredDoc);
  }
}

const final = runGuardian();
assert.equal(final.status, 0, `${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build34-local-ai-runtime-guardian-negative/1',
  networkTransportRejected: true,
  prematureManagerApiRejected: true,
  externalProviderExecutionRejected: true,
  networkPolicyProtected: true,
  daemonLifecycleProtected: true,
  requiredArtifactsProtected: true,
}, null, 2));
