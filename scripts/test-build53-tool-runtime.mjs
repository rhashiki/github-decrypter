import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const toolsPackage = json('packages/tools/package.json');
const source = read('packages/tools/src/index.ts');
const versionBuild = (value) => {
  const match = typeof value === 'string' ? value.match(/^0\.0\.(\d+)$/) : null;
  return match ? Number(match[1]) : null;
};

assert.ok(policy.currentBuild >= 53);
assert.equal(policy.phaseGates?.toolRuntimeBuild, 53);
assert.ok(versionBuild(rootPackage.version) >= 53);
assert.equal(toolsPackage.name, '@github-decrypter/tools');
assert.ok(versionBuild(toolsPackage.version) >= 53);
assert.equal(toolsPackage.exports, './src/index.ts');
assert.deepEqual(toolsPackage.dependencies, { '@github-decrypter/build': 'workspace:*' });
assert.deepEqual(policy.packageRules?.['@github-decrypter/tools']?.allowedWorkspaceDependencies, ['@github-decrypter/build']);
assert.equal(policy.packageRules?.['@github-decrypter/tools']?.environmentNeutral, true);

for (const marker of [
  'TOOL_RUNTIME_BUILD = 53',
  "TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
  "TOOL_RUNTIME_SOURCE_BUILD_SCHEMA = 'gd-build-orchestrator/1'",
  "TOOL_RUNTIME_MODE = 'BUILD'",
  'TOOL_RUNTIME_MAX_TOOLS = 256',
  'TOOL_RUNTIME_CAPABILITIES = Object.freeze([',
  'createToolRuntime(',
  'assertCanonicalOrchestration(',
  'canonicalOrchestrationMaterial(',
  'canonicalInvocationMaterial(',
  'capabilityVerifierRequired: true',
  'capabilityGrantAuthority: false',
  'denyByDefault: true',
  'toolExecution: true',
  'execution: true',
  'mutationAuthorized: false',
  'scopeLockRequired: true',
  'ToolRuntimeMutationBlockedError',
  'ToolRuntimeCapabilityError',
]) assert.ok(source.includes(marker), `Missing Tool Runtime marker: ${marker}`);

for (const forbidden of [
  /\bnode:/, /\bprocess\./, /\bfetch\s*\(/, /\bwindow\./, /\bdocument\./,
  /\blocalStorage\b/, /\bindexedDB\b/, /\bnode:sqlite\b/, /\bchild_process\b/, /\bfs\./,
  /\bWebSocket\b/, /\bXMLHttpRequest\b/, /spawn\s*\(/, /exec\s*\(/, /\.writeFile\s*\(/,
]) assert.equal(forbidden.test(source), false, `Tool Runtime gained forbidden environment authority: ${forbidden}`);

const authority = policy.toolRuntimeAuthority;
assert.ok(authority, 'Tool Runtime central authority is missing.');
assert.equal(authority.ownerPackage, '@github-decrypter/tools');
assert.equal(authority.ownerSource, 'packages/tools/src/index.ts');
assert.equal(authority.minimumBuild, 53);
assert.equal(authority.buildOrchestratorBuild, 52);
assert.equal(authority.capabilitySecurityBuild, 15);
assert.equal(authority.scopeIntelligenceBuild, 54);
assert.equal(authority.scopeLockBuild, 55);
assert.equal(authority.checkpointEngineBuild, 56);
assert.equal(authority.validationPipelineBuild, 57);
assert.equal(authority.schema, 'gd-tool-runtime/1');
assert.equal(authority.sourceBuildSchema, 'gd-build-orchestrator/1');
assert.equal(authority.mode, 'BUILD');
assert.equal(authority.digestAlgorithm, 'sha256');
assert.equal(authority.maxTools, 256);
assert.deepEqual(authority.requiredCapabilities, ['READ','WRITE','EXECUTE','NETWORK','DATABASE_WRITE','GIT_WRITE','DESTRUCTIVE','SECRETS']);
for (const field of [
  'environmentNeutral','workspaceScoped','denyByDefault','capabilityVerifierRequired','handlerDispatch',
  'toolExecution','execution','mutatingToolsBlocked','scopeLockRequired',
]) assert.equal(authority[field], true, `Tool Runtime authority drifted: ${field}`);
for (const field of [
  'capabilityGrantAuthority','mutationAuthorized','scopeIntelligence','scopeLock','checkpoints','validationPipeline',
  'scheduling','jobCreation','persistence','networkAuthority','filesystemAuthority','databaseAuthority',
  'studioTransport','localRuntimeTransport',
]) assert.equal(authority[field], false, `Tool Runtime authority boundary drifted: ${field}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build53-tool-runtime-static/1',
  build: 53,
  toolRuntimeSchema: authority.schema,
  denyByDefault: true,
  toolExecution: true,
  mutationAuthorized: false,
  nextBuild: 54,
}, null, 2));
