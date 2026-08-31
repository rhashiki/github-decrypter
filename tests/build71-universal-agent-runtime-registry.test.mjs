import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  AGENT_RUNTIME_REGISTRY_SCHEMA,
  AGENT_RUNTIME_EVENT_SCHEMA,
  AGENT_RUNTIME_TRANSPORT_SCHEMA,
  listAgentRuntimeDefinitions,
  getAgentRuntimeDefinition,
  normalizeRuntimeEvent,
  planPromptTransport,
  compareRuntimeVersions,
  evaluateRuntimeCompatibility,
  createRuntimeWatchdog,
  assertExternalRuntimeNotWriteAuthority
} from '../core/agent-runtime-registry.js';

const read = path => fs.readFileSync(path,'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('release/runtime-package.json'));
const settings = read('settings/config.js');
const core = read('core/agent-runtime-registry.js');
const runtime = read('background/agent-runtime-registry-runtime.js');
const client = read('content/agent-runtime-registry-client.js');
const entry = read('background/service-worker-entry.js');
const roadmap = read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version,'2.6.71');
assert.match(manifest.version_name,/Build 71 · Universal Agent Runtime Registry/);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settings.includes("VERSION = '2.6.71'"));
assert.ok(settings.includes("AGENT_RUNTIME_REGISTRY_SCHEMA = 'ld-agent-runtime-registry/1'"));
assert.equal(AGENT_RUNTIME_REGISTRY_SCHEMA,'ld-agent-runtime-registry/1');
assert.equal(AGENT_RUNTIME_EVENT_SCHEMA,'ld-agent-runtime-event/1');
assert.equal(AGENT_RUNTIME_TRANSPORT_SCHEMA,'ld-agent-runtime-transport/1');

const defs = listAgentRuntimeDefinitions();
assert.deepEqual(defs.map(item=>item.id),['decrypter-local','openhands-agent-server','codex-cli','opencode','aider']);
for(const def of defs){
  assert.equal(def.capabilities.writeAuthority,false,def.id);
  assert.equal(def.authority.canWriteAuthoritative,false,def.id);
  assert.equal(def.authority.requiresDecrypterApproval,true,def.id);
  assert.equal(assertExternalRuntimeNotWriteAuthority(def.id).canWriteAuthoritative,false);
}
assert.equal(getAgentRuntimeDefinition('codex-cli').transports.some(item=>item.id==='app-server-jsonrpc'&&item.bridgeRequired),true);
assert.equal(getAgentRuntimeDefinition('opencode').transports.some(item=>item.id==='http'&&item.directFromExtension),true);
assert.equal(getAgentRuntimeDefinition('opencode').transports.some(item=>item.id==='acp'&&item.bridgeRequired),true);
assert.equal(getAgentRuntimeDefinition('aider').nativeSession.supported,false);
assert.equal(getAgentRuntimeDefinition('openhands-agent-server').nativeSession.strategy,'remote-conversation');

const stdinPlan = planPromptTransport({runtimeId:'codex-cli',transportId:'cli',prompt:'explain repository',platform:'linux',executable:'codex'});
assert.equal(stdinPlan.delivery,'stdin');
assert.equal(stdinPlan.shell,false);
assert.equal(stdinPlan.environmentExpansion,false);
assert.equal(stdinPlan.secretInPrompt,false);
assert.equal(stdinPlan.writeAuthority,false);

assert.throws(
  ()=>planPromptTransport({runtimeId:'codex-cli',transportId:'cli',prompt:'use %DECRYPTER_TEST_VALUE% safely',platform:'win32',executable:'codex.cmd',requested:'argv'}),
  error=>error?.code==='AGENT_PROMPT_ENV_EXPANSION_RISK'
);
assert.throws(
  ()=>planPromptTransport({runtimeId:'codex-cli',transportId:'cli',prompt:'x'.repeat(25000),platform:'win32',executable:'codex.exe',requested:'argv'}),
  error=>error?.code==='AGENT_PROMPT_ARGV_LIMIT'
);
assert.throws(
  ()=>planPromptTransport({runtimeId:'aider',transportId:'cli',prompt:'x'.repeat(1_100_000)}),
  error=>error?.code==='AGENT_PROMPT_TOO_LARGE'
);

const event = normalizeRuntimeEvent('opencode',{type:'tool_call',session_id:'s1',name:'grep',reasoning:'never-copy-me'});
assert.equal(event.schema,AGENT_RUNTIME_EVENT_SCHEMA);
assert.equal(event.runtimeId,'opencode');
assert.equal(event.type,'tool');
assert.equal(event.tool,'grep');
assert.equal(event.reasoningOmitted,true);
assert.equal(event.rawOmitted,true);
assert.ok(!JSON.stringify(event).includes('never-copy-me'));

assert.equal(compareRuntimeVersions('v1.2.3','1.2.2'),1);
assert.equal(compareRuntimeVersions('1.2.3','1.2.3'),0);
assert.equal(compareRuntimeVersions('1.2.2','1.2.3'),-1);
assert.equal(compareRuntimeVersions('unknown','1.2.3'),null);
assert.equal(evaluateRuntimeCompatibility('openhands-agent-server','1.11.4').compatible,true);

let clock=1000;
const watchdog=createRuntimeWatchdog({firstOutputTimeoutMs:1000,inactivityTimeoutMs:5000,totalTimeoutMs:10000,now:()=>clock});
assert.equal(watchdog.status().cancelled,false);
clock=2101;
assert.equal(watchdog.status().code,'AGENT_RUNTIME_FIRST_OUTPUT_TIMEOUT');
let clock2=1000;
const watchdog2=createRuntimeWatchdog({firstOutputTimeoutMs:1000,inactivityTimeoutMs:2000,totalTimeoutMs:10000,now:()=>clock2});
watchdog2.touch({output:true});
clock2=3501;
assert.equal(watchdog2.status().code,'AGENT_RUNTIME_INACTIVITY_TIMEOUT');

for(const token of ['decrypter-local','openhands-agent-server','codex-cli','opencode','aider','writeAuthority: false','AGENT_PROMPT_ENV_EXPANSION_RISK','AGENT_RUNTIME_FIRST_OUTPUT_TIMEOUT']) assert.ok(core.includes(token),token);
for(const token of ["PORT_NAME = 'ld2-agent-runtime-registry'","SESSION_AUTH_KEY = 'ld71_agent_runtime_auth_v1'",'chrome.storage.session','AGENT_RUNTIME_BRIDGE_REQUIRED','cliSpawnInExtension:false',"credentialsStorage:'session-only'"]) assert.ok(runtime.includes(token),token);
assert.ok(!runtime.includes('chrome.storage.local.set'));
assert.ok(!runtime.includes('chrome.storage.local.get'));
assert.ok(entry.includes('installAgentRuntimeRegistryRuntime();'));
assert.ok(client.includes('ld2-agent-runtime-registry'));
assert.ok(manifest.content_scripts.some(item=>(item.js||[]).includes('content/agent-runtime-registry-client.js')));
assert.match(pkg.notes,/Universal Agent Runtime Registry/);
assert.match(pkg.notes,/proposal-only/i);
assert.match(pkg.notes,/writeAuthority=false/);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Build 71 — Universal Agent Runtime Registry/);
assert.match(roadmap,/Build 72 — Portable Skills v2/);

console.log('Build71 Universal Agent Runtime Registry contract OK');
