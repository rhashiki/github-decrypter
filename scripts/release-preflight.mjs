import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidateMode = process.argv.includes('--candidate');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const fail = message => { throw new Error(`RELEASE_PREFLIGHT: ${message}`); };
const normalize = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');

const manifest = json('manifest.json');
const packageSpec = json('release/runtime-package.json');
const version = String(manifest.version || '');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`invalid manifest version: ${version}`);
if (packageSpec.schema !== 'ld-runtime-package/1') fail('runtime package schema mismatch');
if (String(packageSpec.candidate || '') !== version) fail(`package candidate ${packageSpec.candidate} != manifest ${version}`);

const config = read('settings/config.js');
const configVersion = config.match(/export const VERSION = '([^']+)'/)?.[1] || '';
const trust = config.match(/export const TRUST_PROTOCOL_VERSION = '([^']+)'/)?.[1] || '';
if (configVersion !== version) fail(`settings VERSION ${configVersion} != manifest ${version}`);
if (trust !== '2.4.21') fail(`unexpected Trust Protocol ${trust}`);

const packageRoots = new Set((packageSpec.paths || []).map(normalize));
const excludedPaths = new Set((packageSpec.excluded_paths || []).map(normalize));
const forbiddenRoots = new Set((packageSpec.forbidden_roots || []).map(normalize));
const forbiddenPaths = new Set((packageSpec.forbidden_paths || []).map(normalize));
for (const item of packageRoots) {
  if (!item || forbiddenRoots.has(item.split('/')[0])) fail(`forbidden package root: ${item}`);
  if (forbiddenPaths.has(item)) fail(`forbidden package path: ${item}`);
  if (!fs.existsSync(path.join(root, item))) fail(`missing package path: ${item}`);
}
for (const item of excludedPaths) {
  if (!item || !fs.existsSync(path.join(root, item))) fail(`excluded path does not exist: ${item}`);
  if (packageRoots.has(item)) fail(`path cannot be both included and excluded: ${item}`);
}

function walk(relative) {
  const absolute = path.join(root, relative);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [normalize(relative)];
  const out = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = normalize(path.join(relative, entry.name));
    if (entry.isDirectory()) out.push(...walk(child));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

const packageFiles = new Set();
for (const item of packageRoots) for (const file of walk(item)) packageFiles.add(file);
for (const item of excludedPaths) packageFiles.delete(item);
if (!packageFiles.has('manifest.json')) fail('manifest.json missing from runtime package');

const forbiddenExtensions = new Set((packageSpec.forbidden_extensions || []).map(value => String(value).toLowerCase()));
for (const file of packageFiles) {
  const lower = file.toLowerCase();
  const base = path.posix.basename(lower);
  if (forbiddenPaths.has(file)) fail(`forbidden file leaked into package: ${file}`);
  if (excludedPaths.has(file)) fail(`excluded file leaked into package: ${file}`);
  if (base === '.env' || base.startsWith('.env.')) fail(`environment file in package: ${file}`);
  if (forbiddenExtensions.has(path.posix.extname(lower))) fail(`private credential file in package: ${file}`);
  const top = file.split('/')[0];
  if (forbiddenRoots.has(top)) fail(`forbidden root leaked into package: ${file}`);
}

const manifestRefs = new Set();
const addRef = value => {
  const ref = normalize(value);
  if (ref && !ref.includes('*')) manifestRefs.add(ref);
};
addRef(manifest.background?.service_worker);
Object.values(manifest.icons || {}).forEach(addRef);
addRef(manifest.action?.default_popup);
for (const script of manifest.content_scripts || []) {
  (script.js || []).forEach(addRef);
  (script.css || []).forEach(addRef);
}
for (const item of manifest.web_accessible_resources || []) (item.resources || []).forEach(addRef);
for (const ref of manifestRefs) {
  if (excludedPaths.has(ref)) fail(`manifest references excluded path: ${ref}`);
  if (!packageFiles.has(ref)) fail(`manifest runtime reference missing from package: ${ref}`);
}

function resolveRelativeImport(fromFile, specifier) {
  const clean = String(specifier || '').split(/[?#]/, 1)[0];
  if (!clean.startsWith('.')) return null;
  const base = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean)));
  const candidates = path.posix.extname(base)
    ? [base]
    : [base, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.js`, `${base}/index.mjs`];
  return candidates.find(candidate => packageFiles.has(candidate)) || '';
}

const importPattern = /(?:import|export)\s+(?:[^'"\n]*?\sfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const monkeypatchPatterns = [
  /(?:window|globalThis)\.fetch\s*=(?!=)/,
  /XMLHttpRequest\.prototype\.(?:open|send)\s*=(?!=)/,
  /navigator\.sendBeacon\s*=(?!=)/
];
for (const file of packageFiles) {
  if (!/\.(?:m?js)$/i.test(file)) continue;
  const source = read(file);
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1] || match[2] || '';
    if (!specifier.startsWith('.')) continue;
    const resolved = resolveRelativeImport(file, specifier);
    if (!resolved) fail(`unresolved relative import ${specifier} from ${file}`);
  }
  if (monkeypatchPatterns.some(pattern => pattern.test(source))) fail(`global network monkeypatch detected in ${file}`);
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(source)) fail(`private key material marker detected in ${file}`);
}

let stableVersion = '';
try { stableVersion = String(json('updates/release.json').version || ''); } catch (_) {}
let legacySignedVersion = '';
try {
  const envelope = json('updates/latest.json');
  if (envelope?.payload) {
    const payload = JSON.parse(Buffer.from(String(envelope.payload), 'base64url').toString('utf8'));
    legacySignedVersion = String(payload?.version || '');
  }
} catch (_) {}
const releaseTrigger = fs.existsSync(path.join(root, '.github/RELEASE_TRIGGER')) ? read('.github/RELEASE_TRIGGER').trim() : '';

if (candidateMode) {
  if (stableVersion === version) fail(`candidate ${version} is already present in updates/release.json`);
  if (legacySignedVersion === version) fail(`candidate ${version} is already present in signed legacy OTA metadata`);
  if (releaseTrigger.includes(version)) fail(`release trigger is already armed for candidate ${version}`);
}

const result = {
  ok: true,
  schema: 'ld-release-preflight/1',
  version,
  trust_protocol: trust,
  runtime_files: packageFiles.size,
  manifest_references: manifestRefs.size,
  excluded_paths: [...excludedPaths].sort(),
  relative_imports_resolved: true,
  forbidden_paths_absent: true,
  global_network_monkeypatch: false,
  private_key_material: false,
  candidate_mode: candidateMode,
  stable_metadata_version: stableVersion || null,
  legacy_signed_version: legacySignedVersion || null,
  release_trigger: releaseTrigger || null
};
console.log(JSON.stringify(result, null, 2));
