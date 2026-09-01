import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const src = fs.readFileSync('launcher/launcher-runtime.js','utf8');

assert.equal(manifest.version,'2.6.82');
assert.deepEqual(manifest.content_scripts?.[0]?.js,['launcher/launcher-runtime.js']);
assert.equal(Boolean(manifest.background),false);
assert.equal(Boolean(manifest.web_accessible_resources),false);
assert.deepEqual(pkg.paths,['manifest.json','assets','launcher']);
assert.ok(pkg.forbidden_roots.includes('ui'));
assert.ok(pkg.forbidden_roots.includes('diagnostic'));

for (const dead of [
  'ui','diagnostic','assets/fab.png','content/ui-shell-bootstrap.js','content/ui-mount-guardian.js',
  'background/decrypter-chat-runtime.js','content/decrypter-chat-core.js','content/decrypter-chat.js',
  '.github/workflows/v2.4-build29-decrypter-chat.yml','tests/build29-decrypter-chat.mjs',
  '.github/workflows/v2.6-build79-diagnostic-minimal-runtime.yml',
  '.github/workflows/v2.6-build80-diagnostic-fab-injection.yml',
  '.github/workflows/v2.6-build81-diagnostic-ui-shell.yml',
  'tests/build79-diagnostic-minimal-runtime.test.mjs',
  'tests/build80-diagnostic-fab-injection.test.mjs',
  'tests/build81-diagnostic-ui-shell.test.mjs'
]) assert.equal(fs.existsSync(dead),false,`legacy path survived: ${dead}`);

for (const token of ['__LD_CANONICAL_LAUNCHER_V82__','rail','flyout','detail','data-ld-ui-authority','canonical-v11']) assert.ok(src.includes(token),`missing canonical token: ${token}`);
for (const forbidden of ['innerHTML','insertAdjacentHTML','MutationObserver','setInterval(','setTimeout(','requestAnimationFrame(','chrome.storage','chrome.runtime.sendMessage','fetch(','XMLHttpRequest','Decrypter Chat']) assert.equal(src.includes(forbidden),false,`forbidden runtime pattern: ${forbidden}`);

const sw = fs.readFileSync('background/service-worker-entry.js','utf8');
assert.equal(sw.includes('decrypter-chat-runtime'),false);
assert.equal(sw.includes('installDecrypterChatRuntime'),false);

console.log('Build82 canonical UI / legacy purge: OK');
