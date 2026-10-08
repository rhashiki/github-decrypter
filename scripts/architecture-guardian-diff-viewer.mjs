import fs from 'node:fs';
const read = (path) => fs.readFileSync(path, 'utf8');
const policy = JSON.parse(read('architecture.guardian.json'));
const errors = [];
if (policy.currentBuild < 74 || policy.phaseGates?.diffViewerBuild !== 74) errors.push('Build 74 gate missing');
const authority = policy.diffViewerAuthority;
for (const key of ['readOnly','explicitUserSuppliedTextOnly','sourceGrounded','previewMayBeTruncated']) {
  if (authority?.[key] !== true) errors.push('Missing required read-only diff authority: ' + key);
}
for (const key of ['studioRepositoryTransport','studioFilesystemAccess','remoteNetworkAccess','storagePersistence','mutationAuthority','applyPatch','unverifiedRuntimeChanges']) {
  if (authority?.[key] !== false) errors.push('Unapproved Diff Viewer authority: ' + key);
}
for (const [key,value] of Object.entries({maxCharactersPerSide:100000,maxLinesPerSide:800,maxHunks:64})) {
  if (authority?.[key] !== value) errors.push('Diff budget mismatch: '+key);
}
const model=read('apps/studio/src/diff-viewer-model.ts');
const ui=read('apps/studio/src/DiffViewer.tsx');
const app=read('apps/studio/src/App.tsx');
if (!app.includes('<DiffViewer />') || !app.includes("setWorkspaceSurface('diff')")) errors.push('Diff Viewer not mounted');
for (const [label,content] of [['model',model],['ui',ui]]) {
  if (/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\blocalStorage\b|\bindexedDB\b|\bchild_process\b|\bspawn\s*\(/.test(content))
    errors.push('Unapproved network, persistence or process API: ' + label);
  if (/applyPatch\s*\(|writeFile\s*\(|commitChanges\s*\(/.test(content))
    errors.push('Diff Viewer attempting mutation: ' + label);
}
if (!ui.includes('file.text()') || !ui.includes('result.truncated')) errors.push('Missing explicit file read or honest truncation');
if (!model.includes('missingFinalNewline') || !model.includes('DIFF_VIEWER_MAX_HUNKS')) errors.push('Missing data fidelity or bounds');
console.log(JSON.stringify({ok:errors.length===0,schema:'gd-build74-guardian/1',build:74,errors},null,2));
if (errors.length) process.exit(1);
