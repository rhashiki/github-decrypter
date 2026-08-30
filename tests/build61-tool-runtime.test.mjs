import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const bg = read('background/tool-runtime.js');
const client = read('content/tool-runtime-client.js');
const tools = read('core/tool-runtime.js');
const journal = read('core/operation-journal.js');
const patch = read('core/patch-engine.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version, '2.6.61');
assert.match(manifest.version_name, /Build 61 · Tool Runtime \/ Coding Tools/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.61'"));
assert.ok(settings.includes("TOOL_RUNTIME_SCHEMA = 'ld-tool-runtime/1'"));
assert.ok(settings.includes("OPERATION_JOURNAL_SCHEMA = 'ld-operation-journal/1'"));
assert.ok(manifest.content_scripts[1].js.includes('content/tool-runtime-client.js'));
assert.ok(entry.includes("import { installToolRuntime } from './tool-runtime.js';"));
assert.ok(entry.includes('installToolRuntime();'));

for (const name of [
  'repo.list_files',
  'repo.read_file',
  'repo.grep',
  'repo.git_diff',
  'repo.patch_preview',
  'repo.patch_apply',
  'repo.write_file',
  'diagnostics.run',
  'lsp.query'
]) assert.ok(tools.includes(`name: '${name}'`), name);

for (const token of [
  'TOOL_WRITE_APPROVAL_REQUIRED',
  'TOOL_SCOPE_LOCK_REJECTED',
  'TOOL_SENSITIVE_PATH_BLOCKED',
  'WRITE_EXPECTED_BLOB_REQUIRED',
  'WRITE_STALE_BLOB',
  'PATCH_STALE_BLOB',
  'PATCH_AMBIGUOUS_MATCH',
  'TOOL_CAPABILITY_UNAVAILABLE'
]) assert.ok(`${tools}\n${patch}`.includes(token), token);

assert.ok(bg.includes("tx.status !== 'validated'"));
assert.ok(bg.includes("writePolicy: 'validated-approval-transaction-only'"));
assert.ok(!bg.includes('payload?.authorization?.writeApproved'), 'background must not trust client writeApproved booleans');
assert.ok(client.includes('transactionId'));
assert.ok(client.includes("origin: options.origin || 'tool'"));

for (const origin of ['ai', 'user', 'undo', 'redo', 'tool', 'formatter', 'lsp', 'git', 'external']) {
  assert.ok(journal.includes(`'${origin}'`), `origin ${origin}`);
}
assert.ok(journal.includes('Never persist file contents, prompts, replacement text, secrets or tokens.'));
assert.ok(!journal.includes('input.content'));
assert.ok(!journal.includes('input.replacement'));
assert.ok(!journal.includes('input.token'));

assert.ok(patch.includes("crypto.subtle.digest('SHA-256'"));
assert.ok(patch.includes('countOccurrences'));
assert.ok(patch.includes('replaceOccurrence'));
assert.ok(patch.includes('renderPatchPreview'));
assert.ok(tools.includes('isSensitivePath'));
assert.ok(tools.includes('isTextPath'));
assert.ok(tools.includes('createBranch: false, createPr: false'));
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

for (const invariant of [
  'No paid GPU server is required',
  'No commercial token quota is required',
  'Work must survive model/runtime interruption',
  'No automatic paid-AI fallback',
  'Human edits outrank previous AI edits',
  'Build 66 — Smart Undo/Redo + Reversible Operations',
  'Build 67 — Continuity Engine'
]) assert.ok(roadmap.includes(invariant), invariant);

console.log('Build61 Tool Runtime contract OK');
