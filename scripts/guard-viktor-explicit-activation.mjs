import fs from 'node:fs';

const requiredFiles = {
  amendment: 'docs/product/CONSTITUTION_AMENDMENT_003_VIKTOR_EXPLICIT_ACTIVATION.md',
  architecture: 'docs/architecture/VIKTOR_INTERACTION_LAYER.md',
  mapping: 'docs/product/NORTH_STAR_ROADMAP_MAPPING.md',
  roadmap: 'docs/product/ROADMAP_V1.md',
};

const violations = [];

function read(path) {
  if (!fs.existsSync(path)) {
    violations.push(`Missing required Viktor activation authority: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requirePhrase(sourceName, source, phrase) {
  if (!source.includes(phrase)) {
    violations.push(`${sourceName} lost required Viktor activation invariant: ${phrase}`);
  }
}

const amendment = read(requiredFiles.amendment);
const architecture = read(requiredFiles.architecture);
const mapping = read(requiredFiles.mapping);
const roadmap = read(requiredFiles.roadmap);

for (const phrase of [
  'OFF by default at the beginning of each new application session',
  'explicitly switches the visible `Viktor` toggle to `ON`',
  'stop microphone capture',
  'No background listening',
  'Build 64 — Agent Orchestrator',
]) {
  requirePhrase('Amendment 003', amendment, phrase);
}

for (const phrase of [
  '## Explicit activation contract',
  'new session -> Viktor OFF',
  'toggle OFF -> no microphone capture',
  'no hidden wake-word listener',
]) {
  requirePhrase('Viktor architecture', architecture, phrase);
}

for (const phrase of [
  'visible per-session Viktor activation toggle',
  'each new application session starts with Viktor voice `OFF`',
  'switching Viktor `OFF` must immediately stop microphone capture',
]) {
  requirePhrase('North Star mapping', mapping, phrase);
}

for (const phrase of [
  'Viktor activation toggle',
  'Every new application session begins with Viktor `OFF`',
  'No hidden wake-word/background listener',
  'CONSTITUTION_AMENDMENT_003_VIKTOR_EXPLICIT_ACTIVATION.md',
]) {
  requirePhrase('Canonical roadmap', roadmap, phrase);
}

if (violations.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    schema: 'vortex-viktor-explicit-activation-guard/1',
    violations,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'vortex-viktor-explicit-activation-guard/1',
  protectedAuthority: 'CONSTITUTION_AMENDMENT_003_VIKTOR_EXPLICIT_ACTIVATION.md',
  owningBuild: 64,
  defaultSessionState: 'OFF',
  explicitToggleRequired: true,
  backgroundListeningAuthorized: false,
}, null, 2));
