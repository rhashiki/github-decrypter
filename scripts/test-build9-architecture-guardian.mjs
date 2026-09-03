import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));

for (const file of [
  'architecture.guardian.json',
  'scripts/architecture-guardian.mjs',
  'scripts/test-build9-guardian-negative.mjs',
  'docs/architecture/ARCHITECTURE_GUARDIAN.md',
  'docs/builds/BUILD_9_ARCHITECTURE_GUARDIAN.md',
  'docs/product/NORTH_STAR_MANIFESTO.md',
  'docs/product/ROADMAP_V1.md',
  'docs/product/NORTH_STAR_ROADMAP_MAPPING.md',
  'docs/product/CONSTITUTION_AMENDMENT_001_NORTH_STAR.md',
  '.github/pull_request_template.md',
]) {
  assert.ok(fs.existsSync(file), `Build 9 artifact missing: ${file}`);
}

const policy = json('architecture.guardian.json');
assert.equal(policy.schema, 'gd-architecture-guardian/1');
assert.equal(policy.currentBuild, 9);
assert.equal(policy.product, 'GitHub Decrypter');
assert.equal(policy.northStar.sourceSha256, '256c9677407ef3cc5608d62908fb39fbe24e618b799192ab89f315033b90c718');
assert.equal(policy.northStar.requiredPrinciples.length, 22);
assert.equal(policy.northStar.requiredRoadmapBlocks.length, 11);
assert.equal(policy.workflow.writePermissionAllowlist.length, 0);
assert.equal(policy.phaseGates.localDaemonBuild, 10);
assert.equal(policy.phaseGates.extensionActivationBuild, 25);
assert.equal(policy.phaseGates.studioReactBuild, 27);
assert.equal(policy.phaseGates.releaseAuthorityBuild, 134);
assert.ok(policy.authorities.includes('docs/product/ROADMAP_V1.md'));

const northStar = read('docs/product/NORTH_STAR_MANIFESTO.md');
for (let index = 1; index <= 22; index += 1) {
  const id = `P${String(index).padStart(2, '0')}`;
  assert.ok(northStar.includes(`**${id}**`), `missing North Star principle: ${id}`);
}

const mapping = read('docs/product/NORTH_STAR_ROADMAP_MAPPING.md');
for (const block of policy.northStar.requiredRoadmapBlocks) {
  assert.ok(mapping.includes(block), `roadmap block missing: ${block}`);
}
assert.ok(mapping.includes('1 → 134'));

const roadmap = read('docs/product/ROADMAP_V1.md');
const roadmapNumbers = [...roadmap.matchAll(/^(\d+)\. \*\*/gm)].map((match) => Number(match[1]));
assert.equal(roadmapNumbers.length, 134, 'canonical roadmap must list exactly 134 numbered Builds');
assert.deepEqual(roadmapNumbers, Array.from({ length: 134 }, (_, index) => index + 1), 'canonical roadmap numbering must be contiguous 1–134');
for (const block of policy.northStar.requiredRoadmapBlocks) {
  assert.ok(roadmap.includes(block), `canonical roadmap does not carry North Star ownership: ${block}`);
}

const guardian = read('scripts/architecture-guardian.mjs');
for (const marker of [
  'AG010',
  'AG031',
  'AG040',
  'AG050',
  'AG060',
  'AG070',
  'AG080',
  'AG082',
  'gd-architecture-guardian-report/1',
]) {
  assert.ok(guardian.includes(marker), `Guardian enforcement marker missing: ${marker}`);
}

const template = read('.github/pull_request_template.md');
assert.ok(template.includes('North Star review'));
assert.ok(template.includes('Does it make it easier to transform intention into software?'));
assert.ok(template.includes('Adaptive profile data does not grant security authority'));

const build = read('docs/builds/BUILD_9_ARCHITECTURE_GUARDIAN.md');
assert.ok(build.includes('Build 10'));
assert.ok(build.includes('No Release'));

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build9-architecture-guardian/1',
  currentBuild: 9,
  principles: 22,
  canonicalRoadmapBuilds: roadmapNumbers.length,
  northStarRoadmapBlocks: 11,
  phaseGates: policy.phaseGates,
  workflowWriteAllowlist: policy.workflow.writePermissionAllowlist,
}, null, 2));
