import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const exists = relative => fs.existsSync(path.join(root, relative));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

const manifest = json('manifest.json');
const policy = json('architecture.guardian.json');
assert.equal(manifest.name, 'GitHub Decrypter');
assert.equal(manifest.manifest_version, 3);

if (policy.currentBuild < policy.phaseGates.extensionActivationBuild) {
  assert.equal(manifest.version, '0.0.5');
  assert.match(manifest.version_name, /GitHub Decrypter Build 5/);
  assert.ok(!manifest.host_permissions, 'pre-Build-25 shell must not target inherited hosts');
  assert.ok(!manifest.content_scripts, 'pre-Build-25 shell must remain inert');
  assert.ok(!manifest.background, 'pre-Build-25 shell must not own background behavior');
} else {
  const versionMatch = String(manifest.version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  assert.ok(versionMatch, 'activated extension version must be numeric semver');
  assert.ok(Number(versionMatch[3]) >= 5 || Number(versionMatch[0]) > 0 || Number(versionMatch[1]) > 0);
  const allowedHosts = policy.extensionAuthority?.hostAllowlist ?? [];
  for (const host of manifest.host_permissions ?? []) {
    assert.ok(allowedHosts.includes(host), `activated extension gained host outside the extension authority: ${host}`);
  }
}

for (const file of ['README.md', 'CHANGELOG.md', 'runtime/decrypter-local/README.md']) {
  const text = read(file);
  for (const forbidden of ['Lovable Decrypter', 'lovable-decrypter-extension', 'https://lovable.dev', 'ld-vault', 'ld-release-feed', 'ld-store', 'KEY LD2']) {
    assert.ok(!text.includes(forbidden), `${file} retains active predecessor identity: ${forbidden}`);
  }
}

const config = read('settings/config.js');
for (const required of [
  "PRODUCT_ID = 'github-decrypter'",
  "PRODUCT_NAME = 'GitHub Decrypter'",
  "VERSION = '0.0.5'",
  "STORAGE_KEY = 'gd_settings'",
  "HISTORY_KEY = 'gd_history'",
  "TOOL_RUNTIME_SCHEMA = 'gd-tool-runtime/1'",
  "MCP_RUNTIME_SCHEMA = 'gd-mcp-runtime/1'",
  "CONTEXT_ENGINE_SCHEMA = 'gd-context-pack/2'",
  "SCOPE_INTELLIGENCE_SCHEMA = 'gd-scope-intelligence/2'",
  "PORTABLE_SKILL_SCHEMA = 'gd-portable-skill/2'",
  "NATIVE_AGENT_SESSION_SCHEMA = 'gd-native-agent-session/1'",
  "DEFAULT_BACKEND_BASE = ''",
  "DEFAULT_VAULT_API_BASE = ''",
  "DEFAULT_UPDATE_FEED_URL = ''",
  "STORE_URL = ''"
]) assert.ok(config.includes(required), `missing canonical identity contract: ${required}`);

for (const forbidden of ['lovable-decrypter-extension', 'ld-vault', 'ld-release-feed', 'ld-store']) {
  assert.ok(!config.includes(forbidden), `settings retains inherited hosted authority: ${forbidden}`);
}
assert.ok(config.includes("LEGACY_STORAGE_KEYS = Object.freeze(['ld2_settings'])"), 'one-shot legacy storage source missing');

const store = read('storage/settings-store.js');
for (const required of ['LEGACY_STORAGE_KEYS', 'chrome.storage.local.remove(legacyKey)', '[STORAGE_KEY]: migrated']) {
  assert.ok(store.includes(required), `legacy settings migration incomplete: ${required}`);
}

const preserved = [
  'core/tool-runtime.js',
  'core/patch-engine.js',
  'core/mcp-trust-gateway.js',
  'core/context-engine-v2.js',
  'core/scope-lock.js',
  'core/scope-intelligence-v2.js',
  'core/checkpoint-manager.js',
  'core/reversible-operations.js',
  'core/continuity-engine.js',
  'core/agent-runtime-registry.js',
  'core/portable-skills.js',
  'core/agent-sandbox.js',
  'core/native-agent-sessions.js',
  'background/local-model-runtime.js',
  'runtime/decrypter-local/ollama-gateway.py'
];
for (const file of preserved) assert.ok(exists(file), `preserved modern engine missing: ${file}`);

assert.ok(exists('docs/product/BRAND_IDENTITY.md'));
assert.ok(exists('docs/builds/BUILD_5_GITHUB_DECRYPTER_REBRAND.md'));
assert.ok(exists('GITHUB_DECRYPTER_ORIGIN.md'), 'lineage record must remain');
assert.ok(!exists('.github/workflows/build4-lovable-decoupling.yml'), 'completed Build 4 workflow must not remain active CI authority');
assert.ok(exists('.github/workflows/build5-github-decrypter-rebrand.yml'));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build5-rebrand/1',
  product: manifest.name,
  version: manifest.version,
  currentBuild: policy.currentBuild,
  extensionActivationBuild: policy.phaseGates.extensionActivationBuild,
  storage: 'gd_settings',
  protocolPrefix: 'gd-',
  preservedModernEngines: preserved.length
}, null, 2));
