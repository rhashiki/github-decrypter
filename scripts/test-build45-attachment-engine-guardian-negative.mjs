import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const guardian = 'scripts/architecture-guardian-attachment-engine.mjs';
const runGuardian = () => spawnSync(process.execPath, [guardian], { encoding: 'utf8' });

function probe(path, mutate, expectedCode) {
  const original = fs.readFileSync(path, 'utf8');
  try {
    const changed = mutate(original);
    assert.notEqual(changed, original, `negative probe did not mutate ${path}`);
    fs.writeFileSync(path, changed, 'utf8');
    const result = runGuardian();
    assert.notEqual(result.status, 0, `${expectedCode} negative probe unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expectedCode));
  } finally {
    fs.writeFileSync(path, original, 'utf8');
  }
}

function mutatePolicy(source, mutate) {
  const policy = JSON.parse(source);
  mutate(policy);
  return `${JSON.stringify(policy, null, 2)}\n`;
}

probe(
  'architecture.guardian.json',
  (source) => mutatePolicy(source, (policy) => {
    policy.attachmentEngineAuthority.voiceTransport = true;
  }),
  'AG437',
);
probe(
  'packages/chat/src/attachments.ts',
  (source) => `${source}\nvoid fetch;\n`,
  'AG434',
);
probe(
  'apps/local/src/attachment-store.ts',
  (source) => source.replace('LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION = 256', 'LOCAL_ATTACHMENT_STORE_MAX_ITEMS_PER_CONVERSATION = 255'),
  'AG435',
);
probe(
  'apps/local/src/attachment-store.ts',
  (source) => `${source}\nconst forbiddenBuild45JobTableProbe = 'gd_jobs';\nvoid forbiddenBuild45JobTableProbe;\n`,
  'AG436',
);
probe(
  'architecture.guardian.json',
  (source) => mutatePolicy(source, (policy) => {
    policy.attachmentEngineAuthority.contextMentionsBuild = 45;
  }),
  'AG437',
);

const restored = runGuardian();
assert.equal(restored.status, 0, `${restored.stdout}\n${restored.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build45-attachment-engine-guardian-negative/1',
  rejected: ['AG437', 'AG434', 'AG435', 'AG436', 'AG437'],
  restoredTreePasses: true,
}, null, 2));
