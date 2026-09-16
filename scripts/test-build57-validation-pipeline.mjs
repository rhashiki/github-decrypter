import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const toolsPackage = json('packages/tools/package.json');
const source = read('packages/tools/src/validation.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 57);
assert.equal(policy.phaseGates?.validationPipelineBuild, 57);
assert.ok(versionBuild(rootPackage.version) >= 57);
assert.equal(toolsPackage.name, '@github-decrypter/tools');
assert.ok(versionBuild(toolsPackage.version) >= 57);
assert.deepEqual(toolsPackage.exports, {
  '.': './src/index.ts',
  './checkpoint': './src/checkpoint.ts',
  './validation': './src/validation.ts',
});
assert.deepEqual(toolsPackage.dependencies, { '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' });

for (const marker of [
  'VALIDATION_PIPELINE_BUILD = 57',
  "VALIDATION_PIPELINE_SCHEMA = 'gd-validation-pipeline/1'",
  "VALIDATION_PIPELINE_SOURCE_CHECKPOINT_SCHEMA = 'gd-checkpoint-engine/1'",
  "VALIDATION_PIPELINE_MODE = 'BUILD'",
  'VALIDATION_PIPELINE_MAX_CRITERIA = 256',
  'createValidation(',
  'assertCanonicalValidation(',
  'canonicalValidationMaterial(',
  'assertCanonicalCheckpoint(',
  'acceptanceCriteriaRequired: true',
  'observedEvidenceRequired: true',
  'failClosed: true',
  'behavioralValidation: true',
  'validationPipeline: true',
  "verdict: 'passed' | 'failed'",
  'completionEligible: verdict === \'passed\'',
  'interactiveQAFoundation: true',
  'testingAgentBuild: 62',
  'testingAgentAuthority: false',
  'viktorCommunicationAuthority: false',
  'toolExecution: false',
  'externalFlowExecution: false',
  'mutationAuthorized: false',
  'persistence: false',
]) assert.ok(source.includes(marker), `Missing Validation Pipeline marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Build 57 gained forbidden environment authority: ${forbidden}`);

const authority = policy.validationPipelineAuthority;
assert.ok(authority, 'Validation Pipeline central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/tools');
assert.equal(authority.ownerSource, 'packages/tools/src/validation.ts');
assert.equal(authority.minimumBuild, 57);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.testingAgentBuild, 62);
assert.equal(authority.schema, 'gd-validation-pipeline/1');
assert.equal(authority.sourceCheckpointSchema, 'gd-checkpoint-engine/1');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
for (const field of [
  'deterministic','environmentNeutral','workspaceScoped','checkpointRequired','checkpointReadOnlyPreserved',
  'acceptanceCriteriaRequired','observedEvidenceRequired','failClosed','behavioralValidation','validationPipeline',
  'interactiveQAFoundation',
]) assert.equal(authority[field], true, `Validation Pipeline authority drifted: ${field}`);
for (const field of [
  'testingAgentAuthority','viktorCommunicationAuthority','capabilityGrantAuthority','mutationAuthorized','toolExecution',
  'externalFlowExecution','execution','checkpoints','restoreExecution','scheduling','jobCreation','persistence',
  'networkAuthority','filesystemAuthority','databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Validation Pipeline authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build57-validation-pipeline-static/1',
  build: 57,
  validationSchema: authority.schema,
  failClosed: true,
  behavioralValidation: true,
  testingAgentAuthority: false,
  nextBuild: 58,
}, null, 2));