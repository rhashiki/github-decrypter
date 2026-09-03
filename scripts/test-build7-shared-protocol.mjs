import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const protocolDir = path.join(root, 'packages/protocol');
const srcDir = path.join(protocolDir, 'src');

const requiredFiles = [
  'json.ts',
  'version.ts',
  'ids.ts',
  'peer.ts',
  'errors.ts',
  'envelope.ts',
  'messages.ts',
  'handshake.ts',
  'guards.ts',
  'index.ts',
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(srcDir, file)), `missing protocol file: ${file}`);
}

const protocolPackage = JSON.parse(fs.readFileSync(path.join(protocolDir, 'package.json'), 'utf8'));
assert.equal(protocolPackage.name, '@github-decrypter/protocol');
assert.equal(protocolPackage.version, '0.0.7');
assert.equal(protocolPackage.sideEffects, false);
assert.equal(protocolPackage.exports, './src/index.ts');
assert.equal(protocolPackage.dependencies, undefined, 'shared protocol must remain dependency-free');
assert.equal(protocolPackage.devDependencies, undefined, 'shared protocol must remain dependency-free');

const source = requiredFiles
  .map((file) => fs.readFileSync(path.join(srcDir, file), 'utf8'))
  .join('\n');

for (const forbidden of [
  /\bchrome\./,
  /\bwindow\./,
  /\bdocument\./,
  /\bprocess\./,
  /from ['"]node:/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /\bfetch\s*\(/,
  /https?:\/\//,
]) {
  assert.ok(!forbidden.test(source), `protocol contains environment-specific authority: ${forbidden}`);
}

for (const expected of [
  "'gd-protocol/1'",
  "'studio'",
  "'extension'",
  "'local-runtime'",
  "'handshake.hello'",
  "'request'",
  "'response'",
  "'event'",
  'selectProtocolVersion',
  'isProtocolEnvelope',
]) {
  assert.ok(source.includes(expected), `protocol contract missing: ${expected}`);
}

for (const app of ['studio', 'extension', 'local']) {
  const appDir = path.join(root, 'apps', app);
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  assert.equal(
    pkg.dependencies?.['@github-decrypter/protocol'],
    'workspace:*',
    `${app} must consume the canonical shared protocol`,
  );

  const appSource = fs.readFileSync(path.join(appDir, 'src/index.ts'), 'utf8');
  assert.ok(appSource.includes("from '@github-decrypter/protocol'"), `${app} must import the shared protocol`);
  assert.ok(!/gd-protocol\/\d/.test(appSource), `${app} must not duplicate the protocol schema literal`);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'github-decrypter-build7-shared-protocol/1',
  protocol: 'gd-protocol/1',
  appsBound: ['studio', 'extension', 'local'],
  environmentNeutral: true,
}, null, 2));
