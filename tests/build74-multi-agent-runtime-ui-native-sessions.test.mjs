import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createNativeAgentSession,bindNativeProposal,verifyNativeResume,verifyProposalBinding,switchNativeRuntime,markNativeSessionVerified,closeNativeSession,runtimeSelectionRecord,NATIVE_AGENT_SESSION_SCHEMA,RUNTIME_SELECTION_SCHEMA,NATIVE_AGENT_STRATEGIES} from '../core/native-agent-sessions.js';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const pkg=JSON.parse(read('release/runtime-package.json'));
const settings=read('settings/config.js');
const core=read('core/native-agent-sessions.js');
const runtime=read('background/native-agent-session-runtime.js');
const client=read('content/native-agent-session-client.js');
const ui=read('ui/multi-agent-runtime-v74.js');
const css=read('ui/multi-agent-runtime-v74.css');
const entry=read('background/service-worker-entry.js');
const roadmap=read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');
assert.equal(manifest.version,'2.6.74');
assert.match(manifest.version_name,/Build 74 · Multi-Agent Runtime UI \+ Native Sessions/);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settings.includes("VERSION = '2.6.74'"));
assert.ok(settings.includes("NATIVE_AGENT_SESSION_SCHEMA = 'ld-native-agent-session/1'"));
assert.ok(settings.includes("RUNTIME_SELECTION_SCHEMA = 'ld-runtime-selection/1'"));
assert.equal(NATIVE_AGENT_SESSION_SCHEMA,'ld-native-agent-session/1');
assert.equal(RUNTIME_SELECTION_SCHEMA,'ld-runtime-selection/1');
assert.deepEqual(NATIVE_AGENT_STRATEGIES,['none','cli-resume','stream-capture','acp-session-load','remote-conversation']);

const digest='a'.repeat(64);
let session=createNativeAgentSession({taskId:'task-1',runtimeId:'codex-cli',strategy:'cli-resume',nativeSessionId:'codex-session-1'});
assert.equal(session.generation,1);
assert.equal(session.writeAuthority,false);
assert.equal(session.replayAuthority,false);
assert.equal(session.authority.nativeSessionIsMetadata,true);
assert.equal(verifyNativeResume(session,{taskId:'task-1',runtimeId:'codex-cli',nativeSessionId:'codex-session-1',generation:1}).ok,true);
for(const bad of [
  {taskId:'task-2',runtimeId:'codex-cli',nativeSessionId:'codex-session-1',generation:1,code:'NATIVE_SESSION_TASK_MISMATCH'},
  {taskId:'task-1',runtimeId:'aider',nativeSessionId:'codex-session-1',generation:1,code:'NATIVE_SESSION_RUNTIME_MISMATCH'},
  {taskId:'task-1',runtimeId:'codex-cli',nativeSessionId:'other',generation:1,code:'NATIVE_SESSION_ID_MISMATCH'},
  {taskId:'task-1',runtimeId:'codex-cli',nativeSessionId:'codex-session-1',generation:2,code:'NATIVE_SESSION_GENERATION_MISMATCH'}
])assert.throws(()=>verifyNativeResume(session,bad),e=>e?.code===bad.code);
session=bindNativeProposal(session,digest);
assert.equal(verifyProposalBinding(session,{proposalDigest:digest,generation:1,runtimeId:'codex-cli',nativeSessionId:'codex-session-1'}).ok,true);
assert.throws(()=>verifyProposalBinding(session,{proposalDigest:'b'.repeat(64),generation:1,runtimeId:'codex-cli',nativeSessionId:'codex-session-1'}),e=>e?.code==='NATIVE_SESSION_PROPOSAL_MISMATCH');
const switched=switchNativeRuntime(session,{runtimeId:'opencode',strategy:'acp-session-load',nativeSessionId:'opencode-77'});
assert.equal(switched.generation,2);
assert.equal(switched.runtimeId,'opencode');
assert.equal(switched.proposalDigest,null);
assert.equal(switched.approvalInvalidated,true);
assert.equal(switched.replayAllowed,false);
assert.equal(switched.replayAuthority,false);
assert.throws(()=>verifyProposalBinding(switched,{proposalDigest:digest,generation:1,runtimeId:'codex-cli',nativeSessionId:'codex-session-1'}));
const verified=markNativeSessionVerified(switched,{taskId:'task-1',runtimeId:'opencode',nativeSessionId:'opencode-77',generation:2});
assert.ok(verified.lastVerifiedAt);
const closed=closeNativeSession(verified);
assert.equal(closed.status,'closed');
assert.equal(closed.proposalDigest,null);
assert.equal(closed.approvalInvalidated,true);
assert.throws(()=>verifyNativeResume(closed,{taskId:'task-1',runtimeId:'opencode',nativeSessionId:'opencode-77',generation:2}),e=>e?.code==='NATIVE_SESSION_CLOSED');
const selection=runtimeSelectionRecord({taskId:'task-1',runtimeId:'opencode',previousRuntimeId:'codex-cli',generation:2});
assert.equal(selection.explicit,true);
assert.equal(selection.silentSwitch,false);
assert.equal(selection.approvalCarryOver,false);
assert.equal(selection.writeAuthority,false);

for(const token of ['NATIVE_SESSION_TASK_MISMATCH','NATIVE_SESSION_RUNTIME_MISMATCH','NATIVE_SESSION_ID_MISMATCH','NATIVE_SESSION_GENERATION_MISMATCH','NATIVE_SESSION_APPROVAL_INVALIDATED','approvalInvalidated:true','replayAllowed:false','replayAuthority:false','writeAuthority:false'])assert.ok(core.includes(token),token);
for(const token of ["PORT_NAME='ld2-native-agent-sessions'","SESSION_KEY='ld74_native_agent_sessions_v1'",'chrome.storage.session','silentSwitch:false','approvalCarryOver:false','replayAuthority:false','writeAuthority:false'])assert.ok(runtime.includes(token),token);
assert.ok(!runtime.includes('chrome.storage.local'));
assert.ok(client.includes('ld2-native-agent-sessions'));
assert.ok(entry.includes('installNativeAgentSessionRuntime();'));
assert.ok(manifest.content_scripts.some(item=>(item.js||[]).includes('content/native-agent-session-client.js')));
assert.ok(manifest.content_scripts.some(item=>(item.js||[]).includes('ui/multi-agent-runtime-v74.js')));
assert.ok(manifest.content_scripts.some(item=>(item.css||[]).includes('ui/multi-agent-runtime-v74.css')));
for(const token of ['Agent Runtime','O agente propõe · o Decrypter escreve','registry().list()','registry().probe(state.selected)','sessions().switchRuntime','explicit:true','writeAuthority:false','Aprovação anterior não é reaproveitada'])assert.ok(ui.includes(token),token);
assert.ok(css.includes('.ld74-agent-overlay'));
assert.match(pkg.notes,/Multi-Agent Runtime UI \+ Native Sessions/);
assert.match(pkg.notes,/GitHub App \+ Supabase OAuth/);
assert.match(pkg.notes,/path traversal/i);
assert.match(pkg.notes,/one-shot/i);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Build 74 — Multi-Agent Runtime UI \+ Native Sessions/);
assert.match(roadmap,/Build 75 — Universal Agent Bench \/ External-Agent Hardening/);
console.log('Build74 Multi-Agent Runtime UI + Native Sessions contract OK');
