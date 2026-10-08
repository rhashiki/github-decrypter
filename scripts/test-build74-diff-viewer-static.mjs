import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
const architecture = JSON.parse(read('architecture.guardian.json'));
const root = JSON.parse(read('package.json'));
const studio = JSON.parse(read('apps/studio/package.json'));
assert.equal(architecture.currentBuild, 74);
assert.equal(architecture.phaseGates.diffViewerBuild, 74);
assert.equal(root.version, '0.0.74');
assert.equal(studio.version, '0.0.64'); // Stable Studio shell identity; Build 74 is an additional surface.
assert.equal(architecture.diffViewerAuthority.readOnly, true);
assert.equal(architecture.diffViewerAuthority.explicitUserSuppliedTextOnly, true);
for (const key of [
  'studioRepositoryTransport','studioFilesystemAccess','remoteNetworkAccess',
  'storagePersistence','mutationAuthority','applyPatch','unverifiedRuntimeChanges',
]) assert.equal(architecture.diffViewerAuthority[key], false, key + ' gained authority');
assert.equal(architecture.diffViewerAuthority.maxCharactersPerSide, 100000);
assert.equal(architecture.diffViewerAuthority.maxLinesPerSide, 800);
assert.equal(architecture.diffViewerAuthority.maxHunks, 64);
assert.ok(!existsSync('.github/workflows'), 'No hosted workflow directory is permitted');
for (const file of [
  'apps/studio/src/diff-viewer-model.ts',
  'apps/studio/src/DiffViewer.tsx',
  'apps/studio/src/diff-viewer.css',
  'scripts/test-build74-diff-viewer.ts',
  'docs/builds/BUILD_74_DIFF_VIEWER.md',
]) assert.ok(existsSync(file), 'Missing ' + file);
const model=read('apps/studio/src/diff-viewer-model.ts');
const ui=read('apps/studio/src/DiffViewer.tsx');
const app=read('apps/studio/src/App.tsx');
const main=read('apps/studio/src/main.tsx');
assert.ok(root.scripts.guardian.includes('architecture-guardian-diff-viewer.mjs'));
assert.ok(root.scripts.ci.includes('check:build74'));
assert.ok(root.scripts['check:build74'].includes('test-build74-diff-viewer.ts'));
assert.ok(main.includes("import './diff-viewer.css'"));
assert.ok(app.includes('<DiffViewer />'));
assert.ok(app.includes("setWorkspaceSurface('diff')"));
for (const token of ['compareExplicitTexts','unifiedDiffPreview','readonly','DIFF_VIEWER_MAX_LINES','DIFF_VIEWER_MAX_HUNKS']) {
 assert.ok(model.includes(token), 'Missing diff engine contract ' + token);
}
for (const token of ['file.text()','READ ONLY','Compare texts','Swap sides','Unified changes','result.truncated']) {
 assert.ok(ui.includes(token), 'Missing UI behavior ' + token);
}
assert.ok(!/\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(|\blocalStorage\b|\bindexedDB\b|\bchild_process\b|\bspawn\s*\(/.test(model+ui), 'Diff viewer must not gain network/process/persistence authority');
assert.ok(!/applyPatch|writeFile|commitChanges/.test(model+ui), 'Diff viewer must not apply patches or commits');
console.log(JSON.stringify({ok:true,build:74,staticGuards:true}));
