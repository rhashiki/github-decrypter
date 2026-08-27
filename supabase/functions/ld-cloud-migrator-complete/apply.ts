import { management, missing, save, session } from "./auth.ts";
import { nonEmpty, REST_SCOPES, safeConfig } from "./config.ts";

export async function applyServiceConfig(sb:any,j:any,a:any,input:any,inputWarnings:any[]=[]){
  const cfg=safeConfig(input),s=await session(sb,a);
  if(nonEmpty(cfg.postgrest)){const miss=missing(s.scope,REST_SCOPES);if(miss.length){const e:any=new Error("SUPABASE_REAUTH_REQUIRED");e.missingScopes=miss;throw e}}
  const ref=String(j.destination_project_ref),applied:any={},skipped:any={};
  const warnings=[...(Array.isArray(j.warnings)?j.warnings:[]),...(Array.isArray(inputWarnings)?inputWarnings.map(String):[])];
  if(nonEmpty(cfg.auth)){
    await management(s.token,`/projects/${encodeURIComponent(ref)}/config/auth`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg.auth)});
    applied.auth=cfg.auth;
  }
  if(nonEmpty(cfg.storage)){
    try{
      await management(s.token,`/projects/${encodeURIComponent(ref)}/config/storage`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg.storage)});
      applied.storage=cfg.storage;
    }catch(error:any){
      if(/SUPABASE_MANAGEMENT_HTTP_403/.test(String(error?.message||error))){skipped.storage="permission_unavailable";warnings.push("Storage global config não pôde ser alterado pelo token OAuth atual; buckets e limites por bucket continuam migrados.")}else throw error;
    }
  }
  if(nonEmpty(cfg.postgrest)){
    await management(s.token,`/projects/${encodeURIComponent(ref)}/postgrest`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg.postgrest)});
    applied.postgrest=cfg.postgrest;
  }
  if(nonEmpty(cfg.realtime)){
    try{
      await management(s.token,`/projects/${encodeURIComponent(ref)}/config/realtime`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg.realtime)});
      applied.realtime=cfg.realtime;
    }catch(error:any){
      if(/SUPABASE_MANAGEMENT_HTTP_403/.test(String(error?.message||error))){skipped.realtime="permission_unavailable";warnings.push("Realtime global config não pôde ser alterado pelo token OAuth atual; a publication supabase_realtime continua sendo migrada.")}else throw error;
    }
  }
  return save(sb,j,{
    status:"running",
    inventory:{...(j.inventory||{}),configExpected:applied,configSkipped:skipped},
    progress:{...(j.progress||{}),config_expected:true,config_applied:true,config_sections:Object.keys(applied),current:"Configuração portátil aplicada"},
    warnings:[...new Set(warnings)]
  },`Configuração portátil aplicada: ${Object.keys(applied).join(", ")||"nenhuma"}.`);
}
