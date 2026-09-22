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
const policy = JSON.parse(read('architecture.guardian.json') || '{}');

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

if ((policy.currentBuild ?? 0) >= 64) {
  const session = read('apps/studio/src/viktor-session.ts');
  const component = read('apps/studio/src/ViktorToggle.tsx');
  const app = read('apps/studio/src/App.tsx');
  for (const phrase of [
    "VIKTOR_SESSION_SCHEMA = 'gd-viktor-session/1'",
    "let state:ViktorState='OFF'",
    'requestMicrophonePermission()',
    'await adapter.stopMicrophoneCapture()',
    'await adapter.stopVoiceTransport()',
    'await adapter.cancelAssistantAudio()',
    'persistentActivation:false',
    'backgroundListening:false',
  ]) requirePhrase('Build 64 Viktor session', session, phrase);
  for (const phrase of ['ViktorToggle','aria-pressed={snapshot.enabled}','Turn Viktor on','Turn Viktor off']) {
    requirePhrase('Build 64 Viktor toggle', component, phrase);
  }
  requirePhrase('Build 64 Studio', app, '<ViktorToggle />');
  if (/\blocalStorage\b|\bindexedDB\b|\bWebSocket\b|\bfetch\s*\(/.test(session + '\n' + component)) {
    violations.push('Build 64 Viktor activation must remain session-only and provider-neutral without hidden persistence/network transport.');
  }
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
