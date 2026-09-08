import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const guardian = 'scripts/architecture-guardian-conversation-engine.mjs';
const policyPath = 'architecture.guardian.json';
const sourcePath = 'packages/chat/src/index.ts';
const migrationPath = 'apps/local/src/database-migrations.ts';
const serverPath = 'apps/local/src/server.ts';
const originalPolicy = fs.readFileSync(policyPath, 'utf8');
const originalSource = fs.readFileSync(sourcePath, 'utf8');
const originalMigration = fs.readFileSync(migrationPath, 'utf8');
const originalServer = fs.readFileSync(serverPath, 'utf8');

function runGuardian(expectedCode) {
  const result = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted negative probe ${expectedCode}.`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(expectedCode), `Expected ${expectedCode} in Guardian output.`);
}

try {
  const truncationPolicy = JSON.parse(originalPolicy);
  truncationPolicy.conversationEngineAuthority.silentTruncation = true;
  fs.writeFileSync(policyPath, `${JSON.stringify(truncationPolicy, null, 2)}\n`);
  runGuardian('AG423');
  fs.writeFileSync(policyPath, originalPolicy);

  fs.writeFileSync(sourcePath, `${originalSource}\nvoid fetch('https://example.invalid');\n`);
  runGuardian('AG424');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(sourcePath, originalSource.replace('compileConversationDispatch(', 'compileConversationDispatchBroken('));
  runGuardian('AG422');
  fs.writeFileSync(sourcePath, originalSource);

  fs.writeFileSync(migrationPath, originalMigration.replace(
    'CREATE TABLE gd_conversation_messages (',
    'ALTER TABLE gd_conversations ADD COLUMN job_id TEXT REFERENCES gd_jobs(id);\n\nCREATE TABLE gd_conversation_messages (',
  ));
  runGuardian('AG425');
  fs.writeFileSync(migrationPath, originalMigration);

  fs.writeFileSync(serverPath, `${originalServer}\nconst build44PrematureRoute = '/v1/conversations';\n`);
  runGuardian('AG426');
  fs.writeFileSync(serverPath, originalServer);

  const downstreamPolicy = JSON.parse(originalPolicy);
  downstreamPolicy.conversationEngineAuthority.attachmentEngineBuild = 44;
  fs.writeFileSync(policyPath, `${JSON.stringify(downstreamPolicy, null, 2)}\n`);
  runGuardian('AG427');
} finally {
  fs.writeFileSync(policyPath, originalPolicy);
  fs.writeFileSync(sourcePath, originalSource);
  fs.writeFileSync(migrationPath, originalMigration);
  fs.writeFileSync(serverPath, originalServer);
}

const final = spawnSync(process.execPath, [guardian], { encoding: 'utf8' });
assert.equal(final.status, 0, `Guardian did not recover after negative probes:\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build44-conversation-engine-guardian-negative/1',
  probes: ['AG423','AG424','AG422','AG425','AG426','AG427'],
  restored: true,
}, null, 2));
