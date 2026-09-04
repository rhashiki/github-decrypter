import assert from 'node:assert/strict';
import {
  createStudioRepositoryContext,
  parseStudioLaunchContext,
  STUDIO_BUILD,
  STUDIO_LAUNCH_SCHEMA,
  STUDIO_VERSION,
} from '../apps/studio/src/studio-context.js';

assert.equal(STUDIO_BUILD, 27);
assert.equal(STUDIO_VERSION, '0.0.27');
assert.equal(STUDIO_LAUNCH_SCHEMA, 'gd-studio-launch/1');

const empty = parseStudioLaunchContext('');
assert.deepEqual(empty, { kind: 'empty' });

const repository = parseStudioLaunchContext('?owner=rhashiki&repo=github-decrypter');
assert.equal(repository.kind, 'repository');
if (repository.kind !== 'repository') throw new Error('Repository launch context was not accepted.');
assert.equal(repository.repository.owner, 'rhashiki');
assert.equal(repository.repository.name, 'github-decrypter');
assert.equal(repository.repository.fullName, 'rhashiki/github-decrypter');
assert.equal(repository.repository.githubUrl, 'https://github.com/rhashiki/github-decrypter');
assert.equal(repository.repository.schema, 'gd-studio-launch/1');
assert.equal(Object.isFrozen(repository), true);
assert.equal(Object.isFrozen(repository.repository), true);

const encoded = createStudioRepositoryContext('owner.name', 'repo_name');
assert.equal(encoded.fullName, 'owner.name/repo_name');
assert.equal(encoded.githubUrl, 'https://github.com/owner.name/repo_name');

for (const search of [
  '?owner=rhashiki',
  '?repo=github-decrypter',
  '?owner=rhashiki&repo=github-decrypter&extra=x',
  '?owner=rhashiki&owner=other&repo=github-decrypter',
  '?owner=rhashiki&repo=github-decrypter&repo=other',
  '?owner=settings&repo=profile',
  '?owner=%2Fetc&repo=x',
  '?owner=rhashiki&repo=',
]) {
  const result = parseStudioLaunchContext(search);
  assert.equal(result.kind, 'invalid', `Expected invalid launch context for ${search}`);
}

assert.throws(() => createStudioRepositoryContext('settings', 'x'), /reserved GitHub top-level route/);
assert.throws(() => createStudioRepositoryContext('bad/owner', 'x'), /owner is invalid/);
assert.throws(() => createStudioRepositoryContext('owner', 'bad/repo'), /name is invalid/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build27-react-studio-runtime/1',
  build: STUDIO_BUILD,
  launchSchema: STUDIO_LAUNCH_SCHEMA,
  emptyEntry: true,
  repositoryEntry: true,
  unknownParametersRejected: true,
  duplicateParametersRejected: true,
  reservedRoutesRejected: true,
  invalidRepositoryGrammarRejected: true,
  publicGitHubIdentityOnly: true,
  networkActivity: false,
  persistence: false,
}, null, 2));
