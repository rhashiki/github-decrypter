import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const scopePackage = json('packages/scope/package.json');
const toolsPackage = json('packages/tools/package.json');
const lockSource = read('packages/scope/src/lock.ts');
const toolsSource = read('packages/tools/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 55);
assert.equal(policy.phaseGates?.scopeLockBuild, 55);
assert.ok(versionBuild(rootPackage.version) >= 55);
assert.equal(scopePackage.name, '@github-decrypter/scope');
assert.ok(versionBuild(scopePackage.version) >= 55);
assert.deepEqual(scopePackage.exports, { '.': './src/index.ts', './lock': './src/lock.ts' });
assert.deepEqual(scopePackage.dependencies, { '@github-decrypter/build': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/scope']?.allowedWorkspaceDependencies, ['@github-decrypter/build']);
assert.equal(toolsPackage.name, '@github-decrypter/tools');
assert.ok(versionBuild(toolsPackage.version) >= 55);
assert.deepEqual(toolsPackage.dependencies, { '@github-decrypter/build': 'workspace:*', '@github-decrypter/scope': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/tools']?.allowedWorkspaceDependencies, ['@github-decrypter/build','@github-decrypter/scope']);

for (const marker of [
  'SCOPE_LOCK_BUILD = 55',
  "SCOPE_LOCK_SCHEMA = 'gd-scope-lock/1'",
  "SCOPE_LOCK_SOURCE_SCOPE_SCHEMA = 'gd-scope-intelligence/1'",
  "SCOPE_LOCK_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
  "SCOPE_LOCK_MODE = 'BUILD'",
  'SCOPE_LOCK_MAX_CANDIDATES = 4096',
  "SCOPE_LOCK_MUTATION_ACCESS = Object.freeze(['write', 'execute']",
  'lockScope(',
  'assertCanonicalScopeLock(',
  'assertScopeLockAllowsMutation(',
  'canonicalLockMaterial(',
  'exactCandidateAllowlist: true',
  'automaticExpansion: false',
  'semanticInference: false',
  'scopeLock: true',
  'scopeLocked: true',
  'mutationBoundarySatisfied: true',
  'capabilitiesRequired: true',
  'capabilityGrantAuthority: false',
  'mutationAuthorized: false',
  'checkpoints: false',
  'validationPipeline: false',
]) assert.ok(lockSource.includes(marker), `Missing Scope Lock marker: ${marker}`);

for (const marker of [
  'TOOL_RUNTIME_SCOPE_LOCK_INTEGRATION_BUILD = 55',
  "from '@github-decrypter/scope/lock'",
  'assertCanonicalScopeLock(',
  'assertScopeLockAllowsMutation(',
  'if (registration.descriptor.mutating)',
  'if (!scopeLock) throw new ToolRuntimeMutationBlockedError',
  'scopeCandidateId',
  'mutationAccess',
  'mutationAuthorized = true',
  'if (await verifyCapability(request) !== true)',
  'capabilityGrantAuthority: false',
  'checkpoints: false',
  'validationPipeline: false',
]) assert.ok(toolsSource.includes(marker), `Missing Tool Runtime Scope Lock integration marker: ${marker}`);

for (const source of [lockSource, toolsSource]) {
  for (const forbidden of [
    /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
    /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
    /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
  ]) assert.equal(forbidden.test(source), false, `Build 55 gained forbidden environment authority: ${forbidden}`);
}

const authority = policy.scopeLockAuthority;
assert.ok(authority, 'Scope Lock central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/scope');
assert.equal(authority.ownerSource, 'packages/scope/src/lock.ts');
assert.equal(authority.minimumBuild, 55);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.toolRuntimeBuild, 53);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-scope-lock/1');
assert.equal(authority.sourceScopeSchema, 'gd-scope-intelligence/1');
assert.equal(authority.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxCandidates, 4096);
assert.deepEqual(authority.mutationAccess, ['write','execute']);
for (const field of [
  'deterministic','environmentNeutral','workspaceScoped','explicitLock','exactCandidateAllowlist','scopeIntelligence',
  'scopeLockRequired','scopeLock','scopeLocked','mutationBoundarySatisfied','capabilitiesRequired',
  'capabilityVerifierRequired','toolRuntimeScopedMutationIntegration',
]) assert.equal(authority[field], true, `Scope Lock authority drifted: ${field}`);
for (const field of [
  'automaticExpansion','semanticInference','capabilityGrantAuthority','mutationAuthorized','toolExecution','checkpoints',
  'validationPipeline','execution','scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority',
  'databaseAuthority','studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Scope Lock authority boundary drifted: ${field}`);

const toolAuthority = policy.toolRuntimeAuthority;
assert.equal(toolAuthority.scopeLockBuild, 55);
assert.equal(toolAuthority.scopeLockConsumer, true);
assert.equal(toolAuthority.scopedMutationAuthorization, true);
assert.equal(toolAuthority.mutatingToolsBlockedWithoutScopeLock, true);
assert.equal(toolAuthority.capabilityGrantAuthority, false);
assert.equal(toolAuthority.mutationAuthorized, false);
assert.equal(toolAuthority.checkpoints, false);
assert.equal(toolAuthority.validationPipeline, false);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build55-scope-lock-static/1',
  build: 55,
  scopeLockSchema: authority.schema,
  exactCandidateAllowlist: true,
  capabilityGrantAuthority: false,
  toolRuntimeScopedMutationIntegration: true,
  nextBuild: 56,
}, null, 2));
