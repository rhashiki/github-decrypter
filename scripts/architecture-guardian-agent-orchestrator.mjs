import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(relative)=>fs.existsSync(path.join(root,relative))?fs.readFileSync(path.join(root,relative),'utf8'):'';
const exists=(relative)=>fs.existsSync(path.join(root,relative));
const json=(relative)=>JSON.parse(read(relative));
const policy=json('architecture.guardian.json');
const runtime=policy.agentRuntimeAuthority;
const contract=policy.architectureContractAuthority;
const ledger=policy.architectureLedgerAuthority;
const heimdall=policy.heimdallAuthority;
const orchestrator=policy.agentOrchestratorAuthority;
const viktor=policy.viktorActivationAuthority;
const violations=[];
const versionBuild=(value)=>Number(/^0\.0\.(\d+)$/.exec(value)?.[1]??NaN);

if(
  policy.currentBuild<64||policy.phaseGates?.agentOrchestratorBuild!==64
  ||!runtime||!contract||!ledger||!heimdall||!orchestrator||!viktor
  ||orchestrator.minimumBuild!==64||orchestrator.ownerSource!=='packages/ai/src/agent-orchestrator.ts'
){
  violations.push({code:'AG620',message:'Build 64 Agent Orchestrator policy is missing or inactive.'});
}else{
  const rootPackage=json('package.json');
  const aiPackage=json('packages/ai/package.json');
  const studioPackage=json('apps/studio/package.json');
  const expectedExports={
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
  };
  if(
    versionBuild(rootPackage.version)<64||versionBuild(aiPackage.version)<64||versionBuild(studioPackage.version)<64
    ||JSON.stringify(aiPackage.exports)!==JSON.stringify(expectedExports)
    ||JSON.stringify(aiPackage.dependencies)!==JSON.stringify({'@github-decrypter/plan':'workspace:*','@github-decrypter/tools':'workspace:*'})
  ) violations.push({code:'AG621',message:'Build 64 package/version/export boundary drifted.'});

  const runtimeSource=read('packages/ai/src/agent-runtime.ts');
  for(const marker of [
    'AGENT_RUNTIME_REVISION = 2','AGENT_RUNTIME_COUNT = 10','AGENT_RUNTIME_MIGRATION_BUILD = 64',
    'AGENT_RUNTIME_REVISION_ONE_COUNT = 9',"id: 'heimdall'","name: 'Heimdall'","role: 'architecture-guardian'",
    'historicalRevisionOneCount','heimdallBuild: 64','viktorIsAgent: false',
  ]) if(!runtimeSource.includes(marker)) violations.push({code:'AG622',message:'Agent Runtime revision 2 / Heimdall migration is incomplete.',detail:marker});
  if(runtimeSource.includes("id: 'viktor'")||runtimeSource.includes("name: 'Viktor'")) {
    violations.push({code:'AG622',message:'Viktor must remain outside the Agent Runtime registry.'});
  }
  if(
    runtime.runtimeRevision!==2||runtime.migrationBuild!==64||runtime.historicalRevisionOneCount!==9
    ||runtime.agentCount!==10||runtime.heimdallBuild!==64||runtime.viktorIsAgent!==false
    ||JSON.stringify(runtime.agentIds)!==JSON.stringify(['ramon','leonardo','strachey','licklider','pitts','weizenbaum','samuel','seymour','fukushima','heimdall'])
  ) violations.push({code:'AG622',message:'Agent Runtime policy does not match explicit Build 64 migration.'});

  const contractSource=read('packages/ai/src/architecture-contract.ts');
  const ledgerSource=read('packages/ai/src/architecture-ledger.ts');
  for(const marker of [
    "ARCHITECTURE_CONTRACT_SCHEMA = 'gd-architecture-contract/1'",'createArchitectureContract(','assertCanonicalArchitectureContract(',
    'canonicalProjectArchitecture: true','explicitOwnership: true','explicitDependencyDirection: true','mutationAuthority:false','persistenceAuthority:false',
  ]) if(!contractSource.includes(marker)) violations.push({code:'AG623',message:'Architecture Contract boundary is incomplete.',detail:marker});
  for(const marker of [
    "ARCHITECTURE_LEDGER_SCHEMA = 'gd-architecture-ledger/1'",'createArchitectureLedger(','assertCanonicalArchitectureLedger(',
    'architectureMemoryAuthority:true','modelMemoryRequired:false','mutationAuthority:false','persistenceAuthority:false',
  ]) if(!ledgerSource.includes(marker)) violations.push({code:'AG623',message:'Architecture Ledger boundary is incomplete.',detail:marker});
  if(
    contract.schema!=='gd-architecture-contract/1'||contract.machineReadable!==true||contract.mutationAuthority!==false||contract.persistenceAuthority!==false
    ||ledger.schema!=='gd-architecture-ledger/1'||ledger.architectureMemoryAuthority!==true||ledger.modelMemoryRequired!==false
    ||ledger.mutationAuthority!==false||ledger.persistenceAuthority!==false
  ) violations.push({code:'AG623',message:'Architecture Contract/Ledger policy drifted.'});

  const heimdallSource=read('packages/ai/src/heimdall.ts');
  for(const marker of [
    "HEIMDALL_SCHEMA = 'gd-heimdall-conformance/1'","HEIMDALL_ID = 'heimdall'","HEIMDALL_NAME = 'Heimdall'",
    "HEIMDALL_ROLE = 'architecture-guardian'",'createHeimdallConformance(','assertCanonicalHeimdallConformance(',
    "'conformant','violation','architectural-change-required','insufficient-evidence'",
    'deterministicGuardianConsumer:true','refactorBeforeFeature:true','architectureDesignAuthority:false',
    'architectureEnforcementAuthority:false','contractMutationAuthority:false','ledgerMutationAuthority:false',
  ]) if(!heimdallSource.includes(marker)) violations.push({code:'AG624',message:'Heimdall conformance boundary is incomplete.',detail:marker});
  if(
    heimdall.agentId!=='heimdall'||heimdall.agentName!=='Heimdall'||heimdall.agentRole!=='architecture-guardian'
    ||heimdall.architectureDesignAuthority!==false||heimdall.architectureEnforcementAuthority!==false
    ||heimdall.contractMutationAuthority!==false||heimdall.ledgerMutationAuthority!==false
    ||heimdall.deterministicGuardianConsumer!==true||heimdall.refactorBeforeFeature!==true
  ) violations.push({code:'AG624',message:'Heimdall policy gained architectural design/enforcement/mutation authority.'});

  const orchestratorSource=read('packages/ai/src/agent-orchestrator.ts');
  for(const marker of [
    "AGENT_ORCHESTRATOR_SCHEMA = 'gd-agent-orchestrator/1'","AGENT_ORCHESTRATOR_ID = 'ramon'","AGENT_ORCHESTRATOR_NAME = 'Ramon'",
    'createAgentOrchestratorRecord(','assertCanonicalAgentOrchestratorRecord(','sourceAgentRuntimeRevision:2',
    'coordinatedTeam:true','explicitParticipantRouting:true','semanticRouting:false','automaticSelection:false',
    'reviewAdvisoryOnlyPreserved:true','deterministicGuardianSovereign:true','validationPipelineSovereign:true',
    'viktorIsAgent:false','viktorCompletionAuthority:false','toolExecution:false','execution:false',
  ]) if(!orchestratorSource.includes(marker)) violations.push({code:'AG625',message:'Agent Orchestrator boundary is incomplete.',detail:marker});
  if(
    orchestrator.agentId!=='ramon'||orchestrator.sourceAgentRuntimeRevision!==2||orchestrator.coordinatedTeam!==true
    ||orchestrator.explicitParticipantRouting!==true||orchestrator.semanticRouting!==false||orchestrator.automaticSelection!==false
    ||orchestrator.toolExecution!==false||orchestrator.execution!==false||orchestrator.viktorIsAgent!==false
    ||orchestrator.viktorCompletionAuthority!==false||orchestrator.capabilityGrantAuthority!==false
    ||orchestrator.approvalAuthority!==false||orchestrator.scopeAuthority!==false||orchestrator.directMutationAuthority!==false
  ) violations.push({code:'AG625',message:'Agent Orchestrator policy gained forbidden autonomy or execution authority.'});

  for(const [file,source] of [
    ['packages/ai/src/architecture-contract.ts',contractSource],
    ['packages/ai/src/architecture-ledger.ts',ledgerSource],
    ['packages/ai/src/heimdall.ts',heimdallSource],
    ['packages/ai/src/agent-orchestrator.ts',orchestratorSource],
  ]) {
    if(/\bnode:|\bprocess\.|\bfetch\s*\(|\bwindow\.|\bdocument\.|\blocalStorage\b|\bindexedDB\b|\bchild_process\b|\bWebSocket\b|\bXMLHttpRequest\b/.test(source)
       ||/spawn\s*\(|exec\s*\(|\.writeFile\s*\(|\.unlink\s*\(|\.rm\s*\(/.test(source)) {
      violations.push({code:'AG626',message:'Build 64 AI architecture/orchestration surface gained direct environment authority.',detail:file});
    }
  }

  const session=read('apps/studio/src/viktor-session.ts');
  const component=read('apps/studio/src/ViktorToggle.tsx');
  const app=read('apps/studio/src/App.tsx');
  const main=read('apps/studio/src/main.tsx');
  const context=read('apps/studio/src/studio-context.ts');
  for(const marker of [
    "VIKTOR_SESSION_SCHEMA = 'gd-viktor-session/1'","VIKTOR_STATES = Object.freeze(['OFF','READY','LISTENING','SPEAKING','ERROR']",
    "let state:ViktorState='OFF'",'requestMicrophonePermission()','await adapter.requestMicrophonePermission()',
    'await adapter.stopMicrophoneCapture()','await adapter.stopVoiceTransport()','await adapter.cancelAssistantAudio()',
    'persistentActivation:false','backgroundListening:false',
  ]) if(!session.includes(marker)) violations.push({code:'AG627',message:'Viktor per-session lifecycle is incomplete.',detail:marker});
  for(const marker of ['ViktorToggle','aria-pressed={snapshot.enabled}','Turn Viktor on','Turn Viktor off']) {
    if(!component.includes(marker)) violations.push({code:'AG627',message:'Visible Viktor toggle contract is incomplete.',detail:marker});
  }
  if(!app.includes('<ViktorToggle />')||!main.includes("import './viktor-toggle.css'")||!context.includes('STUDIO_BUILD = 64')||!context.includes("STUDIO_VERSION = '0.0.64'")) {
    violations.push({code:'AG627',message:'Viktor Studio integration or Build 64 identity is incomplete.'});
  }
  if(/\blocalStorage\b|\bindexedDB\b|\bWebSocket\b|\bfetch\s*\(/.test(session+'\n'+component)) {
    violations.push({code:'AG627',message:'Viktor activation gained persistence or hidden network transport authority.'});
  }
  if(
    viktor.defaultState!=='OFF'||viktor.explicitToggleRequired!==true||viktor.microphonePermissionAfterExplicitActivation!==true
    ||viktor.persistentActivation!==false||viktor.backgroundListening!==false||viktor.wakeWordListener!==false
    ||viktor.toggleIsCapabilityGrant!==false||viktor.toggleIsApproval!==false||viktor.toggleIsScopeLock!==false
    ||viktor.immediateDeactivationResourceRelease!==true||viktor.mutationAuthority!==false||viktor.networkAuthority!==false
  ) violations.push({code:'AG627',message:'Viktor activation policy drifted.'});

  const review=policy.reviewAgentAuthority;
  const validation=policy.validationPipelineAuthority;
  const integrity=policy.architecturalIntegrity;
  if(
    !review||review.reviewAdvisoryOnly!==true||review.vetoAuthority!==false
    ||!validation||validation.validationPipeline!==true||validation.testingAgentAuthority!==false
    ||!integrity||integrity.deterministicGuardianBuild!==9||integrity.heimdallActivationBuild!==64
    ||integrity.viktorExcludedFromAgentRegistry!==true||integrity.silentArchitecturalChangeAllowed!==false
  ) violations.push({code:'AG628',message:'Build 64 authority separation from Review/Validation/Guardian/Viktor drifted.'});

  const archDoc=read('docs/architecture/ARCHITECTURAL_INTEGRITY.md');
  const orchDoc=read('docs/architecture/AGENT_ORCHESTRATOR.md');
  const buildDoc=read('docs/builds/BUILD_64_AGENT_ORCHESTRATOR.md');
  const workflow=read('.github/workflows/build64-agent-orchestrator.yml');
  for(const phrase of ['Architecture may evolve, but it must never evolve accidentally.','Heimdall != Architecture Guardian','Architecture Ledger != model memory','Refactor Before Feature']) {
    if(!archDoc.includes(phrase)) violations.push({code:'AG629',message:'Architectural Integrity documentation is incomplete.',detail:phrase});
  }
  for(const phrase of ['revision 2 (Build 64): 10 canonical specialists','Heimdall — Architecture Guardian','Viktor is the outward communication surface, **not an agent**','Agent Orchestrator != unrestricted agent autonomy']) {
    if(!orchDoc.includes(phrase)) violations.push({code:'AG629',message:'Agent Orchestrator documentation is incomplete.',detail:phrase});
  }
  if(!buildDoc.includes('Build 64 — Agent Orchestrator')||!buildDoc.includes('Build 65 — Knowledge Graph')) {
    violations.push({code:'AG629',message:'Build 64 documentation or successor ownership is incomplete.'});
  }
  if(!workflow.includes('pnpm run guardian')||!workflow.includes('pnpm run ci')||!workflow.includes('guard-viktor-explicit-activation.mjs')||!workflow.includes('test-build5-rebrand.mjs')) {
    violations.push({code:'AG629',message:'Build 64 workflow does not preserve the accumulated gate.'});
  }
}

if(violations.length){
  console.error(JSON.stringify({ok:false,schema:'gd-architecture-guardian-agent-orchestrator-report/1',violations},null,2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,schema:'gd-architecture-guardian-agent-orchestrator-report/1',build:64,
  agentRuntimeRevision:2,agentCount:10,heimdall:'active',viktorDefaultState:'OFF',
  unrestrictedAgentAutonomy:false,backgroundListening:false,
},null,2));
