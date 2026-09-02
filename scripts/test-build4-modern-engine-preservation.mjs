import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exists = (relative) => fs.existsSync(path.join(root, relative));

const preservedGroups = {
  localModel: ['core/local-model-router.js', 'background/local-model-runtime.js', 'runtime/decrypter-local/ollama-gateway.py'],
  tools: ['core/tool-runtime.js', 'core/operation-journal.js', 'core/patch-engine.js', 'background/tool-runtime.js', 'content/tool-runtime-client.js'],
  mcp: ['core/mcp-client.js', 'core/mcp-protocol.js', 'core/mcp-trust-gateway.js', 'background/mcp-runtime.js', 'content/mcp-runtime-client.js'],
  marketplace: ['core/mcp-marketplace.js', 'background/mcp-marketplace-runtime.js', 'content/mcp-marketplace-client.js'],
  context: ['core/context-engine-v2.js', 'background/context-engine-runtime.js', 'content/context-engine-client.js'],
  scope: ['core/scope-intelligence-v2.js', 'background/scope-intelligence-runtime.js', 'core/scope-lock.js'],
  undoRedo: ['core/reversible-operations.js', 'background/reversible-operations-runtime.js', 'content/reversible-operations-client.js'],
  continuity: ['core/continuity-engine.js', 'background/continuity-runtime.js', 'content/continuity-runtime-client.js'],
  agents: ['core/local-agent-approval.js', 'background/local-agent-orchestrator.js', 'content/local-agent-orchestrator-client.js'],
  agentRegistry: ['core/agent-runtime-registry.js', 'background/agent-runtime-registry-runtime.js', 'content/agent-runtime-registry-client.js'],
  skills: ['core/portable-skills.js', 'background/portable-skills-runtime.js', 'content/portable-skills-client.js'],
  sandbox: ['core/agent-sandbox.js', 'background/agent-sandbox-runtime.js', 'content/agent-sandbox-client.js'],
  nativeSessions: ['core/native-agent-sessions.js', 'background/native-agent-session-runtime.js', 'content/native-agent-session-client.js'],
  validation: ['core/validation-gate.js', 'core/regression-sentinel.js', 'core/checkpoint-manager.js'],
};

const missing = [];
let preserved = 0;
for (const [group, files] of Object.entries(preservedGroups)) {
  for (const file of files) {
    if (!exists(file)) missing.push(`${group}: ${file}`);
    else preserved += 1;
  }
}

if (missing.length) {
  console.error('Modern engine preservation failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  schema: 'github-decrypter-build4-engine-preservation/1',
  groups: Object.keys(preservedGroups),
  preservedEnginePaths: preserved,
  note: 'These files are migration assets only; Build 4 does not make browser background/content layers final runtime authority.'
}, null, 2));
