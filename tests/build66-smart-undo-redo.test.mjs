import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  REVERSIBLE_OPERATIONS_SCHEMA,
  deriveThreeWayHunk,
  applyThreeWayHunk,
  planFileReversal,
  buildReversalPlan,
  reversibleFingerprint
} from '../core/reversible-operations.js';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const entry = read('background/service-worker-entry.js');
const runtime = read('background/reversible-operations-runtime.js');
const core = read('core/reversible-operations.js');
const journal = read('core/operation-journal.js');
const client = read('content/reversible-operations-client.js');
const ui = read('ui/reversible-operations-v66.js');
const css = read('ui/reversible-operations-v66.css');

assert.equal(manifest.version, '2.6.66');
assert.match(manifest.version_name, /Build 66 · Smart Undo\/Redo \+ Reversible Operations/);
assert.equal(pkg.candidate, manifest.version);
assert.ok(settings.includes("VERSION = '2.6.66'"));
assert.ok(settings.includes("REVERSIBLE_OPERATIONS_SCHEMA = 'ld-reversible-operation/1'"));
assert.equal(REVERSIBLE_OPERATIONS_SCHEMA, 'ld-reversible-operation/1');

assert.ok(entry.includes("import { installReversibleOperationsRuntime } from './reversible-operations-runtime.js';"));
assert.ok(entry.includes('installReversibleOperationsRuntime();'));
const scripts = manifest.content_scripts[1].js;
const styles = manifest.content_scripts[1].css;
assert.ok(scripts.includes('content/reversible-operations-client.js'));
assert.ok(scripts.includes('ui/reversible-operations-v66.js'));
assert.ok(scripts.indexOf('content/reversible-operations-client.js') < scripts.indexOf('ui/reversible-operations-v66.js'));
assert.ok(styles.includes('ui/reversible-operations-v66.css'));

for (const token of [
  "PORT_NAME = 'ld2-reversible-operations'",
  "defaultStrategy: 'preserve'",
  'threeWayMerge: true',
  'approvedAgentCommitsSupported: true',
  'conflictingManualChangesSilentlyDiscarded: false',
  "destructiveStrategies: ['replace-target', 'cascade']",
  "cascadeMeaning: 'restore-entire-branch-tree-to-before-target-operation'",
  "nonTextPolicy: 'cascade-only'",
  'oneShotHumanConfirmation: true',
  'headLock: true',
  'REVERSAL_HUMAN_CONFIRMATION_REQUIRED',
  'REVERSAL_DESTRUCTIVE_CONFIRMATION_REQUIRED',
  'REVERSAL_PREVIEW_STALE',
  'REVERSAL_HEAD_CHANGED',
  'REVERSAL_NON_TEXT_USE_CASCADE',
  'approvalHistoryOperations',
  "tool: 'agent.approved_commit'",
  "chrome.storage.session.set",
  "used: true",
  'reversibleFingerprint'
]) assert.ok(runtime.includes(token), token);

for (const token of [
  'deriveThreeWayHunk',
  'applyThreeWayHunk',
  'REVERSAL_HUNK_AMBIGUOUS',
  'REVERSAL_HUNK_CONFLICT',
  'REVERSAL_HUMAN_EDIT_NOT_REFLECTED_IN_GIT',
  'REVERSAL_DELETE_WOULD_DISCARD_HUMAN_EDIT',
  "strategy === 'replace-target'",
  'humanIntentPreservedByDefault',
  'conflictingManualChangesSilentlyDiscarded: false'
]) assert.ok(core.includes(token), token);

assert.ok(journal.includes('getOperationJournalEntry'));
assert.ok(journal.includes('afterBlobSha'));
assert.ok(journal.includes('reversalOf'));
assert.ok(journal.includes('previewId'));
assert.ok(journal.includes('Never persist file contents, prompts, replacement text, secrets or tokens.'));
assert.ok(!journal.includes('input.content'));
assert.ok(!journal.includes('input.replacement'));

for (const token of ['status()', 'list(projectId', 'preview(operationId', 'apply(previewId', 'humanDecision: true', 'confirmDestructive']) assert.ok(client.includes(token), token);
for (const token of [
  'Smart Undo / Redo',
  'Desfazer preservando alterações posteriores',
  'Refazer preservando alterações posteriores',
  'Desfazer e substituir arquivos-alvo',
  'Desfazer a operação e tudo que veio depois',
  'window.confirm',
  'Preview bloqueado',
  'Alterações manuais conflitantes não são descartadas silenciosamente'
]) assert.ok(ui.includes(token), token);
assert.ok(css.includes('@media(max-width:760px)'));
assert.ok(css.includes('font-family:Arial'));

const base = "const width = 360;\nconst theme = 'dark';\n";
const applied = "const width = 420;\nconst theme = 'dark';\n";
const currentWithManualOutside = "const width = 420;\nconst theme = 'light';\n";
const human = [{ id:'u1', origin:'user', observedAt:'2026-08-30T20:00:00Z', paths:['src/App.tsx'], evidence:['recent-code-editor-input'] }];

const hunk = deriveThreeWayHunk(applied, base);
const merged = applyThreeWayHunk(currentWithManualOutside, hunk);
assert.equal(merged.ok, true);
assert.equal(merged.content, "const width = 360;\nconst theme = 'light';\n");

const undoPreserve = await planFileReversal({
  path:'src/App.tsx',
  base:{exists:true,content:base,blobSha:'base'},
  applied:{exists:true,content:applied,blobSha:'applied'},
  current:{exists:true,content:currentWithManualOutside,blobSha:'current'}
}, { direction:'undo', strategy:'preserve', laterHumanEdits:human });
assert.equal(undoPreserve.status, 'ready');
assert.equal(undoPreserve.action, 'update');
assert.equal(undoPreserve.proposedContent, "const width = 360;\nconst theme = 'light';\n");
assert.equal(undoPreserve.laterHumanEdits.length, 1);
assert.equal(undoPreserve.destructive, false);

const overlapConflict = await planFileReversal({
  path:'src/App.tsx',
  base:{exists:true,content:base,blobSha:'base'},
  applied:{exists:true,content:applied,blobSha:'applied'},
  current:{exists:true,content:"const width = 500;\nconst theme = 'dark';\n",blobSha:'manual'}
}, { direction:'undo', strategy:'preserve', laterHumanEdits:human });
assert.equal(overlapConflict.status, 'conflict');
assert.ok(['REVERSAL_HUNK_CONFLICT','REVERSAL_HUNK_AMBIGUOUS'].includes(overlapConflict.conflict.code));

const unsyncedHuman = await planFileReversal({
  path:'src/App.tsx',
  base:{exists:true,content:base,blobSha:'base'},
  applied:{exists:true,content:applied,blobSha:'applied'},
  current:{exists:true,content:applied,blobSha:'applied'}
}, { direction:'undo', strategy:'preserve', laterHumanEdits:human });
assert.equal(unsyncedHuman.status, 'conflict');
assert.equal(unsyncedHuman.conflict.code, 'REVERSAL_HUMAN_EDIT_NOT_REFLECTED_IN_GIT');

const redoPreserve = await planFileReversal({
  path:'src/App.tsx',
  base:{exists:true,content:base,blobSha:'base'},
  applied:{exists:true,content:applied,blobSha:'applied'},
  current:{exists:true,content:"const width = 360;\nconst theme = 'light';\n",blobSha:'undo'}
}, { direction:'redo', strategy:'preserve', laterHumanEdits:[] });
assert.equal(redoPreserve.status, 'ready');
assert.equal(redoPreserve.proposedContent, "const width = 420;\nconst theme = 'light';\n");

const createdThenEdited = await planFileReversal({
  path:'src/new.ts',
  base:{exists:false,content:'',blobSha:''},
  applied:{exists:true,content:'export const n=1;\n',blobSha:'created'},
  current:{exists:true,content:'export const n=2;\n',blobSha:'manual'}
}, { direction:'undo', strategy:'preserve', laterHumanEdits:[{...human[0],paths:['src/new.ts']}] });
assert.equal(createdThenEdited.status, 'conflict');
assert.equal(createdThenEdited.conflict.code, 'REVERSAL_DELETE_WOULD_DISCARD_HUMAN_EDIT');

const undoDelete = await planFileReversal({
  path:'src/old.ts',
  base:{exists:true,content:'export const old=true;\n',blobSha:'old'},
  applied:{exists:false,content:'',blobSha:''},
  current:{exists:false,content:'',blobSha:''}
}, { direction:'undo', strategy:'preserve', laterHumanEdits:[] });
assert.equal(undoDelete.status, 'ready');
assert.equal(undoDelete.action, 'create');
assert.equal(undoDelete.proposedContent, 'export const old=true;\n');

const destructive = await planFileReversal({
  path:'src/App.tsx',
  base:{exists:true,content:base,blobSha:'base'},
  applied:{exists:true,content:applied,blobSha:'applied'},
  current:{exists:true,content:"const width = 500;\nconst theme = 'light';\n",blobSha:'manual'}
}, { direction:'undo', strategy:'replace-target', laterHumanEdits:human });
assert.equal(destructive.status, 'ready');
assert.equal(destructive.destructive, true);
assert.equal(destructive.proposedContent, base);

const plan = await buildReversalPlan({
  operation:{id:'op1',result:{commitSha:'abc'}},
  frames:[{path:'src/App.tsx',base:{exists:true,content:base,blobSha:'base'},applied:{exists:true,content:applied,blobSha:'applied'},current:{exists:true,content:currentWithManualOutside,blobSha:'current'}}],
  direction:'undo', strategy:'preserve', laterHumanEdits:human,
  dependentOperations:[{id:'later',tool:'repo.patch_apply',origin:'ai',finishedAt:'2026-08-30T21:00:00Z',paths:['src/App.tsx']}]
});
assert.equal(plan.allowed, true);
assert.equal(plan.humanIntentPreservedByDefault, true);
assert.equal(plan.conflictingManualChangesSilentlyDiscarded, false);
assert.equal(plan.dependentOperations.length, 1);

const fp1 = JSON.stringify(reversibleFingerprint(plan));
const fp2 = JSON.stringify(reversibleFingerprint(plan));
assert.equal(fp1, fp2);
assert.ok(!fp1.includes('proposedContent'));
assert.ok(!fp1.includes('preview'));

assert.match(pkg.notes, /Build66/);
assert.match(pkg.notes, /three-way/i);
assert.match(pkg.notes, /USER_EDIT > AI_EDIT/);
assert.match(pkg.notes, /MCP 2026-07-28 Trust Gateway/);
assert.match(pkg.notes, /No OTA metadata, GitHub Release or store publication is authorized/);
assert.ok(pkg.forbidden_roots.includes('runtime'));
assert.ok(!JSON.stringify(manifest).includes('runtime/decrypter-local'));

console.log('Build66 Smart Undo/Redo + Reversible Operations contract OK');
