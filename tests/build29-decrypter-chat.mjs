import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const entry = fs.readFileSync('background/service-worker-entry.js', 'utf8');
const background = fs.readFileSync('background/decrypter-chat-runtime.js', 'utf8');
const coreSource = fs.readFileSync('content/decrypter-chat-core.js', 'utf8');
const chatSource = fs.readFileSync('content/decrypter-chat.js', 'utf8');

const [major, minor, patch] = manifest.version.split('.').map(Number);
assert.equal(major, 2);
assert.equal(minor, 4);
assert.ok(patch >= 29, 'Build 29 contract must survive later 2.4 builds');
assert.match(config, /TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const boot = manifest.content_scripts?.[0]?.js || [];
const bridgeIndex = boot.indexOf('content/composer-bridge-v3.js');
const guardianIndex = boot.indexOf('content/composer-guardian.js');
const coreIndex = boot.indexOf('content/decrypter-chat-core.js');
const chatIndex = boot.indexOf('content/decrypter-chat.js');
assert.ok(bridgeIndex >= 0 && guardianIndex > bridgeIndex && coreIndex > guardianIndex && chatIndex > coreIndex);

assert.match(entry, /installDecrypterChatRuntime/);
assert.match(background, /ld2-decrypter-chat/);
assert.match(background, /GeminiAgent/);
assert.match(background, /CHAT_WRITE_INTENT_BLOCKED/);
assert.match(background, /writes:\s*false/);
assert.doesNotMatch(background, /atomicCommit|LD2_PLAN_APPLY|LD2_BUILD_EXECUTE/);
assert.match(chatSource, /attachShadow\(\{ mode: 'open' \}\)/);
assert.match(chatSource, /READY/);
assert.match(chatSource, /BUSY/);
assert.match(chatSource, /LOCKED/);
assert.match(chatSource, /DEGRADED/);
assert.match(chatSource, /LD2_PLAN_ONLY/);
assert.match(chatSource, /LD2_PLAN_PREPARE/);
assert.match(chatSource, /Shadow Build/);
assert.match(chatSource, /Fail-closed/);
assert.doesNotMatch(chatSource, /LD2_PLAN_APPLY|LD2_BUILD_EXECUTE/);
assert.doesNotMatch(chatSource, /new\s+MutationObserver/);
assert.doesNotMatch(chatSource, /window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);

const context = { window: {}, crypto: webcrypto, structuredClone, console };
context.window.window = context.window;
vm.runInNewContext(coreSource, context, { filename: 'decrypter-chat-core.js' });
const core = context.window.LovableDecrypterChatCore;
assert.ok(core);
assert.equal(core.historyKey('project-123'), 'ld2_decrypter_chat_history_v1_project-123');
const html = core.renderMarkdown('# Título\n\n**ok**\n\n```js\nconst x = 1 < 2;\n```\n<script>alert(1)</script>');
assert.match(html, /<h1>Título<\/h1>/);
assert.match(html, /class="ldc-code"/);
assert.ok(!html.includes('<script>'));
const history = core.sanitizeHistory([{ role: 'user', content: 'Oi', attachments: [{ name: 'a.png', mimeType: 'image/png', size: 123, data: 'VERY_SECRET_BASE64' }] }]);
assert.equal(Object.prototype.hasOwnProperty.call(history[0].attachments[0], 'data'), false);
assert.equal(JSON.stringify(history).includes('VERY_SECRET_BASE64'), false);
const graph = core.safeProjectState({ schema: 'ld-project-state-graph/1', projectId: 'p1', status: 'drift', files: { entries: [{ path: 'src/App.tsx', state: 'mismatch', reason: 'sha' }] }, secretNames: ['MERCADOPAGO_ACCESS_TOKEN'], secrets: { MERCADOPAGO_ACCESS_TOKEN: 'SUPER_SECRET_VALUE' } });
assert.equal(JSON.stringify(graph).includes('SUPER_SECRET_VALUE'), false);
const diff = core.diffPreview('a\nb\nc', 'a\nB\nc', 'update');
assert.match(diff, /- b/);
assert.match(diff, /\+ B/);

console.log(JSON.stringify({ ok: true, build: 29, compatible_version: manifest.version, trust_protocol: '2.4.21', own_composer: true, shadow_dom: true, fail_closed: true, native_fallback: false, chat_runtime_writes: false, secret_values_exposed: false }, null, 2));
