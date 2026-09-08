import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const guardian = 'scripts/architecture-guardian-context-mentions.mjs';
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

probe(
  'architecture.guardian.json',
  (source) => source.replace('"explicitCatalogOnly": true', '"explicitCatalogOnly": false'),
  'AG445',
);
probe(
  'packages/chat/src/mentions.ts',
  (source) => `${source}\nvoid fetch;\n`,
  'AG444',
);
probe(
  'architecture.guardian.json',
  (source) => source.replace('"contentMaterialization": false', '"contentMaterialization": true'),
  'AG446',
);
probe(
  'architecture.guardian.json',
  (source) => source.replace('"jobsCenterBuild": 47', '"jobsCenterBuild": 46'),
  'AG447',
);
probe(
  'packages/chat/src/mentions.ts',
  (source) => source.replace('CONTEXT_MENTION_MAX_ITEMS = 64', 'CONTEXT_MENTION_MAX_ITEMS = 63'),
  'AG442',
);

const restored = runGuardian();
assert.equal(restored.status, 0, `${restored.stdout}\n${restored.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build46-context-mentions-guardian-negative/1',
  rejected: ['AG445', 'AG444', 'AG446', 'AG447', 'AG442'],
  restoredTreePasses: true,
}, null, 2));
