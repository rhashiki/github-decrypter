import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = process.cwd();
const CANONICAL = 'launcher/launcher-runtime.js';
const normalize = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
const absolute = relative => path.join(ROOT, normalize(relative));
const exists = relative => fs.existsSync(absolute(relative));
const read = relative => fs.readFileSync(absolute(relative), 'utf8');
const json = relative => JSON.parse(read(relative));

export const HISTORICAL_REFERENCE_ALLOWLIST = Object.freeze([
  'docs/**',
  'tests/** except Build82 canonical/preservation gates',
  '.github/workflows/** except v2.6-build82-canonical-ui-legacy-purge.yml'
]);

const manifest = json('manifest.json');
const packageSpec = json('release/runtime-package.json');
const launcher = read(CANONICAL);

assert.equal(manifest.version, '2.6.82');
assert.match(String(manifest.version_name || ''), /Build 82/i);
assert.equal(manifest.content_scripts?.length, 1, 'Build82 must expose exactly one content-script registration');
const activeScripts = (manifest.content_scripts || []).flatMap(item => item.js || []);
assert.deepEqual(activeScripts, [CANONICAL], 'canonical launcher must be the only active content script');
assert.ok(!manifest.background, 'Build82 diagnostic manifest must not activate a background service worker');
assert.deepEqual(manifest.permissions || [], [], 'Build82 diagnostic manifest must not request extension permissions');
const webResources = (manifest.web_accessible_resources || []).flatMap(item => item.resources || []);
assert.equal(webResources.length, 0, 'Build82 must not expose web-accessible UI assets');
assert.ok(!JSON.stringify(manifest).includes('assets/fab.png'), 'legacy FAB artwork must not be referenced by manifest');
assert.ok((manifest.host_permissions || []).length > 0, 'Lovable host scope is required for the canonical launcher');
assert.ok((manifest.host_permissions || []).every(item => /lovable/i.test(String(item))), 'host scope must remain Lovable-only');

assert.equal(packageSpec.schema, 'ld-runtime-package/1');
assert.equal(packageSpec.candidate, manifest.version);
assert.deepEqual(new Set(packageSpec.paths || []), new Set(['manifest.json', 'assets', 'launcher']));
for (const required of ['ui', 'diagnostic', 'background', 'content', 'runtime', 'supabase', 'updates']) {
  assert.ok((packageSpec.forbidden_roots || []).includes(required), `runtime package must forbid ${required}/`);
}
for (const packagedPath of packageSpec.paths || []) {
  assert.ok(!['ui', 'diagnostic', 'background', 'content'].includes(normalize(packagedPath).split('/')[0]), `legacy/runtime source root leaked into package: ${packagedPath}`);
}
assert.ok(!JSON.stringify(packageSpec.paths || []).includes('fab.png'));

const legacyPaths = Object.freeze([
  'ui.js',
  'ui',
  'diagnostic',
  'assets/fab.png',
  'background/decrypter-chat-runtime.js',
  'content/ui-shell-bootstrap.js',
  'content/ui-mount-guardian.js',
  'content/fallback-pill.js',
  'content/nexus-ui-bootstrap.js',
  'content/performance-observer.js',
  'content/checkpoint-ui.js',
  'content/cloud-ui.js',
  'content/preview-progress-overlay.js',
  'content/composer-pro.js',
  'content/composer-guardian.js',
  'content/composer-bridge-v3.js',
  'content/automatic-suggestions.js',
  'content/batch-mode.js',
  'content/project-intelligence.js',
  'content/project-recovery-doctor.js',
  'content/approval-auto-repair.js',
  'content/monitor.js',
  'content/dom-guardian.js',
  'content/early-boot-sentinel.js',
  'content/hardening-core.js',
  'content/hardening-sentinel.js',
  'content/runtime-integrity-guard.js',
  'content/capability-registry.js',
  ...Array.from({ length: 10 }, (_, index) => `content/build${index + 9}-reconciliation.js`)
]);
for (const legacyPath of legacyPaths) assert.ok(!exists(legacyPath), `legacy UI path must be physically absent: ${legacyPath}`);

assert.ok(launcher.includes("const HOST_ID = 'lovable-decrypter-launcher'"), 'canonical v11 host identity changed unexpectedly');
assert.ok(launcher.includes("host.setAttribute('data-ld-ui-authority', 'canonical-v11')"), 'canonical-v11 authority marker is required');
assert.match(launcher, /host\.attachShadow\s*\(\s*\{\s*mode\s*:\s*['"](?:open|closed)['"]\s*\}\s*\)/);
for (const structuralToken of ["fab.id = 'fab'", "rail.id = 'rail'", "flyout.id = 'flyout'", "detail.id = 'detail'"]) {
  assert.ok(launcher.includes(structuralToken), `canonical FAB → rail → flyout → detail contract missing ${structuralToken}`);
}
for (const prohibited of [
  ['MutationObserver', /\bMutationObserver\b/],
  ['polling interval', /\bsetInterval\s*\(/],
  ['extension storage', /chrome\.storage/],
  ['network fetch', /\bfetch\s*\(/],
  ['legacy FAB asset', /assets\/fab\.png/i],
  ['legacy root', /\bld2-root\b/i],
  ['legacy Decrypter Chat host', /ld2-decrypter-chat-host/i]
]) assert.ok(!prohibited[1].test(launcher), `canonical launcher must not contain ${prohibited[0]}`);

function walk(relative) {
  const target = absolute(relative);
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [normalize(relative)];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = normalize(path.posix.join(normalize(relative), entry.name));
    if (entry.isDirectory()) out.push(...walk(child));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

const executableRoots = ['launcher', 'content'];
const executableFiles = executableRoots
  .flatMap(walk)
  .filter(file => /\.(?:m?js|cjs|ts|tsx|jsx)$/i.test(file));

const forbiddenMarkers = Object.freeze([
  ['legacy-root', /\bld2-root\b/i],
  ['legacy-fab-id', /\bld2-fab\b/i],
  ['legacy-chat-host', /ld2-decrypter-chat-host/i],
  ['legacy-native-bridge', /\.ld2-native-bridge\b/i],
  ['legacy-chat-global', /\bLovableDecrypterChat\b/],
  ['legacy-dom-reconcile', /ld2:dom-reconcile/i],
  ['legacy-unified-launcher', /ld2:unified-launcher-ready/i],
  ['legacy-shell-bootstrap', /ui-shell-bootstrap/i],
  ['legacy-mount-guardian', /ui-mount-guardian/i],
  ['legacy-premium-launcher', /launcher-premium/i],
  ['legacy-nexus-parity', /nexus-parity/i],
  ['legacy-ui-kernel', /ui-kernel/i],
  ['legacy-fab-asset', /assets\/fab\.png/i],
  ['legacy-diagnostic-shell', /diagnostic\/ui-shell-runtime\.js/i],
  ['legacy-chat-runtime', /decrypter-chat-runtime/i]
]);

const violations = [];
const shadowOwners = [];
for (const file of executableFiles) {
  const source = read(file);
  if (/attachShadow\s*\(/.test(source)) shadowOwners.push(file);
  for (const [id, pattern] of forbiddenMarkers) {
    if (pattern.test(source)) violations.push(`${id}:${file}`);
  }
}
assert.deepEqual(shadowOwners, [CANONICAL], `secondary Shadow DOM UI authority detected: ${shadowOwners.join(', ')}`);
assert.deepEqual(violations, [], `forbidden legacy UI references remain in executable surface:\n${violations.join('\n')}`);

const sourceRoots = ['launcher', 'content', 'background', 'core'];
const sourceFiles = sourceRoots.flatMap(walk).filter(file => /\.(?:m?js|cjs)$/i.test(file));
const importPattern = /(?:import|export)\s+(?:[^'"\n]*?\sfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const forbiddenImportTarget = /(?:^|\/)(?:ui|diagnostic)(?:\/|$)|ui-shell-bootstrap|ui-mount-guardian|decrypter-chat-runtime|composer-(?:pro|guardian|bridge-v3)|build(?:9|1[0-8])-reconciliation/;
const badImports = [];
const unresolvedImports = [];

function resolveRelativeImport(fromFile, specifier) {
  const clean = String(specifier || '').split(/[?#]/, 1)[0];
  if (!clean.startsWith('.')) return null;
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean)));
  const candidates = path.posix.extname(base)
    ? [base]
    : [base, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.js`, `${base}/index.mjs`];
  return candidates.find(exists) || '';
}

for (const file of sourceFiles) {
  const source = read(file);
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1] || match[2] || '';
    if (forbiddenImportTarget.test(normalize(specifier))) badImports.push(`${file} -> ${specifier}`);
    if (!specifier.startsWith('.')) continue;
    const resolved = resolveRelativeImport(file, specifier);
    if (!resolved) unresolvedImports.push(`${file} -> ${specifier}`);
    else if (forbiddenImportTarget.test(resolved)) badImports.push(`${file} -> ${resolved}`);
  }
}
assert.deepEqual(badImports, [], `legacy UI import detected:\n${badImports.join('\n')}`);
assert.deepEqual(unresolvedImports, [], `unresolved source import detected after purge:\n${unresolvedImports.join('\n')}`);

const entry = read('background/service-worker-entry.js');
for (const token of ['decrypter-chat-runtime', 'ui/', 'diagnostic/', 'ui-shell', 'mount-guardian']) {
  assert.ok(!entry.includes(token), `service worker entry must not reference ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'ld-build82-canonical-ui-gate/1',
  activeVisualRuntimes: 1,
  authority: 'canonical-v11',
  host: 'lovable-decrypter-launcher',
  forbiddenRefs: 0,
  legacyPaths: 0,
  secondaryShadowRoots: 0,
  unresolvedImports: 0,
  historicalReferenceAllowlist: HISTORICAL_REFERENCE_ALLOWLIST
}, null, 2));
