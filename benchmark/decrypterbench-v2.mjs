import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertSafeRepoPath, isSensitivePath } from '../core/utils.js';
import { applyTextPatch } from '../core/patch-engine.js';
import { routeLocalModel } from '../core/local-model-router.js';
import { evaluateScopeIntelligence } from '../core/scope-intelligence-v2.js';
import { planFileReversal } from '../core/reversible-operations.js';
import { normalizeLocalAgentWriteProposal, localAgentProposalDigest } from '../core/local-agent-approval.js';
import { normalizeMcpEndpoint } from '../core/mcp-protocol.js';
import {
  registerMcpServer,
  setMcpServerTrust,
  setMcpToolPolicy,
  prepareMcpWriteApproval,
  approveMcpWriteApproval,
  authorizeMcpRequest
} from '../core/mcp-trust-gateway.js';
import {
  createContinuityTask,
  defineContinuitySteps,
  claimContinuityStep,
  completeContinuityStep,
  failContinuityStep,
  resolveAmbiguousWrite,
  getContinuityTask,
  recoverExpiredContinuityLeases,
  CONTINUITY_STORAGE_KEY
} from '../core/continuity-engine.js';

const localStore = {};
const sessionStore = {};
function storageArea(store) {
  return {
    async get(keys) {
      if (keys == null) return structuredClone(store);
      if (typeof keys === 'string') return { [keys]: structuredClone(store[keys]) };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, structuredClone(store[key])]));
      if (keys && typeof keys === 'object') {
        const out = {};
        for (const [key, fallback] of Object.entries(keys)) out[key] = store[key] === undefined ? fallback : structuredClone(store[key]);
        return out;
      }
      return {};
    },
    async set(values) { for (const [key, value] of Object.entries(values || {})) store[key] = structuredClone(value); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]; }
  };
}
globalThis.chrome = { storage: { local: storageArea(localStore), session: storageArea(sessionStore) } };

const cases = [];
async function bench(name, category, fn) {
  const started = performance.now();
  try {
    await fn();
    cases.push({ name, category, ok: true, ms: Math.round((performance.now() - started) * 100) / 100 });
  } catch (error) {
    cases.push({ name, category, ok: false, ms: Math.round((performance.now() - started) * 100) / 100, error: error?.code || error?.message || String(error) });
  }
}
async function rejects(fn, predicate = () => true) {
  let caught = null;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught, 'expected rejection');
  assert.ok(predicate(caught), `unexpected rejection: ${caught?.code || caught?.message}`);
}

await bench('repo-path-valid', 'path-traversal', () => {
  assert.equal(assertSafeRepoPath('src/components/App.tsx'), 'src/components/App.tsx');
  assert.equal(assertSafeRepoPath('.env.example'), '.env.example');
});
await bench('repo-path-traversal-blocklist', 'path-traversal', async () => {
  for (const path of [
    '/etc/passwd','../secret','src/../secret','src/..','./src/App.tsx','src//App.tsx','.git/config','.GIT/config',
    'C:\\Windows\\system.ini','https://evil.example/x','%2e%2e/secret','src/%2e%2e/secret','src/%2fetc',' src/App.tsx','src/App.tsx '
  ]) await rejects(() => Promise.resolve(assertSafeRepoPath(path)));
});
await bench('sensitive-path-blocklist', 'path-traversal', () => {
  for (const path of ['.env','.env.production','secrets/api.txt','credentials.json','private-key.pem','certs/server.p12']) assert.equal(isSensitivePath(path), true, path);
  assert.equal(isSensitivePath('.env.example'), false);
});

await bench('patch-stale-blob', 'patch-engine', async () => {
  await rejects(() => applyTextPatch({ path:'src/a.ts', currentText:'const a=1;', currentBlobSha:'new', patch:{ baseBlobSha:'old', edits:[{before:'1',after:'2'}] } }), e => e.code === 'PATCH_STALE_BLOB');
});
await bench('patch-ambiguous-match', 'patch-engine', async () => {
  await rejects(() => applyTextPatch({ path:'src/a.ts', currentText:'x\nx', currentBlobSha:'b1', patch:{ edits:[{before:'x',after:'y'}] } }), e => e.code === 'PATCH_AMBIGUOUS_MATCH');
});

await bench('model-router-large', 'local-model-outage', () => {
  const route = routeLocalModel({ command:'refatore arquitetura de auth e schema em vários arquivos', loadedModels:['qwen3-coder:30b','qwen2.5-coder:14b','qwen2.5-coder:7b'] });
  assert.equal(route.ok, true); assert.equal(route.tier, 'large'); assert.equal(route.remoteFallbackAllowed, false); assert.equal(route.paidFallbackAllowed, false);
});
await bench('model-router-pressure-degrades-locally', 'local-model-outage', () => {
  const route = routeLocalModel({ command:'refatore arquitetura de auth e schema em vários arquivos', loadedModels:['qwen3-coder:30b','qwen2.5-coder:14b','qwen2.5-coder:7b'], metrics:{ inflight:3 } });
  assert.equal(route.ok, true); assert.notEqual(route.tier, 'large'); assert.equal(route.provider, 'decrypter-local');
});
await bench('model-router-no-paid-fallback', 'local-model-outage', () => {
  const route = routeLocalModel({ command:'implemente feature complexa', loadedModels:[] });
  assert.equal(route.ok, false); assert.equal(route.code, 'LOCAL_MODEL_UNAVAILABLE'); assert.equal(route.remoteFallbackAllowed, false); assert.equal(route.paidFallbackAllowed, false);
});

const now = new Date().toISOString();
const humanEvents = [
  { id:'u1', origin:'user', observedAt:now, paths:['src/App.tsx'], evidence:['editor-activity'] },
  { id:'u2', origin:'user', observedAt:now, paths:['src/App.tsx'], evidence:['editor-activity'] }
];
await bench('scope-strong-human-intent-block', 'scope-creep', () => {
  const result = evaluateScopeIntelligence({
    command:'ajuste a sidebar', approvedPlan:{files:[{path:'src/App.tsx',reason:'sidebar'}]},
    files:[{path:'src/App.tsx',action:'update',before:'a\nb\nc',content:'a\nB\nc'}], recentUserEdits:humanEvents
  });
  assert.equal(result.allowed, false); assert.ok(result.violations.some(v => v.code === 'human-intent-override-required'));
});
await bench('scope-explicit-path-authority', 'scope-creep', () => {
  const result = evaluateScopeIntelligence({
    command:'ajuste especificamente src/App.tsx na sidebar', approvedPlan:{files:[{path:'src/App.tsx',reason:'sidebar'}]},
    files:[{path:'src/App.tsx',action:'update',before:'a\nb\nc',content:'a\nB\nc'}], recentUserEdits:humanEvents
  });
  assert.equal(result.allowed, true);
});
await bench('scope-extra-file-block', 'scope-creep', () => {
  const result = evaluateScopeIntelligence({
    command:'ajuste src/App.tsx', approvedPlan:{files:[{path:'src/App.tsx',reason:'pedido'}]},
    files:[{path:'src/App.tsx',action:'update',before:'a',content:'b'},{path:'src/Extra.ts',action:'update',before:'a',content:'b'}]
  });
  assert.equal(result.allowed, false); assert.ok(result.violations.some(v => v.code === 'outside-approved-plan'));
});
await bench('scope-broad-rewrite-block', 'scope-creep', () => {
  const before = Array.from({length:40},(_,i)=>`old-${i}`).join('\n');
  const after = Array.from({length:40},(_,i)=>`new-${i}`).join('\n');
  const result = evaluateScopeIntelligence({ command:'ajuste src/App.tsx', approvedPlan:{files:[{path:'src/App.tsx',reason:'ajuste'}]}, files:[{path:'src/App.tsx',action:'update',before,content:after}] });
  assert.equal(result.allowed, false); assert.ok(result.violations.some(v => v.code === 'broad-rewrite'));
});

await bench('undo-preserves-later-manual-outside-hunk', 'undo-redo', async () => {
  const planned = await planFileReversal({
    path:'src/App.tsx', base:{exists:true,content:'a\nb\nc',blobSha:'b'}, applied:{exists:true,content:'a\nB\nc',blobSha:'a'}, current:{exists:true,content:'a\nB\nc\nmanual',blobSha:'c'}
  }, { direction:'undo', strategy:'preserve', laterHumanEdits:[] });
  assert.equal(planned.status, 'ready'); assert.equal(planned.proposedContent, 'a\nb\nc\nmanual');
});
await bench('undo-conflict-inside-hunk', 'undo-redo', async () => {
  const planned = await planFileReversal({
    path:'src/App.tsx', base:{exists:true,content:'a\nb\nc',blobSha:'b'}, applied:{exists:true,content:'a\nB\nc',blobSha:'a'}, current:{exists:true,content:'a\nUSER\nc',blobSha:'c'}
  }, { direction:'undo', strategy:'preserve', laterHumanEdits:[{origin:'user',paths:['src/App.tsx'],observedAt:now}] });
  assert.equal(planned.status, 'conflict');
});

await bench('local-agent-proposal-digest-tamper', 'approval-tamper', async () => {
  const proposal = normalizeLocalAgentWriteProposal('repo.patch_apply',{ branch:'main', patches:[{ path:'src/App.tsx', expectedBlobSha:'abc', edits:[{search:'420',replace:'500'}] }] });
  const digest = await localAgentProposalDigest(proposal);
  const tampered = normalizeLocalAgentWriteProposal('repo.patch_apply',{ branch:'main', patches:[{ path:'src/App.tsx', expectedBlobSha:'abc', edits:[{search:'420',replace:'900'}] }] });
  assert.notEqual(await localAgentProposalDigest(tampered), digest);
});

await bench('mcp-malicious-endpoints-blocked', 'mcp-trust', async () => {
  for (const endpoint of ['http://evil.example/mcp','https://user:pass@evil.example/mcp','https://mcp.example/mcp?token=secret','https://mcp.example/mcp#frag']) {
    await rejects(() => Promise.resolve(normalizeMcpEndpoint(endpoint)));
  }
});
await bench('mcp-write-ticket-binding-one-shot', 'mcp-trust', async () => {
  const server = await registerMcpServer({ name:'Bench MCP', endpoint:'https://mcp.example/mcp' });
  await setMcpServerTrust(server.id,'approved');
  await setMcpToolPolicy(server.id,'repo.write',{ enabled:true, mode:'write', allowedArgumentKeys:['path','value'], constraints:{ path:{prefix:'src/'} } });
  const args = { path:'src/App.tsx', value:'safe' };
  const ticket = await prepareMcpWriteApproval({ serverId:server.id, toolName:'repo.write', arguments:args });
  await approveMcpWriteApproval(ticket.id,{humanDecision:true});
  await rejects(() => authorizeMcpRequest({ serverId:server.id, method:'tools/call', params:{name:'repo.write',arguments:{...args,value:'tampered'}}, writeApprovalId:ticket.id }), e => e.code === 'MCP_APPROVAL_BINDING_MISMATCH');
  const authorized = await authorizeMcpRequest({ serverId:server.id, method:'tools/call', params:{name:'repo.write',arguments:args}, writeApprovalId:ticket.id });
  assert.equal(authorized.mode,'write');
  await rejects(() => authorizeMcpRequest({ serverId:server.id, method:'tools/call', params:{name:'repo.write',arguments:args}, writeApprovalId:ticket.id }), e => e.code === 'MCP_WRITE_APPROVAL_REQUIRED');
});

await bench('continuity-inference-crash-resume', 'continuity', async () => {
  const task = await createContinuityTask({ projectId:'bench',repo:'acme/app',branch:'main',command:'bench inference' });
  await defineContinuitySteps(task.id,[{idempotencyKey:'infer',label:'Inference',kind:'inference',mode:'inference',maxAttempts:3}]);
  let claim = await claimContinuityStep({taskId:task.id,idempotencyKey:'infer',workerId:'a'});
  await failContinuityStep({taskId:task.id,idempotencyKey:'infer',leaseToken:claim.leaseToken,errorCode:'MODEL_CRASH',outcomeUnknown:false});
  claim = await claimContinuityStep({taskId:task.id,idempotencyKey:'infer',workerId:'b'});
  await completeContinuityStep({taskId:task.id,idempotencyKey:'infer',leaseToken:claim.leaseToken,outputDigest:'ok'});
  const replay = await claimContinuityStep({taskId:task.id,idempotencyKey:'infer'});
  assert.equal(replay.replay,true);
});
await bench('continuity-ambiguous-write-fail-closed', 'continuity', async () => {
  const task = await createContinuityTask({ projectId:'bench',repo:'acme/app',branch:'main',command:'bench write' });
  await defineContinuitySteps(task.id,[{idempotencyKey:'write',label:'Write',kind:'tool',mode:'write',retrySafe:true,maxAttempts:2}]);
  const claim = await claimContinuityStep({taskId:task.id,idempotencyKey:'write',workerId:'a'});
  const raw = localStore[CONTINUITY_STORAGE_KEY].find(row=>row.id===task.id).steps.find(step=>step.idempotencyKey==='write');
  raw.checkpoint={type:'git-head-before-write',reference:'abc',digest:'d',verified:true,createdAt:now}; raw.checkpointId='abc';
  await failContinuityStep({taskId:task.id,idempotencyKey:'write',leaseToken:claim.leaseToken,errorCode:'NETWORK_LOST',outcomeUnknown:true});
  await rejects(() => claimContinuityStep({taskId:task.id,idempotencyKey:'write'}), e => e.code === 'CONTINUITY_WRITE_VERIFICATION_REQUIRED');
  await resolveAmbiguousWrite({taskId:task.id,idempotencyKey:'write',verifiedAbsent:true});
  const safeRetry = await claimContinuityStep({taskId:task.id,idempotencyKey:'write',workerId:'b'});
  assert.equal(safeRetry.claimed,true);
});
await bench('continuity-expired-write-lease-needs-verification', 'continuity', async () => {
  const task = await createContinuityTask({ projectId:'bench',repo:'acme/app',branch:'main',command:'lease crash' });
  await defineContinuitySteps(task.id,[{idempotencyKey:'write-expire',label:'Write',kind:'tool',mode:'write',retrySafe:true,maxAttempts:2}]);
  await claimContinuityStep({taskId:task.id,idempotencyKey:'write-expire',workerId:'a'});
  const raw = localStore[CONTINUITY_STORAGE_KEY].find(row=>row.id===task.id).steps.find(step=>step.idempotencyKey==='write-expire'); raw.leaseUntil='2000-01-01T00:00:00.000Z';
  const recovered = await recoverExpiredContinuityLeases({reason:'decrypterbench'});
  assert.ok(recovered.recovered.some(item=>item.taskId===task.id&&item.status==='verification_required'));
  assert.equal((await getContinuityTask(task.id)).status,'verification_required');
});

await bench('no-paid-fallback-static-regression', 'zero-cost', () => {
  const router = fs.readFileSync('core/local-model-router.js','utf8');
  const runtime = fs.readFileSync('background/local-model-runtime.js','utf8');
  const orchestrator = fs.readFileSync('background/local-agent-orchestrator.js','utf8');
  const combined = `${router}\n${runtime}\n${orchestrator}`;
  assert.match(combined,/paidFallbackAllowed:\s*false/);
  assert.match(combined,/remoteFallbackAllowed:\s*false/);
  assert.doesNotMatch(orchestrator,/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|together\.ai|runpod/i);
});
await bench('lovable-github-supabase-integration-contract', 'e2e-contract', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
  const entry = fs.readFileSync('background/service-worker-entry.js','utf8');
  const github = fs.readFileSync('github/git-adapter.js','utf8');
  const supabase = fs.readFileSync('background/supabase-oauth-runtime.js','utf8');
  const agent = fs.readFileSync('background/local-agent-orchestrator.js','utf8');
  assert.ok(manifest.content_scripts.some(item=>item.matches?.some(match=>match.includes('lovable.dev'))));
  assert.match(entry,/installLocalAgentOrchestrator/);
  assert.match(github,/atomicCommit/);
  assert.match(supabase,/supabase/i);
  assert.match(agent,/buildProjectContextV2/);
  assert.match(agent,/invokeToolRuntimeAction/);
});

const failed = cases.filter(item => !item.ok);
const summary = {
  schema:'ld-decrypterbench/2',
  build:69,
  total:cases.length,
  passed:cases.length-failed.length,
  failed:failed.length,
  categories:Object.fromEntries([...new Set(cases.map(item=>item.category))].map(category=>{
    const rows=cases.filter(item=>item.category===category); return [category,{total:rows.length,passed:rows.filter(item=>item.ok).length,failed:rows.filter(item=>!item.ok).length}];
  })),
  cases
};
console.log(JSON.stringify(summary,null,2));
if (failed.length) process.exitCode = 1;
