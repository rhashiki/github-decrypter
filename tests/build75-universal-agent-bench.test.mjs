import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runUniversalAgentBench,UNIVERSAL_AGENT_BENCH_SCHEMA,UNIVERSAL_AGENT_BENCH_BUILD} from '../benchmark/universal-agent-bench.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const pkg=JSON.parse(read('release/runtime-package.json'));
const settings=read('settings/config.js');
const roadmap=read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');
const benchmark=`${read('benchmark/universal-agent-bench-v1.mjs')}\n${read('benchmark/universal-agent-bench.mjs')}`;

assert.equal(manifest.version,'2.6.75');
assert.match(manifest.version_name,/Build 75 · Universal Agent Bench \/ External-Agent Hardening/);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settings.includes("VERSION = '2.6.75'"));
assert.ok(settings.includes("UNIVERSAL_AGENT_BENCH_SCHEMA = 'ld-universal-agent-bench/1'"));
assert.equal(UNIVERSAL_AGENT_BENCH_SCHEMA,'ld-universal-agent-bench/1');
assert.equal(UNIVERSAL_AGENT_BENCH_BUILD,75);

const result=await runUniversalAgentBench();
assert.equal(result.schema,UNIVERSAL_AGENT_BENCH_SCHEMA);
assert.equal(result.build,75);
assert.ok(result.total>=20,`expected >=20 adversarial probes, got ${result.total}`);
assert.equal(result.failed,0,JSON.stringify(result.cases.filter(item=>!item.ok),null,2));
assert.equal(result.passed,result.total);
for(const category of ['malformed-actions','sandbox-escape','stale-approval','cross-agent','tool-runtime-bypass','digest-mismatch','session-replay','runtime-crash','scope-creep','human-intent','credential-persistence','prompt-transport','runtime-events','provider-revocation','zero-cost']){
  assert.ok(result.categories[category]?.passed>0,`missing passing category ${category}`);
  assert.equal(result.categories[category]?.failed,0,`category failed ${category}`);
}
for(const token of ['SANDBOX_DIFF_ACTION_INVALID','SANDBOX_BASE_HEAD_MISMATCH','NATIVE_SESSION_PROPOSAL_MISMATCH','USER_EDIT > AI_EDIT','GITHUB_REPOSITORY_NOT_AUTHORIZED','SUPABASE_REAUTHORIZE_REQUIRED','AGENT_PROMPT_ENV_EXPANSION_RISK','writeAuthority===false','paidFallbackAllowed!==false','remoteFallbackAllowed!==false'])assert.ok(benchmark.includes(token),token);
assert.match(pkg.notes,/Universal Agent Bench \/ External-Agent Hardening/);
assert.match(pkg.notes,/GitHub App\/repository revocation/);
assert.match(pkg.notes,/Supabase OAuth\/scope revocation/);
assert.match(pkg.notes,/zero paid\/remote fallback/);
assert.match(pkg.notes,/path traversal/i);
assert.match(pkg.notes,/one-shot/i);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Build 75 — Universal Agent Bench \/ External-Agent Hardening/);
assert.match(roadmap,/Final cumulative homologation after Build 75/);

console.log(`Build75 Universal Agent Bench contract OK · ${result.passed}/${result.total} adversarial probes passed`);
