import {pathToFileURL} from 'node:url';
import {runUniversalAgentBench as runDraft,UNIVERSAL_AGENT_BENCH_SCHEMA,UNIVERSAL_AGENT_BENCH_BUILD} from './universal-agent-bench-v1.mjs';
import {routeLocalModel} from '../core/local-model-router.js';

export {UNIVERSAL_AGENT_BENCH_SCHEMA,UNIVERSAL_AGENT_BENCH_BUILD};

export async function runUniversalAgentBench(){
  const draft=await runDraft();
  const cases=draft.cases.filter(item=>item.name!=='zero-paid-remote-fallback-static');
  const started=performance.now();
  try{
    const routed=routeLocalModel({desiredTier:'medium',loadedModels:['qwen2.5-coder:14b']});
    if(routed.ok!==true)throw new Error('local model route unavailable');
    if(routed.provider!=='decrypter-local')throw new Error('unexpected model provider');
    if(routed.zeroCostApi!==true)throw new Error('zero-cost invariant missing');
    if(routed.paidFallbackAllowed!==false)throw new Error('paid fallback became allowed');
    if(routed.remoteFallbackAllowed!==false)throw new Error('remote fallback became allowed');
    cases.push({name:'zero-paid-remote-fallback-router','category':'zero-cost',ok:true,ms:Number((performance.now()-started).toFixed(2))});
  }catch(error){
    cases.push({name:'zero-paid-remote-fallback-router','category':'zero-cost',ok:false,ms:Number((performance.now()-started).toFixed(2)),error:String(error?.message||error),code:error?.code||null});
  }
  const passed=cases.filter(item=>item.ok).length;
  const failed=cases.length-passed;
  const categories={};
  for(const item of cases){const bucket=categories[item.category]??={total:0,passed:0,failed:0};bucket.total++;bucket[item.ok?'passed':'failed']++;}
  return {schema:UNIVERSAL_AGENT_BENCH_SCHEMA,build:UNIVERSAL_AGENT_BENCH_BUILD,total:cases.length,passed,failed,categories,cases};
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){const result=await runUniversalAgentBench();console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;}
