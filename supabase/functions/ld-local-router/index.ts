import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const POOL='decrypter-local-primary';
const MAX_BODY_BYTES=8_000_000;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
function safeEq(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function backendSecret(sb:any,name:string){const env=Deno.env.get(name)||'';if(env)return env;const {data,error}=await sb.rpc('ld_backend_secret',{p_name:name});if(error)return '';return String(data||'');}
async function authorized(req:Request,sb:any){const expected=await backendSecret(sb,'DECRYPTER_LOCAL_TOKEN');if(!expected)return false;const got=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();return Boolean(got&&safeEq(got,expected));}
async function snapshot(sb:any){await sb.rpc('ld_reap_inference_leases',{p_pool_code:POOL}).catch(()=>null);const {data,error}=await sb.rpc('ld_inference_pool_snapshot',{p_pool_code:POOL});if(error)throw new Error('POOL_SNAPSHOT_FAILED');return data||{configured:false,healthy:false,code:'POOL_NOT_CONFIGURED'};}
async function markRejected(sb:any,requestId:string,code:string){await sb.from('ld_inference_jobs').update({status:'rejected',completed_at:new Date().toISOString(),error_code:code,updated_at:new Date().toISOString()}).eq('request_id',requestId).eq('status','queued');}
async function maybeScale(sb:any,snap:any,reason:string,warmOne=false){
  const current=Number(snap?.current_workers||0),rawDesired=Number(snap?.desired_workers||0),ready=Number(snap?.ready_workers||0),queued=Number(snap?.queued_jobs||0),inflight=Number(snap?.inflight||0),maxWorkers=Math.max(1,Number(snap?.max_workers||1));
  let desired=Math.min(maxWorkers,Math.max(rawDesired,warmOne?1:0));
  if(desired<current){
    const {data:pool}=await sb.from('ld_inference_pools').select('id,scale_down_cooldown_seconds').eq('code',POOL).maybeSingle();
    const {data:last}=pool?await sb.from('ld_inference_workers').select('last_assigned_at').eq('pool_id',pool.id).not('last_assigned_at','is',null).order('last_assigned_at',{ascending:false}).limit(1).maybeSingle():{data:null};
    const cooldown=Number(pool?.scale_down_cooldown_seconds||300)*1000;
    if(inflight>0||queued>0||(last?.last_assigned_at&&Date.now()-Date.parse(last.last_assigned_at)<cooldown))desired=current;
  }
  if(desired===current)return {requested:false,desired,current,reason:'steady'};
  const {data:pool}=await sb.from('ld_inference_pools').select('id').eq('code',POOL).maybeSingle();if(!pool)return {requested:false,desired,current,reason:'pool-missing'};
  const {data:lastDecision}=await sb.from('ld_inference_scale_decisions').select('desired_workers,created_at').eq('pool_id',pool.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(lastDecision&&Number(lastDecision.desired_workers)===desired&&Date.now()-Date.parse(lastDecision.created_at)<30_000)return {requested:false,desired,current,reason:'deduped'};
  const scalerUrl=await backendSecret(sb,'DECRYPTER_GPU_SCALER_URL'),scalerToken=await backendSecret(sb,'DECRYPTER_GPU_SCALER_TOKEN');let actuator_status='not_configured',actuator_code:string|null=null;
  if(scalerUrl&&scalerToken){try{const r=await fetch(scalerUrl,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${scalerToken}`},body:JSON.stringify({schema:'ld-gpu-scale/1',pool_code:POOL,current_workers:current,ready_workers:ready,queued_jobs:queued,inflight,desired_workers:desired,reason,idempotency_key:`${POOL}:${desired}:${Math.floor(Date.now()/30000)}`})});actuator_status=r.ok?'accepted':'failed';actuator_code=`HTTP_${r.status}`;}catch(e){actuator_status='failed';actuator_code=String((e as Error)?.name||'SCALER_FETCH_FAILED').slice(0,120);}}
  await sb.from('ld_inference_scale_decisions').insert({pool_id:pool.id,current_workers:current,ready_workers:ready,queued_jobs:queued,inflight,desired_workers:desired,reason,actuator_status,actuator_code});
  return {requested:actuator_status==='accepted',configured:Boolean(scalerUrl&&scalerToken),desired,current,actuator_status,actuator_code};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!service)return json({error:{message:'Backend not configured',code:'BACKEND_NOT_CONFIGURED'}},503);const sb=createClient(url,service,{auth:{persistSession:false}});if(!await authorized(req,sb))return json({error:{message:'Unauthorized',code:'LOCAL_ROUTER_UNAUTHORIZED'}},401);const path=new URL(req.url).pathname;
    if(req.method==='GET'&&path.endsWith('/v1/models')){
      const snap=await snapshot(sb);if(!snap?.healthy){const scale=await maybeScale(sb,snap,'health-demand',true).catch(()=>null);return json({error:{message:'No local GPU capacity is currently ready',code:snap?.code||'LOCAL_POOL_UNAVAILABLE'},pool:snap,scale},503);}
      return json({object:'list',data:[{id:String(snap.served_model||'decrypter-local'),object:'model',created:0,owned_by:'lovable-decrypter'}],pool:{ready_workers:snap.ready_workers,available_slots:snap.available_slots,desired_workers:snap.desired_workers}});
    }
    if(req.method!=='POST'||!path.endsWith('/v1/chat/completions'))return json({error:{message:'Route not found',code:'ROUTE_NOT_FOUND'}},404);
    const raw=await req.text();if(raw.length>MAX_BODY_BYTES)return json({error:{message:'Request too large',code:'LOCAL_REQUEST_TOO_LARGE'}},413);let body:any;try{body=JSON.parse(raw);}catch{return json({error:{message:'Invalid JSON',code:'INVALID_JSON'}},400);}if(String(body?.model||'')!=='decrypter-local')return json({error:{message:'Unsupported served model',code:'LOCAL_MODEL_NOT_SUPPORTED'}},400);if(body?.stream===true)return json({error:{message:'Streaming is disabled for repository execution',code:'LOCAL_STREAMING_DISABLED'}},400);
    const requestId=crypto.randomUUID();const {data:queued,error:qe}=await sb.rpc('ld_enqueue_inference_job',{p_pool_code:POOL,p_request_id:requestId});if(qe)throw new Error('JOB_ENQUEUE_FAILED');if(!queued?.ok){const code=String(queued?.code||'POOL_RATE_LIMITED');return json({error:{message:'Local inference admission rejected',code},admission:queued},code==='POOL_RATE_LIMITED'?429:503);}const {data:claim,error:ce}=await sb.rpc('ld_claim_inference_worker',{p_pool_code:POOL,p_request_id:requestId});if(ce)throw new Error('WORKER_CLAIM_FAILED');if(!claim?.ok){const code=String(claim?.code||'POOL_SATURATED');await markRejected(sb,requestId,code);const snap=await snapshot(sb).catch(()=>null);if(snap)await maybeScale(sb,snap,'dispatch-saturated',true).catch(()=>null);return json({error:{message:'Local GPU pool is saturated',code},pool:snap},503);}
    const leaseId=String(claim.lease_id),endpoint=String(claim.endpoint||'').replace(/\/+$/,'');const token=await backendSecret(sb,'DECRYPTER_LOCAL_TOKEN');const controller=new AbortController();const timeoutMs=Math.max(30_000,Math.min(300_000,Number(Deno.env.get('DECRYPTER_LOCAL_REQUEST_TIMEOUT_MS')||180_000)));const timer=setTimeout(()=>controller.abort(),timeoutMs);let outcome='failed',errorCode='LOCAL_UPSTREAM_FAILED';
    try{const upstream=await fetch(`${endpoint}/v1/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:raw,signal:controller.signal});const bytes=await upstream.arrayBuffer();outcome=upstream.ok?'success':'failed';errorCode=upstream.ok?'':`LOCAL_UPSTREAM_HTTP_${upstream.status}`;await sb.rpc('ld_finish_inference_job',{p_lease_id:leaseId,p_outcome:outcome,p_error_code:errorCode||null});const snap=await snapshot(sb).catch(()=>null);if(snap)await maybeScale(sb,snap,'dispatch-complete').catch(()=>null);return new Response(bytes,{status:upstream.status,headers:{...cors,'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Decrypter-Worker':String(claim.worker_id)}});}catch(e){errorCode=(e as Error)?.name==='AbortError'?'LOCAL_UPSTREAM_TIMEOUT':'LOCAL_UPSTREAM_FETCH_FAILED';await sb.rpc('ld_finish_inference_job',{p_lease_id:leaseId,p_outcome:'failed',p_error_code:errorCode}).catch(()=>null);const snap=await snapshot(sb).catch(()=>null);if(snap)await maybeScale(sb,snap,'dispatch-failed',true).catch(()=>null);return json({error:{message:'Local GPU worker failed',code:errorCode}},502);}finally{clearTimeout(timer);}
  }catch(e){console.error('ld-local-router',e);return json({error:{message:'Local router internal error',code:String((e as Error)?.message||'INTERNAL_ERROR')}},500);}
});
