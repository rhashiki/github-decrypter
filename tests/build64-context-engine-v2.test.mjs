import fs from 'node:fs';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
        return Object.fromEntries(list.filter(key => storage.has(key)).map(key => [key, storage.get(key)]));
      },
      async set(value) { for (const [key, item] of Object.entries(value || {})) storage.set(key, item); }
    }
  }
};

const { buildContextPack, CONTEXT_ENGINE_SCHEMA } = await import('../core/context-engine-v2.js');
const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const context = read('core/context-engine-v2.js');
const builder = read('core/context-builder.js');
const userEdit = read('content/user-edit-context.js');
const bg = read('background/context-engine-runtime.js');
const client = read('content/context-engine-client.js');
const entry = read('background/service-worker-entry.js');
const git = read('github/git-adapter.js');

const currentBuild = Number(String(manifest.version || '').split('.').at(-1));
assert.ok(Number.isInteger(currentBuild) && currentBuild >= 64, `Build64 contract requires authoritative Build >=64, received ${manifest.version}`);
assert.match(manifest.version_name, new RegExp(`Build ${currentBuild}\\b`));
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes(`VERSION = '${manifest.version}'`));
assert.ok(settings.includes("CONTEXT_ENGINE_SCHEMA = 'ld-context-pack/2'"));
assert.ok(settings.includes("USER_EDIT_CONTEXT_SCHEMA = 'ld-user-edit-context/1'"));
assert.ok(settings.includes("agent:{maxFiles:16,maxContextBytes:220000"));
assert.equal(CONTEXT_ENGINE_SCHEMA, 'ld-context-pack/2');

assert.ok(entry.includes("import { installContextEngineRuntime } from './context-engine-runtime.js';"));
assert.ok(entry.includes('installContextEngineRuntime();'));
const scripts = manifest.content_scripts[1].js;
assert.ok(scripts.includes('content/context-engine-client.js'));
assert.ok(scripts.includes('content/user-edit-context.js'));
assert.ok(scripts.indexOf('content/user-edit-context.js') > scripts.indexOf('content/lovable-workspace-deep-read.js'));

for (const token of [
  'budgeted-multi-source-ranking',
  'recent-user-edits',
  'operation-journal',
  'git-history',
  'project-brain',
  'impact-maps',
  'knowledge',
  "humanIntentEnforcement: 'build65'",
  'rawPromptPersistence: false',
  'rawKeystrokePersistence: false'
]) assert.ok(bg.includes(token), token);

for (const token of [
  'recent-user-edit',
  'explicit-task-path',
  'recent-operation',
  'project-brain-important-path',
  'project-documentation',
  'retrievedKnowledgeAuthority',
  'historical-ai-output',
  'rawKeystrokesPersisted: false',
  'rawPromptPersistedByContextEngine: false',
  'enforcement-escalates-in-build65'
]) assert.ok(context.includes(token), token);

assert.ok(builder.includes("from './context-engine-v2.js'"));
assert.ok(builder.includes('legacySignals'));
assert.ok(builder.includes('ld2_agent_profile_'));
assert.ok(git.includes('async listCommits('));
assert.ok(git.includes('async compareCommits('));

for (const token of [
  "USER_EDIT_COMMITTED",
  "WORKSPACE_CHANGE_OBSERVED",
  "recent-code-editor-input",
  "workspace-revision-changed",
  "rawKeystrokesPersisted: false",
  "contentPersisted: false",
  "addEventListener('input'",
  "ld2:workspace-snapshot"
]) assert.ok(userEdit.includes(token), token);
assert.ok(!userEdit.includes('event.target.value'));
assert.ok(!userEdit.includes('textContent = event'));
assert.ok(!/setInterval\s*\(/.test(userEdit));
assert.ok(userEdit.includes('EDIT_IDLE_MS = 1800'));

for (const token of ['status()', 'userEdits(', 'build(task', "schema: 'ld-context-pack/2'"]) assert.ok(client.includes(token), token);

const blobs = {
  app: 'export function App(){\n  const sidebarWidth = 420;\n  return sidebarWidth;\n}\n',
  readme: '# Demo\nProjeto de sidebar e autenticação.\n',
  auth: 'export const login = () => true;\n',
  huge: `${'const unrelated = true;\n'.repeat(7000)}\nexport const sidebarWidth = 360;\n${'const tail = false;\n'.repeat(3000)}`,
  secret: 'SECRET=should-never-enter-context'
};
const fake = {
  owner: 'acme', repo: 'demo', branch: 'main',
  async getTree() { return { truncated: false, tree: [
    { type:'blob', path:'src/App.tsx', sha:'app', size:blobs.app.length },
    { type:'blob', path:'README.md', sha:'readme', size:blobs.readme.length },
    { type:'blob', path:'src/auth.ts', sha:'auth', size:blobs.auth.length },
    { type:'blob', path:'src/huge.ts', sha:'huge', size:blobs.huge.length },
    { type:'blob', path:'.env', sha:'secret', size:blobs.secret.length }
  ]}; },
  async getBlob(sha) { return blobs[sha]; },
  async listCommits() { return [{ sha:'abc123', commit:{ message:'fix sidebar', author:{date:'2026-08-30T10:00:00Z',name:'Dev'} } }]; }
};

const pack = await buildContextPack(fake, 'Preserve minha alteração de sidebarWidth e ajuste a sidebar', {
  projectId: 'project-1', owner:'acme', repo:'demo', branch:'main',
  profile: { project_summary:'Demo', rules:['Não alterar autenticação'], important_paths:['src/App.tsx'] },
  userEdits: [{ id:'u1', origin:'user', observedAt:'2026-08-30T12:00:00Z', beforeRevision:'a', afterRevision:'b', paths:['src/App.tsx'], pathResolution:'resolved', evidence:['recent-code-editor-input'] }],
  journal: [{ id:'j1', tool:'repo.patch_apply', mode:'write', origin:'ai', status:'ok', input:{paths:['src/auth.ts']}, changes:[], result:{} }],
  impacts: [{ risk_level:'medium', affected_paths:['src/App.tsx'], risk_reasons:['UI'] }],
  skills: [{ slug:'ui-quality', display_name:'UI Quality', official:true }],
  diagnostics: { typescript:'ok' },
  explicitPaths:['src/App.tsx'],
  maxFiles:4, maxContextBytes:90000, maxCodeBytes:60000, maxFileBytes:18000
});
assert.equal(pack.schema, 'ld-context-pack/2');
assert.equal(pack.recentUserEdits[0].origin, 'user');
assert.equal(pack.recentUserEdits[0].contentPersisted, false);
assert.equal(pack.git.recentCommits[0].sha, 'abc123');
assert.equal(pack.projectBrain.rules[0], 'Não alterar autenticação');
assert.equal(pack.skills[0].slug, 'ui-quality');
assert.equal(pack.impactSignals[0].risk, 'medium');
assert.equal(pack.provenance.rawKeystrokesPersisted, false);
assert.equal(pack.provenance.rawPromptPersistedByContextEngine, false);
assert.ok(pack.files.some(file => file.path === 'src/App.tsx'));
assert.ok(!pack.files.some(file => file.path === '.env'));
assert.ok(pack.files.find(file => file.path === 'src/App.tsx').reasons.includes('recent-user-edit'));
assert.ok(pack.budget.usedCodeBytes <= pack.budget.codeBytes);
assert.ok(pack.files.length <= pack.budget.maxFiles);
assert.ok(pack.authority.precedence.indexOf('explicit-user-manual-edit') < pack.authority.precedence.indexOf('historical-ai-output'));

assert.match(pkg.notes, /Build6[4-9]/);
assert.match(pkg.notes, /Context Engine v2/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log(`Build64 Context Engine v2 contract OK on authoritative Build ${currentBuild}`);