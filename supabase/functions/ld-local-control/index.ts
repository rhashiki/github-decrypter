import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const POOL='decrypter-local-primary';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-decrypter-worker-secret,x-owner-secret,authorization','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
function safeEq(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function backendSecret(sb:any,name:string){const env=Deno.env.get(name)||'';if(env)return env;const {data,error}=await sb.rpc('ld_backend_secret',{p_name:name});if(error)return '';return String(data||'');}
async function workerAuthorized(req:Request,sb:any){const expected=(await backendSecret(sb,'DECRYPTER_WORKER_SECRET'))||(await backendSecret(sb,'DECRYPTER_LOCAL_TOKEN'));const got=String(req.headers.get('x-decrypter-worker-secret')||'').trim();return Boolean(expected&&got&&safeEq(expected,got));}
async function ownerAuthorized(req:Request,sb:any){const expected=await backendSecret(sb,'LD_OWNER_SECRET');const got=String(req.headers.get('x-owner-secret')||'').trim();return Boolean(expected&&got&&safeEq(expected,got));}
function endpoint(value:unknown){try{const u=new URL(String(value||''));if(u.protocol!=='https:'||u.username||u.password)return null;u.pathname=u.pathname.replace(/\/+$/,'');u.search='';u.hash='';return u.toString().replace(/\/$/,'');}catch{return null;}}
async function pool(sb:any){const {data,error}=await sb.from('ld_inference_pools').select('*').eq('code',POOL).maybeSingle();if(error||!data)throw new Error('POOL_NOT_FOUND');return data;}
async function snap(sb:any){await sb.rpc('ld_reap_inference_leases',{p_pool_code:POOL}).catch(()=>null);const {data,error}=await sb.rpc('ld_inference_pool_snapshot',{p_pool_code:POOL});if(error)throw new Error('POOL_SNAPSHOT_FAILED');return data;}
async function reconcile(sb:any,reason:string){
  const s=await snap(sb),p=await pool(sb);let desired=Number(s?.desired_workers||0),current=Number(s?.current_workers||0);
  if(desired<current){
    const {data:last}=await sb.from('ld_inference_workers').select('last_assigned_at').eq('pool_id',p.id).not('last_assigned_at','is',null).order('last_assigned_at',{ascending:false}).limit(1).maybeSingle();
    if(Number(s?.inflight||0)>0||Number(s?.queued_jobs||0)>0||(last?.last_assigned_at&&Date.now()-Date.parse(last.last_assigned_at)<Number(p.scale_down_cooldown_seconds||300)*1000))desired=current;
  }
  if(desired===current)return {ok:true,changed:false,desired_workers:desired,current_workers:current,snapshot:s};
  const {data:lastDecision}=await sb.from('ld_inference_scale_decisions').select('desired_workers,created_at').eq('pool_id',p.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(lastDecision&&Number(lastDecision.desired_workers)===desired&&Date.now()-Date.parse(lastDecision.created_at)<30_000)return {ok:true,changed:false,deduped:true,desired_workers:desired,current_workers:current,snapshot:s};
  const scalerUrl=await backendSecret(sb,'DECRYPTER_GPU_SCALER_URL'),scalerToken=await backendSecret(sb,'DECRYPTER_GPU_SCALER_TOKEN');let actuator_status='not_configured',actuator_code:string|null=null;
  if(scalerUrl&&scalerToken){try{const r=await fetch(scalerUrl,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${scalerToken}`},body:JSON.stringify({schema:'ld-gpu-scale/1',pool_code:POOL,current_workers:current,ready_workers:Number(s?.ready_workers||0),queued_jobs:Number(s?.queued_jobs||0),inflight:Number(s?.inflight||0),desired_workers:desired,reason,idempotency_key:`${POOL}:${desired}:${Math.floor(Date.now()/30000)}`})});actuator_status=r.ok?'accepted':'failed';actuator_code=`HTTP_${r.status}`;}catch(e){actuator_status='failed';actuator_code=String((e as Error)?.name||'SCALER_FETCH_FAILED').slice(0,120);}}
  await sb.from('ld_inference_scale_decisions').insert({pool_id:p.id,current_workers:current,ready_workers:Number(s?.ready_workers||0),queued_jobs:Number(s?.queued_jobs||0),inflight:Number(s?.inflight||0),desired_workers:desired,reason,actuator_status,actuator_code});
  return {ok:true,changed:true,desired_workers:desired,current_workers:current,actuator_status,actuator_code,snapshot:s};
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!service)return json({ok:false,code:'BACKEND_NOT_CONFIGURED'},503);const sb=createClient(url,service,{auth:{persistSession:false}});const body=await req.json().catch(()=>({}));const action=String(body.action||'status');
    if(action==='register'){
      if(!await workerAuthorized(req,sb))return json({ok:false,code:'WORKER_AUTH_REQUIRED'},401);const p=await pool(sb);const ep=endpoint(body.endpoint);const instanceKey=String(body.instance_key||'').trim().slice(0,180);if(!ep||!instanceKey)return json({ok:false,code:'WORKER_REGISTRATION_INVALID'},400);const capacity=Math.max(1,Math.min(Number(p.max_inflight_per_worker||4),Number(body.max_inflight||p.max_inflight_per_worker||4)));const health=body.healthy===true;const row={pool_id:p.id,instance_key:instanceKey,endpoint:ep,status:health?'ready':'joining',max_inflight:capacity,zone:String(body.zone||'').slice(0,80)||null,last_heartbeat_at:new Date().toISOString(),metrics:body.metrics&&typeof body.metrics==='object'?body.metrics:{},metadata:{runtime:'vllm',served_model:String(body.served_model||p.served_model),agent_version:String(body.agent_version||'build23')}};const {data,error}=await sb.from('ld_inference_workers').upsert(row,{onConflict:'pool_id,instance_key'}).select('id,status,max_inflight').single();if(error)throw new Error('WORKER_REGISTER_FAILED');return json({ok:true,worker:data,pool_code:POOL,heartbeat_timeout_seconds:p.heartbeat_timeout_seconds});
    }
    if(action==='heartbeat'){
      if(!await workerAuthorized(req,sb))return json({ok:false,code:'WORKER_AUTH_REQUIRED'},401);const id=String(body.worker_id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json({ok:false,code:'WORKER_ID_INVALID'},400);const healthy=body.healthy===true;const metrics=body.metrics&&typeof body.metrics==='object'?body.metrics:{};const {data,error}=await sb.from('ld_inference_workers').update({status:healthy?'ready':'offline',last_heartbeat_at:new Date().toISOString(),metrics,last_error:healthy?null:String(body.error_code||'RUNTIME_UNHEALTHY').slice(0,160),updated_at:new Date().toISOString()}).eq('id',id).select('id,status,inflight,max_inflight').maybeSingle();if(error||!data)return json({ok:false,code:'WORKER_NOT_FOUND'},404);const s=await snap(sb);return json({ok:true,worker:data,pool:s});
    }
    if(action==='drain'){
      if(!await ownerAuthorized(req,sb))return json({ok:false,code:'OWNER_AUTH_REQUIRED'},401);const id=String(body.worker_id||'');const {data,error}=await sb.from('ld_inference_workers').update({status:'draining',updated_at:new Date().toISOString()}).eq('id',id).select('id,status,inflight').maybeSingle();if(error||!data)return json({ok:false,code:'WORKER_NOT_FOUND'},404);return json({ok:true,worker:data});
    }
    if(action==='reconcile'){
      if(!await ownerAuthorized(req,sb))return json({ok:false,code:'OWNER_AUTH_REQUIRED'},401);return json(await reconcile(sb,'manual-reconcile'));
    }
    if(action==='status'){
      if(!await ownerAuthorized(req,sb)&&!await workerAuthorized(req,sb))return json({ok:false,code:'CONTROL_AUTH_REQUIRED'},401);const s=await snap(sb);const p=await pool(sb);const {data:workers}=await sb.from('ld_inference_workers').select('id,instance_key,status,inflight,max_inflight,zone,last_heartbeat_at,last_assigned_at,metrics').eq('pool_id',p.id).order('created_at');return json({ok:true,schema:'ld-local-control/1',pool:s,workers:workers||[],autoscaling:{actuator_configured:Boolean((await backendSecret(sb,'DECRYPTER_GPU_SCALER_URL'))&&(await backendSecret(sb,'DECRYPTER_GPU_SCALER_TOKEN'))),provider_neutral:true}});
    }
    return json({ok:false,code:'UNKNOWN_ACTION'},400);
  }catch(e){console.error('ld-local-control',e);return json({ok:false,code:String((e as Error)?.message||'INTERNAL_ERROR')},500);}
});
