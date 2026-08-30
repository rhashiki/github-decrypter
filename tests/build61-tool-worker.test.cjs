'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ld61-tools-'));
fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true }, include: ['src'] }));
fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const value: number = 42;\n');
fs.writeFileSync(path.join(root, 'src', 'b.ts'), "import { value } from './a';\nconsole.log(value);\n");
fs.writeFileSync(path.join(root, 'README.md'), 'hello decrypter tools\n');
try { fs.symlinkSync('/etc/passwd', path.join(root, 'escape.txt')); } catch (_) {}

process.env.DECRYPTER_WORKSPACE_ROOT = root;
process.env.DECRYPTER_WORKSPACE_ID = 'test-project';
process.env.DECRYPTER_TOOL_WORKER_TOKEN = 'unit-secret';
process.env.DECRYPTER_LSP_TIMEOUT_MS = '15000';

const worker = require('../runtime/decrypter-tools/tool-worker.cjs');

async function main() {
  assert.equal(worker.timingSafeBearer('Bearer unit-secret', 'unit-secret'), true);
  assert.equal(worker.timingSafeBearer('Bearer wrong', 'unit-secret'), false);
  assert.equal(worker.ensureWorkspace('test-project'), 'test-project');
  assert.throws(() => worker.ensureWorkspace('other-project'), /WORKSPACE_ID_MISMATCH/);

  const listed = worker.toolList({ path: '.', max_files: 50, max_depth: 4 });
  assert.ok(listed.entries.some(item => item.path === 'src/a.ts'));
  assert.ok(listed.entries.some(item => item.path === 'src/b.ts'));

  const read = worker.toolRead({ path: 'src/a.ts' });
  assert.match(read.content, /value: number = 42/);
  assert.equal(read.truncated, false);

  const grep = worker.toolGrep({ query: 'value', path: 'src' });
  assert.ok(grep.matches.length >= 2);
  assert.ok(grep.matches.every(item => item.path.startsWith('src/')));

  if (fs.existsSync(path.join(root, 'escape.txt'))) assert.throws(() => worker.safeExistingPath('escape.txt'), /SYMLINK_ESCAPE_BLOCKED/);
  assert.throws(() => worker.safeExistingPath('../outside.txt'), /PATH_INVALID/);
  assert.throws(() => worker.toolRead({ path: 'tsconfig.json/../x' }), /PATH_INVALID|PATH_NOT_FOUND/);
  assert.throws(() => worker.position({ line: 0, character: 1 }), /LSP_POSITION_INVALID/);

  const definition = await worker.lspDefinition({ path: 'src/b.ts', line: 2, character: 13 });
  assert.ok(Array.isArray(definition.locations));
  assert.ok(definition.locations.length >= 1, 'LSP must resolve imported symbol definition');
  const target = definition.locations[0]?.uri || definition.locations[0]?.targetUri || '';
  assert.ok(String(target).endsWith('/src/a.ts'), `unexpected LSP target ${target}`);

  console.log('Build61 tool worker + real TypeScript LSP contract OK');
}

main().finally(() => fs.rmSync(root, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1; });
