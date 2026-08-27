import postgres from "npm:postgres@3.4.9";
import { compareSubset, nonEmpty, rows } from "./config.ts";
import { getSecret, management, missing, query, save, session } from "./auth.ts";

function list(value:any){
  if(Array.isArray(value))return value.map(x=>String(x).trim()).filter(Boolean).sort();
  const raw=String(value??"").trim();
  if(!raw)return[];
  return raw.replace(/^\{|\}$/g,"").split(",").map(x=>x.trim().replace(/^"|"$/g,"")).filter(Boolean).sort();
}
function sameList(a:any,b:any){return JSON.stringify(list(a))===JSON.stringify(list(b))}
function expr(value:any){return String(value??"").replace(/\s+/g," ").trim()}

async function sourceSnapshot(sb:any,j:any){
  const url=await getSecret(sb,String(j.source_db_secret_name));
  const sql=postgres(url,{prepare:false,max:1,connect_timeout:12,idle_timeout:5});
  try{
    const objects=await sql.unsafe(`select bucket_id,count(*)::bigint as objects,coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0)::bigint as bytes from storage.objects group by bucket_id order by bucket_id`);
    const buckets=await sql.unsafe(`select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id`);
    return{objects,buckets};
  }finally{await sql.end({timeout:2}).catch(()=>{})}
}

export async function verifyComplete(sb:any,j:any,a:any){
  const s=await session(sb,a),expectedConfig=j.inventory?.configExpected||{};
  if(nonEmpty(expectedConfig.postgrest)){const miss=missing(s.scope,["rest:read"]);if(miss.length){const e:any=new Error("SUPABASE_REAUTH_REQUIRED");e.missingScopes=miss;throw e}}
  const ref=String(j.destination_project_ref),src=await sourceSnapshot(sb,j),bad:string[]=[];
  const destObjects=rows(await query(s.token,ref,`select bucket_id,count(*)::bigint as objects,coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0)::bigint as bytes from storage.objects group by bucket_id order by bucket_id`));
  const destBuckets=rows(await query(s.token,ref,`select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id`));
  const destPolicies=rows(await query(s.token,ref,`select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_catalog.pg_policies where schemaname='storage' and tablename in ('objects','buckets') order by tablename,policyname`));
  const destRealtime=rows(await query(s.token,ref,`select schemaname,tablename from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename`));

  const om=new Map(destObjects.map((x:any)=>[String(x.bucket_id),{objects:Number(x.objects||0),bytes:Number(x.bytes||0)}]));
  for(const x of src.objects){const y:any=om.get(String(x.bucket_id));if(!y||y.objects<Number(x.objects||0)||y.bytes<Number(x.bytes||0))bad.push(`storage_objects:${x.bucket_id}`)}
  const bm=new Map(destBuckets.map((x:any)=>[String(x.id),x]));
  for(const x of src.buckets){
    const y:any=bm.get(String(x.id));
    if(!y){bad.push(`storage_bucket:${x.id}`);continue}
    if(String(y.name||y.id)!==String(x.name||x.id))bad.push(`storage_bucket_name:${x.id}`);
    if(Boolean(y.public)!==Boolean(x.public))bad.push(`storage_bucket_public:${x.id}`);
    if(x.file_size_limit!=null&&Number(y.file_size_limit)!==Number(x.file_size_limit))bad.push(`storage_bucket_limit:${x.id}`);
    if(!sameList(y.allowed_mime_types,x.allowed_mime_types))bad.push(`storage_bucket_mime:${x.id}`);
  }
  const pm=new Map(destPolicies.map((x:any)=>[`${x.tablename}|${x.policyname}`,x]));
  for(const p of Array.isArray(j.inventory?.storagePolicies)?j.inventory.storagePolicies:[]){
    const y:any=pm.get(`${p.tablename}|${p.policyname}`);
    if(!y){bad.push(`storage_policy:${p.policyname}`);continue}
    if(String(y.cmd||"").toUpperCase()!==String(p.cmd||"").toUpperCase())bad.push(`storage_policy_cmd:${p.policyname}`);
    if(String(y.permissive||"PERMISSIVE").toUpperCase()!==String(p.permissive||"PERMISSIVE").toUpperCase())bad.push(`storage_policy_mode:${p.policyname}`);
    if(!sameList(y.roles,p.roles))bad.push(`storage_policy_roles:${p.policyname}`);
    if(expr(y.qual)!==expr(p.qual))bad.push(`storage_policy_using:${p.policyname}`);
    if(expr(y.with_check)!==expr(p.with_check))bad.push(`storage_policy_check:${p.policyname}`);
  }
  const rk=new Set(destRealtime.map((x:any)=>`${x.schemaname}.${x.tablename}`));
  for(const t of Array.isArray(j.inventory?.realtime)?j.inventory.realtime:[])if(!rk.has(`${t.schemaname}.${t.tablename}`))bad.push(`realtime:${t.tablename}`);

  const fraw=await management(s.token,`/projects/${encodeURIComponent(ref)}/functions`),funcs=Array.isArray(fraw)?fraw:Array.isArray(fraw?.functions)?fraw.functions:[],fset=new Set(funcs.map((x:any)=>String(x.slug||x.name||"")));
  const expectedFunctions=Array.isArray(j.inventory?.functionsExpected)?j.inventory.functionsExpected:[];
  for(const slug of expectedFunctions)if(!fset.has(String(slug)))bad.push(`edge_function:${slug}`);

  const expectedSecrets=Array.isArray(j.inventory?.secretNamesExpected)?j.inventory.secretNamesExpected:[];
  if(expectedSecrets.length){
    const raw=await management(s.token,`/projects/${encodeURIComponent(ref)}/secrets`),set=new Set((Array.isArray(raw)?raw:[]).map((x:any)=>String(x.name||"")));
    const copied=Math.max(0,Number(j.progress?.secrets_done||0)),present=expectedSecrets.filter((name:any)=>set.has(String(name)));
    if(copied>=expectedSecrets.length){for(const name of expectedSecrets)if(!set.has(String(name)))bad.push(`secret:${name}`)}
    else if(present.length<copied)bad.push(`secret_count:${present.length}/${copied}`);
  }

  const configVerified:any={};
  if(nonEmpty(expectedConfig.auth)){const actual=await management(s.token,`/projects/${encodeURIComponent(ref)}/config/auth`),x=compareSubset(expectedConfig.auth,actual,["uri_allow_list"]);if(x.length)bad.push(...x.map(k=>`auth_config:${k}`));else configVerified.auth=true}
  if(nonEmpty(expectedConfig.storage)){const actual=await management(s.token,`/projects/${encodeURIComponent(ref)}/config/storage`),x=compareSubset(expectedConfig.storage,actual);if(x.length)bad.push(...x.map(k=>`storage_config:${k}`));else configVerified.storage=true}
  if(nonEmpty(expectedConfig.postgrest)){const actual=await management(s.token,`/projects/${encodeURIComponent(ref)}/postgrest`),x=compareSubset(expectedConfig.postgrest,actual,["db_schema","db_extra_search_path"]);if(x.length)bad.push(...x.map(k=>`postgrest_config:${k}`));else configVerified.postgrest=true}
  if(nonEmpty(expectedConfig.realtime)){const actual=await management(s.token,`/projects/${encodeURIComponent(ref)}/config/realtime`),x=compareSubset(expectedConfig.realtime,actual);if(x.length)bad.push(...x.map(k=>`realtime_config:${k}`));else configVerified.realtime=true}

  if(Number(j.progress?.objects_done||0)<Number(j.inventory?.totalObjects||0))bad.push("checkpoint:storage_objects");
  const deployed=Array.isArray(j.progress?.functions_deployed)?j.progress.functions_deployed:[];
  for(const slug of expectedFunctions)if(!deployed.includes(slug))bad.push(`checkpoint:function:${slug}`);

  if(bad.length){const saved=await save(sb,j,{status:"waiting",phase:"verify",last_error:`VERIFY_MISMATCH:${bad.slice(0,20).join(",")}`,progress:{...(j.progress||{}),strong_verification_ok:false,verification_mismatches:bad.slice(0,50),current:"Verificação encontrou divergências"}},`Verificação forte encontrou ${bad.length} divergência(s); job preservado para retomada.`);return{ok:false,code:"VERIFY_MISMATCH",mismatches:bad,job:saved}}
  const saved=await save(sb,j,{status:"running",phase:"verify",last_error:null,progress:{...(j.progress||{}),strong_verification_ok:true,verification_mismatches:[],config_verified:configVerified,current:"Verificação completa aprovada"}},"Verificação forte aprovada: Storage, policies, Realtime, Functions, Secrets e configs compatíveis conferidos.");
  return{ok:true,job:saved};
}
