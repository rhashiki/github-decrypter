import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-ai-provider.mjs';

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
  'packages/ai/src/index.ts',
  (source) => `${source}\nexport const unsafeEndpoint = 'https://example.invalid';\n`,
  'AG311',
);

expectFailure(
  'packages/ai/src/index.ts',
  (source) => `${source}\nexport interface UnsafeCredentialTransport { readonly apiKey: string; }\n`,
  'AG313',
);

expectFailure(
  'apps/local/package.json',
  (source) => {
    const manifest = JSON.parse(source);
    manifest.dependencies = { ...(manifest.dependencies ?? {}), '@github-decrypter/ai': 'workspace:*' };
    return `${JSON.stringify(manifest, null, 2)}\n`;
  },
  'AG315',
);

expectFailure(
  'architecture.guardian.json',
  (source) => {
    const policy = JSON.parse(source);
    policy.aiProviderAuthority.contractOnly = false;
    return `${JSON.stringify(policy, null, 2)}\n`;
  },
  'AG310',
);

const requiredDoc = 'docs/architecture/AI_PROVIDER_API.md';
const temporaryDoc = `${requiredDoc}.build33-negative`;
try {
  fs.renameSync(requiredDoc, temporaryDoc);
  const result = runGuardian();
  assert.notEqual(result.status, 0, 'Missing required Build 33 artifact unexpectedly passed.');
  assert.match(`${result.stdout}\n${result.stderr}`, /AG319/);
} finally {
  if (fs.existsSync(temporaryDoc)) fs.renameSync(temporaryDoc, requiredDoc);
}

const final = runGuardian();
assert.equal(final.status, 0, `${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build33-ai-provider-guardian-negative/1',
  environmentSpecificTransportRejected: true,
  credentialFieldRejected: true,
  prematureRuntimeActivationRejected: true,
  contractOnlyPolicyProtected: true,
  requiredArtifactsProtected: true,
}, null, 2));
