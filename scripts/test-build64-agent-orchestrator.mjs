import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const json=(file)=>JSON.parse(read(file));
const versionBuild=(value)=>Number(/^0\.0\.(\d+)$/.exec(value)?.[1]??NaN);

const policy=json('architecture.guardian.json');
const rootPackage=json('package.json');
const aiPackage=json('packages/ai/package.json');
const studioPackage=json('apps/studio/package.json');
const runtime=read('packages/ai/src/agent-runtime.ts');
const contract=read('packages/ai/src/architecture-contract.ts');
const ledger=read('packages/ai/src/architecture-ledger.ts');
const heimdall=read('packages/ai/src/heimdall.ts');
const orchestrator=read('packages/ai/src/agent-orchestrator.ts');
const viktor=read('apps/studio/src/viktor-session.ts');
const app=read('apps/studio/src/App.tsx');

assert.ok(policy.currentBuild>=64);
assert.equal(policy.phaseGates?.agentOrchestratorBuild,64);
assert.ok(versionBuild(rootPackage.version)>=64);
assert.ok(versionBuild(aiPackage.version)>=64);
assert.ok(versionBuild(studioPackage.version)>=64);

assert.deepEqual(aiPackage.exports,{
  '.':'./src/index.ts',
  './agent-runtime':'./src/agent-runtime.ts',
  './planner-agent':'./src/planner-agent.ts',
  './coding-agent':'./src/coding-agent.ts',
  './database-agent':'./src/database-agent.ts',
  './testing-agent':'./src/testing-agent.ts',
  './review-agent':'./src/review-agent.ts',
  './architecture-contract':'./src/architecture-contract.ts',
  './architecture-ledger':'./src/architecture-ledger.ts',
  './heimdall':'./src/heimdall.ts',
  './agent-orchestrator':'./src/agent-orchestrator.ts',
});

for(const marker of [
  'AGENT_RUNTIME_REVISION = 2','AGENT_RUNTIME_COUNT = 10','AGENT_RUNTIME_MIGRATION_BUILD = 64',
  'AGENT_RUNTIME_REVISION_ONE_COUNT = 9',"id: 'heimdall'","name: 'Heimdall'","role: 'architecture-guardian'",
  'viktorIsAgent: false',
]) assert.ok(runtime.includes(marker),'Missing runtime migration marker: '+marker);
assert.equal(runtime.includes("id: 'viktor'"),false);
assert.equal(runtime.includes("name: 'Viktor'"),false);

for(const [source,markers] of [
  [contract,["ARCHITECTURE_CONTRACT_SCHEMA = 'gd-architecture-contract/1'",'createArchitectureContract(','canonicalProjectArchitecture:true','mutationAuthority:false']],
  [ledger,["ARCHITECTURE_LEDGER_SCHEMA = 'gd-architecture-ledger/1'",'createArchitectureLedger(','architectureMemoryAuthority:true','modelMemoryRequired:false']],
  [heimdall,["HEIMDALL_SCHEMA = 'gd-heimdall-conformance/1'","HEIMDALL_ID = 'heimdall'",'createHeimdallConformance(','architectureEnforcementAuthority:false','refactorBeforeFeature:true']],
  [orchestrator,["AGENT_ORCHESTRATOR_SCHEMA = 'gd-agent-orchestrator/1'","AGENT_ORCHESTRATOR_ID = 'ramon'",'createAgentOrchestratorRecord(','semanticRouting:false','automaticSelection:false','toolExecution:false']],
  [viktor,["VIKTOR_SESSION_SCHEMA = 'gd-viktor-session/1'","let state:ViktorState='OFF'",'requestMicrophonePermission()','persistentActivation:false','backgroundListening:false']],
]) for(const marker of markers) assert.ok(source.includes(marker),'Missing Build 64 marker: '+marker);

assert.ok(app.includes('<ViktorToggle />'));
assert.equal(/\blocalStorage\b|\bindexedDB\b|\bWebSocket\b|\bfetch\s*\(/.test(viktor),false);

assert.equal(policy.agentRuntimeAuthority.agentCount,10);
assert.equal(policy.agentRuntimeAuthority.runtimeRevision,2);
assert.equal(policy.agentRuntimeAuthority.historicalRevisionOneCount,9);
assert.equal(policy.agentRuntimeAuthority.viktorIsAgent,false);
assert.equal(policy.heimdallAuthority.architectureDesignAuthority,false);
assert.equal(policy.heimdallAuthority.architectureEnforcementAuthority,false);
assert.equal(policy.agentOrchestratorAuthority.toolExecution,false);
assert.equal(policy.agentOrchestratorAuthority.execution,false);
assert.equal(policy.agentOrchestratorAuthority.viktorCompletionAuthority,false);
assert.equal(policy.viktorActivationAuthority.defaultState,'OFF');
assert.equal(policy.viktorActivationAuthority.backgroundListening,false);
assert.equal(policy.viktorActivationAuthority.persistentActivation,false);

console.log(JSON.stringify({
  ok:true,schema:'gd-build64-agent-orchestrator-static/1',build:64,
  agentRuntimeRevision:2,agentCount:10,heimdall:true,viktorDefaultState:'OFF',nextBuild:65,
},null,2));
