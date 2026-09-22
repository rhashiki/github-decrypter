import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProjectMemoryEntry } from '../packages/context/src/project-memory.js';
import { LocalDatabase, ProjectMemoryStore, WorkspaceManager } from '../apps/local/src/index.js';

const root=mkdtempSync(join(tmpdir(),'gd-build66-'));
const workspaceRoot=join(root,'workspace');
mkdirSync(workspaceRoot);
const databasePath=join(root,'runtime.sqlite3');

let tick=0;
const now=()=>new Date(Date.UTC(2026,8,22,18,0,tick++)).toISOString();
let idCounter=0;
const idFactory=()=>`pmem:test-${String(++idCounter).padStart(4,'0')}`;

try{
  const database=new LocalDatabase({path:databasePath,now});
  const opened=database.open();
  assert.ok(opened.schemaVersion>=13);

  const workspaces=new WorkspaceManager({database,now});
  await workspaces.initialize();
  const workspace=workspaces.register(workspaceRoot,'Build 66 Test');

  const memory=new ProjectMemoryStore({database,now,idFactory});
  const status=memory.initialize();
  assert.equal(status.ready,true);
  assert.equal(status.durable,true);
  assert.equal(status.authoritative,false);

  const observation=memory.append({
    workspaceId:workspace.id,kind:'observation',
    statement:'The repository uses a local-first AI runtime.',
    sourceRefs:['file:architecture.guardian.json'],createdBy:'ramon',
  });
  const finding=memory.append({
    workspaceId:workspace.id,kind:'finding',
    statement:'Context retrieval should remain bounded.',
    sourceRefs:['build:65'],createdBy:'weizenbaum',
  });
  const coverage=memory.append({
    workspaceId:workspace.id,kind:'coverage',
    statement:'Knowledge Graph bounded retrieval was exercised.',
    sourceRefs:['test:build65-runtime'],createdBy:'samuel',coverageStatus:'tested',
  });
  const question=memory.append({
    workspaceId:workspace.id,kind:'unresolved-question',
    statement:'Which document parsers will Build 67 enable first?',
    sourceRefs:['roadmap:67'],createdBy:'ramon',
  });
  const fact=memory.append({
    workspaceId:workspace.id,kind:'project-fact',
    statement:'Vortex-managed paid inference is forbidden for core operation.',
    sourceRefs:['constitution:amendment-006'],createdBy:'ramon',
  });
  const decision=memory.append({
    workspaceId:workspace.id,kind:'decision',
    statement:'Project Memory remains non-authoritative operational state.',
    sourceRefs:['build:66'],
    decisionProvenanceRefs:['owner-decision:build66-scope','architecture:project-memory'],
    createdBy:'ramon',
  });
  const pack=memory.append({
    workspaceId:workspace.id,kind:'knowledge-pack',
    statement:'Build 65 graph references compiled for later Context Engine consumption.',
    sourceRefs:['knowledge-pack:build65-core'],createdBy:'ramon',
  });

  for(const entry of [observation,finding,coverage,question,fact,decision,pack]){
    assert.equal(entry.workspaceId,workspace.id);
    assert.equal(entry.authoritative,false);
    assert.equal(entry.architectureLedgerAuthority,false);
    assert.equal(entry.productContractAuthority,false);
    assert.equal(entry.gitAuthority,false);
    assert.equal(entry.validationAuthority,false);
    assert.equal(entry.localFirst,true);
  }
  assert.equal(coverage.coverageStatus,'tested');
  assert.equal(decision.decisionProvenanceRefs.length,2);

  assert.throws(()=>normalizeProjectMemoryEntry({
    id:'pmem:bad-decision',workspaceId:workspace.id,kind:'decision',
    statement:'Missing provenance.',sourceRefs:['test:missing-provenance'],
    createdBy:'ramon',createdAt:now(),
  }),/require explicit decision provenance/i);

  assert.throws(()=>normalizeProjectMemoryEntry({
    id:'pmem:bad-coverage',workspaceId:workspace.id,kind:'coverage',
    statement:'Missing coverage state.',sourceRefs:['test:missing-coverage'],
    createdBy:'samuel',createdAt:now(),
  }),/require tested or untested/i);

  const resolvedQuestion=memory.append({
    workspaceId:workspace.id,kind:'unresolved-question',
    statement:'Build 67 parser selection was resolved externally.',
    sourceRefs:['roadmap:67','decision:parser-selection'],createdBy:'ramon',
    supersedesId:question.id,lifecycle:'closed',
  });
  assert.equal(resolvedQuestion.lifecycle,'closed');

  const active=memory.list({workspaceId:workspace.id,limit:100});
  assert.equal(active.length,7);
  assert.ok(!active.some((entry)=>entry.id===question.id));
  assert.ok(active.some((entry)=>entry.id===resolvedQuestion.id));

  const history=memory.list({workspaceId:workspace.id,includeSuperseded:true,limit:100});
  assert.equal(history.length,8);
  assert.ok(history.some((entry)=>entry.id===question.id));

  const tested=memory.list({workspaceId:workspace.id,kinds:['coverage'],limit:10});
  assert.equal(tested.length,1);
  assert.equal(tested[0]?.coverageStatus,'tested');

  memory.shutdown();
  database.close();

  const reopened=new LocalDatabase({path:databasePath,now});
  reopened.open();
  const reopenedMemory=new ProjectMemoryStore({database:reopened,now,idFactory});
  const reopenedStatus=reopenedMemory.initialize();
  assert.equal(reopenedStatus.entryCount,8);
  assert.equal(reopenedStatus.activeEntryCount,7);
  assert.equal(reopenedMemory.list({workspaceId:workspace.id,includeSuperseded:true,limit:100}).length,8);

  const otherRoot=join(root,'workspace-other');
  mkdirSync(otherRoot);
  const reopenedWorkspaces=new WorkspaceManager({database:reopened,now});
  await reopenedWorkspaces.initialize();
  const other=reopenedWorkspaces.register(otherRoot,'Other');
  assert.throws(()=>reopenedMemory.append({
    workspaceId:other.id,kind:'unresolved-question',
    statement:'Cross-workspace supersession attempt.',
    sourceRefs:['test:cross-workspace'],createdBy:'ramon',
    supersedesId:resolvedQuestion.id,
  }),/another workspace/i);

  reopenedMemory.shutdown();
  reopened.close();

  console.log(JSON.stringify({
    ok:true,schema:'gd-build66-project-memory-runtime/1',build:66,
    persistedAcrossReopen:true,entries:8,activeEntries:7,
    crossWorkspaceIsolation:true,decisionProvenanceRequired:true,
    coverageStateRequired:true,authoritative:false,
  },null,2));
}finally{
  rmSync(root,{recursive:true,force:true});
}
