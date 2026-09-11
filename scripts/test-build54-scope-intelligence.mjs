import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const scopePackage = json('packages/scope/package.json');
const source = read('packages/scope/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 54);
assert.equal(policy.phaseGates?.scopeIntelligenceBuild, 54);
assert.ok(versionBuild(rootPackage.version) >= 54);
assert.equal(scopePackage.name, '@github-decrypter/scope');
assert.ok(versionBuild(scopePackage.version) >= 54);
assert.equal(scopePackage.exports, './src/index.ts');
assert.deepEqual(scopePackage.dependencies, { '@github-decrypter/build': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/scope']?.allowedWorkspaceDependencies, ['@github-decrypter/build']);
assert.equal(policy.packageRules?.['@github-decrypter/scope']?.environmentNeutral, true);

for (const marker of [
  'SCOPE_INTELLIGENCE_BUILD = 54',
  "SCOPE_INTELLIGENCE_SCHEMA = 'gd-scope-intelligence/1'",
  "SCOPE_INTELLIGENCE_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
  "SCOPE_INTELLIGENCE_MODE = 'BUILD'",
  'SCOPE_INTELLIGENCE_MAX_CANDIDATES = 4096',
  "SCOPE_ACCESS_KINDS = Object.freeze(['read', 'write', 'execute']",
  'analyzeScope(',
  'assertCanonicalOrchestration(',
  'canonicalOrchestrationMaterial(',
  'canonicalScopeMaterial(',
  'advisoryOnly: true',
  'explicitCandidatesOnly: true',
  'semanticInference: false',
  'automaticDiscovery: false',
  'scopeIntelligence: true',
  'scopeLockRequired: true',
  'scopeLock: false',
  'scopeLocked: false',
  'mutationAuthorized: false',
  'capabilityGrantAuthority: false',
  'toolExecution: false',
]) assert.ok(source.includes(marker), `Missing Scope Intelligence marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Scope Intelligence gained forbidden environment authority: ${forbidden}`);

const authority = policy.scopeIntelligenceAuthority;
assert.ok(authority, 'Scope Intelligence central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/scope');
assert.equal(authority.ownerSource, 'packages/scope/src/index.ts');
assert.equal(authority.minimumBuild, 54);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-scope-intelligence/1');
assert.equal(authority.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxCandidates, 4096);
assert.deepEqual(authority.accessKinds, ['read','write','execute']);
for (const field of ['deterministic','environmentNeutral','workspaceScoped','advisoryOnly','explicitCandidatesOnly','scopeIntelligence','scopeLockRequired']) {
  assert.equal(authority[field], true, `Scope Intelligence authority drifted: ${field}`);
}
for (const field of [
  'semanticInference','automaticDiscovery','scopeLock','scopeLocked','mutationAuthorized','capabilityGrantAuthority','toolExecution',
  'execution','checkpoints','validationPipeline','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
  'databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Scope Intelligence authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build54-scope-intelligence-static/1',
  build: 54,
  scopeSchema: authority.schema,
  advisoryOnly: true,
  scopeLock: false,
  nextBuild: 55,
}, null, 2));
