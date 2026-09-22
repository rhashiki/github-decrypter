import assert from 'node:assert/strict';
import {
  AGENT_RUNTIME_AGENTS,
  AGENT_RUNTIME_COUNT,
  AGENT_RUNTIME_REGISTRY,
  assertCanonicalAgentRuntime,
  createAgentRuntimeRegistry,
  getAgentRuntimeDescriptor,
  listAgentRuntimeDescriptors,
} from '../packages/ai/src/agent-runtime.js';

const expected = [
  ['ramon','Ramon','orchestrator'],
  ['leonardo','Leonardo','architect'],
  ['strachey','Strachey','builder-programmer'],
  ['licklider','Licklider','frontend-human-interface'],
  ['pitts','Pitts','backend-computational-core'],
  ['weizenbaum','Weizenbaum','reviewer-critic'],
  ['samuel','Samuel','qa-testing'],
  ['seymour','Seymour','mentor-professor'],
  ['fukushima','Fukushima','visual-perception'],
  ['heimdall','Heimdall','architecture-guardian'],
] as const;

assert.equal(AGENT_RUNTIME_COUNT, 10);
assert.equal(AGENT_RUNTIME_AGENTS.length, 10);
assert.equal(AGENT_RUNTIME_REGISTRY.revision, 2);
assert.equal(AGENT_RUNTIME_REGISTRY.historicalRevisionOneCount, 9);
assert.equal(AGENT_RUNTIME_REGISTRY.migrationBuild, 64);
assert.equal(Object.isFrozen(AGENT_RUNTIME_AGENTS), true);
assert.equal(Object.isFrozen(AGENT_RUNTIME_REGISTRY), true);
assert.equal(AGENT_RUNTIME_REGISTRY.viktorIsAgent, false);
assert.equal(AGENT_RUNTIME_REGISTRY.agentExecution, false);
assert.equal(AGENT_RUNTIME_REGISTRY.orchestration, false);
assert.equal(AGENT_RUNTIME_REGISTRY.toolExecution, false);

for (let index = 0; index < expected.length; index += 1) {
  const [id,name,role] = expected[index]!;
  const agent = AGENT_RUNTIME_AGENTS[index]!;
  assert.equal(agent.id, id);
  assert.equal(agent.name, name);
  assert.equal(agent.role, role);
  assert.equal(agent.operational, false);
  assert.equal(agent.capabilityPrincipal, false);
  assert.equal(agent.presentationMetadataOnly, true);
  assert.ok(agent.responsibilities.length > 0);
  assert.ok(agent.authorityLimits.length > 0);
  assert.equal(Object.isFrozen(agent), true);
  assert.equal(Object.isFrozen(agent.responsibilities), true);
  assert.equal(Object.isFrozen(agent.authorityLimits), true);
}

assert.equal(getAgentRuntimeDescriptor('RAMON')?.name, 'Ramon');
assert.equal(getAgentRuntimeDescriptor('  samuel  ')?.role, 'qa-testing');
assert.equal(getAgentRuntimeDescriptor('viktor'), null);
assert.equal(getAgentRuntimeDescriptor('missing'), null);
assert.equal(listAgentRuntimeDescriptors(), AGENT_RUNTIME_AGENTS);

const recreated = createAgentRuntimeRegistry();
assertCanonicalAgentRuntime(recreated);
assertCanonicalAgentRuntime(AGENT_RUNTIME_REGISTRY);

assert.throws(() => {
  const drift = { ...AGENT_RUNTIME_REGISTRY, viktorIsAgent: true };
  assertCanonicalAgentRuntime(drift);
}, /non-canonical/);

assert.throws(() => {
  const drift = { ...AGENT_RUNTIME_REGISTRY, agents: AGENT_RUNTIME_AGENTS.slice(0, 9), agentCount: 9 };
  assertCanonicalAgentRuntime(drift);
}, /non-canonical/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build58-agent-runtime-runtime/1',
  agentCount: AGENT_RUNTIME_REGISTRY.agentCount,
  names: AGENT_RUNTIME_REGISTRY.agents.map((agent) => agent.name),
  viktorIsAgent: AGENT_RUNTIME_REGISTRY.viktorIsAgent,
  historicalRevisionOneCount: AGENT_RUNTIME_REGISTRY.historicalRevisionOneCount,
  operational: false,
}, null, 2));
