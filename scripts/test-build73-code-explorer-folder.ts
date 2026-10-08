import assert from 'node:assert/strict';
import { readExplicitlySelectedFolder, safeSelectedFolderPath } from '../apps/studio/src/code-explorer-folder.js';

function file(relative:string, source:string, reportedSize=source.length) {
  return {name:relative.split('/').at(-1)!,webkitRelativePath:relative,size:reportedSize,text:async()=>source};
}
assert.equal(safeSelectedFolderPath('project/src/main.ts'),'src/main.ts');
assert.equal(safeSelectedFolderPath('project/src/components/Button.tsx'),'src/components/Button.tsx');
assert.equal(safeSelectedFolderPath('project/.git/hooks/post-commit.js'),null);
assert.equal(safeSelectedFolderPath('project/node_modules/typescript/index.js'),null);
assert.equal(safeSelectedFolderPath('project/src/.env.ts'),null);
assert.equal(safeSelectedFolderPath('project/src/secrets/key.ts'),null);
assert.equal(safeSelectedFolderPath('project/src/../escape.ts'),null);
assert.equal(safeSelectedFolderPath('project/src\\escape.ts'),null);
assert.equal(safeSelectedFolderPath('project/src/logo.png'),null);
assert.equal(safeSelectedFolderPath('/project/main.ts'),null);
assert.equal(safeSelectedFolderPath('project/secret.pem'),null);
let secretReads=0;
const selection = await readExplicitlySelectedFolder([
  file('repo/src/main.ts',"import { answer } from './helper';\nanswer();"),
  file('repo/src/helper.ts','export const answer = () => 42;'),
  {name:'secret.ts',webkitRelativePath:'repo/.git/secret.ts',size:4,text:async()=>{secretReads++;return 'data';}},
]);
assert.deepEqual(selection.files.map(x=>x.path),['src/helper.ts','src/main.ts']);
assert.equal(selection.eligibleCount,2);
assert.equal(selection.skippedCount,0);
assert.equal(selection.networkAccess,false);
assert.equal(selection.serverFilesystemAccess,false);
assert.equal(selection.persistentStorage,false);
assert.equal(selection.explicitUserSelectionRequired,true);
assert.equal(secretReads,0);
await assert.rejects(()=>readExplicitlySelectedFolder([file('repo/src/big.ts','abc',400001)]),/byte limit/);
await assert.rejects(()=>readExplicitlySelectedFolder([
  file('repo/src/main.ts','a'),file('other/src/more.ts','b'),
]),/one explicitly selected folder/);
await assert.rejects(()=>readExplicitlySelectedFolder([
  file('repo/src/main.ts','a'),file('other/.git/hidden.ts','b'),
]),/one explicitly selected folder/);
await assert.rejects(()=>readExplicitlySelectedFolder([
  ...Array.from({length:64},(_,i)=>file('repo/src/file-'+i+'.ts','ok')),
  file('repo/src/file-0.ts','duplicate'),
]),/Duplicate/);
await assert.rejects(()=>readExplicitlySelectedFolder([
  file('repo/src/main.ts','a'),file('repo/src/main.ts','b'),
]),/Duplicate/);
await assert.rejects(()=>readExplicitlySelectedFolder([file('repo/.git/config.js','abc')]),/no eligible/);
const many = await readExplicitlySelectedFolder(Array.from({length:70},(_,i)=>file(
  'repo/src/file-'+String(i).padStart(3,'0')+'.ts','export const x = 1;')));
assert.equal(many.files.length,64);
assert.equal(many.skippedCount,6);
assert.equal(many.files[0]?.path,'src/file-000.ts');
assert.equal(many.files.at(-1)?.path,'src/file-063.ts');
console.log(JSON.stringify({ok:true,build:73,folderSelection:true,filteredSecrets:true,cappedFiles:64,skipped:many.skippedCount}));
