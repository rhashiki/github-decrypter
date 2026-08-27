import { admin, authorize, job, missing, safeJob, save, session } from "./auth.ts";
import { applyServiceConfig } from "./apply.ts";
import { verifyComplete } from "./verify.ts";

const REST_SCOPES=["rest:read","rest:write"];
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-license-key,x-device-id,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json({ok:false,code:"METHOD_NOT_ALLOWED"},405);
  const sb=admin();
  try{
    const auth=await authorize(req,sb),body=await req.json().catch(()=>({})),action=String(body.action||"status");
    if(action==="preflight"){
      const current=await session(sb,auth),miss=missing(current.scope,REST_SCOPES);
      if(miss.length)return json({ok:false,code:"SUPABASE_REAUTH_REQUIRED",missing_scopes:miss,required_scopes:REST_SCOPES},403);
      return json({ok:true,required_scopes:REST_SCOPES,scope_ok:true});
    }
    const j=await job(sb,String(body.job_id||""),auth);
    if(action==="prepare_config"){
      const updated=await save(sb,j,{progress:{...(j.progress||{}),config_expected:true,config_applied:false,strong_verification_ok:false}},"Configuração completa marcada para aplicação na fase CONFIG.");
      return json({ok:true,job:safeJob(updated)});
    }
    if(action==="record_expectations"){
      const names=[...new Set((Array.isArray(body.secret_names)?body.secret_names:[]).map((x:any)=>String(x)).filter((x:string)=>/^[A-Z][A-Z0-9_]{1,127}$/.test(x)))].sort();
      const updated=await save(sb,j,{inventory:{...(j.inventory||{}),secretNamesExpected:names}},`${names.length} Secret name(s) confirmado(s) para verificação.`);
      return json({ok:true,job:safeJob(updated)});
    }
    if(action==="apply_service_config"){
      try{const updated=await applyServiceConfig(sb,j,auth,body.config||{},body.warnings||[]);return json({ok:true,job:safeJob(updated)})}
      catch(error:any){if(error?.missingScopes)return json({ok:false,code:"SUPABASE_REAUTH_REQUIRED",missing_scopes:error.missingScopes},403);throw error}
    }
    if(action==="verify_complete"){
      try{const result=await verifyComplete(sb,j,auth);return json({...result,job:safeJob(result.job)},result.ok?200:409)}
      catch(error:any){if(error?.missingScopes)return json({ok:false,code:"SUPABASE_REAUTH_REQUIRED",missing_scopes:error.missingScopes},403);throw error}
    }
    if(action==="status")return json({ok:true,job:safeJob(j),required_scopes:REST_SCOPES});
    return json({ok:false,code:"UNKNOWN_ACTION"},400);
  }catch(error:any){const code=String(error?.message||error),status=/KEY_|DEVICE_|ENTITLEMENT/.test(code)?403:400;return json({ok:false,code},status)}
});
