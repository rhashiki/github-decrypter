import fs from 'node:fs';

const mustNotExist = [
  '.github/RELEASE_TRIGGER',
  '.github/workflows/release.yml',
  'RELEASE.md',
  'launcher/launcher-runtime.js',
  'content/content.js',
  'content/cloud-migrator-runtime.js',
  'content/cloud-migrator-runtime-v2.js',
  'content/lovable-project-creator.js',
  'content/lovable-project-runtime.js',
  'content/lovable-sync-verifier.js',
  'background/cloud-assets-runtime.js',
  'background/cloud-complete-runtime.js',
  'background/cloud-migration-runtime.js',
  'background/lovable-project-runtime.js',
  'security/license.js',
  'release/RC25_MANIFEST.json',
  'release/RC31_MANIFEST.json',
  'release/homologation-v2.5.57.json',
  'release/runtime-package.json',
  'updates/latest.json',
  'updates/release.json',
  'updates/update-manager.js',
  'scripts/release-preflight.mjs',
  'scripts/test-build82-canonical-ui.mjs',
  'tests/build26-lovable-workspace-deep-read.mjs',
  'training/decrypter-coder',
];

const mustExist = [
  'core/tool-runtime.js',
  'core/context-engine-v2.js',
  'core/mcp-trust-gateway.js',
  'core/scope-lock.js',
  'core/scope-intelligence-v2.js',
  'core/reversible-operations.js',
  'core/checkpoint-manager.js',
  'background/local-model-runtime.js',
  'background/local-agent-orchestrator.js',
  'runtime/decrypter-local/ollama-gateway.py',
  'runtime/decrypter-local/compose.vllm.yaml',
  'docs/audit/EXTERNAL_SOURCE_MINING.md',
  'docs/legal/THIRD_PARTY_PROVENANCE.md',
  'third-party-sources.json',
];

const failures = [];

for (const path of mustNotExist) {
  if (fs.existsSync(path)) failures.push(`legacy authority still exists: ${path}`);
}

for (const path of mustExist) {
  if (!fs.existsSync(path)) failures.push(`preserved V1 migration asset missing: ${path}`);
}

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('architecture.guardian.json', 'utf8'));
const serializedManifest = JSON.stringify(manifest).toLowerCase();
if (serializedManifest.includes('lovable.dev')) failures.push('manifest still targets lovable.dev');

const extensionActivationBuild = policy.phaseGates?.extensionActivationBuild ?? Number.POSITIVE_INFINITY;
if (policy.currentBuild < extensionActivationBuild) {
  if ((manifest.host_permissions ?? []).length > 0) failures.push('pre-Build-25 transition manifest must not keep inherited host permissions');
  if ((manifest.content_scripts ?? []).length > 0) failures.push('pre-Build-25 transition manifest must not inject inherited content scripts');
  if (manifest.background) failures.push('pre-Build-25 transition manifest must not reactivate inherited background authority');
} else {
  const extensionRule = policy.extensionAuthority;
  if (!extensionRule || extensionRule.minimumBuild !== extensionActivationBuild) {
    failures.push('activated extension requires an explicit Build 25 extension authority');
  } else {
    for (const host of manifest.host_permissions ?? []) {
      if (!(extensionRule.hostAllowlist ?? []).includes(host)) failures.push(`activated extension host is outside GitHub Decrypter authority: ${host}`);
    }
    if (manifest.background?.service_worker !== extensionRule.serviceWorker) {
      failures.push('activated extension background must be the Build 25 lightweight service worker');
    }
    const contentScripts = manifest.content_scripts ?? [];
    for (const entry of contentScripts) {
      for (const match of entry.matches ?? []) {
        if (!(extensionRule.hostAllowlist ?? []).includes(match)) failures.push(`activated content script targets non-authorized host: ${match}`);
      }
      for (const script of entry.js ?? []) {
        if (script !== extensionRule.contentScript) failures.push(`activated content script is outside Build 25 authority: ${script}`);
      }
    }
  }
}

if (fs.existsSync('.github/workflows')) {
  const old = fs.readdirSync('.github/workflows').filter((name) => name === 'release.yml' || /^v2\./.test(name) || name === 'diagnostic-safe-core.yml');
  if (old.length) failures.push(`inherited workflows still present: ${old.join(', ')}`);
}

const sources = JSON.parse(fs.readFileSync('third-party-sources.json', 'utf8'));
if (!Array.isArray(sources.entries) || sources.entries.length < 9) failures.push('third-party source ledger is incomplete');

if (failures.length) {
  console.error('Build 4 Lovable decoupling regression failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Build 4 Lovable decoupling regression passed.');
