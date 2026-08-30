import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SCHEMA='ld-tool-runtime/1';
const BUILD=61;
const EXPECTED_CLIENT_VERSION='2.4.21';
const PUBLIC_SPKI_B64='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/suDKmZG7B52xCVkCooS5MZfvVu+GjYTIfeOvlfi9tz29TQNN4uea318Nn2xf5uf/cm0bpaCADPwkqWSZV2MIA==';
const MAX_ARGS_BYTES=250_000;
const MAX_RESULT_BYTES=1_000_000;
const TOOLS=new Map([
  ['workspace.list',{lsp:false}],
  ['workspace.read',{lsp:false}],
  ['workspace.grep',{lsp:false}],
  ['lsp.diagnostics',{lsp:true}],
  ['lsp.definition',{lsp:true}],
  ['lsp.references',{lsp:true}],
]);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-license-key,x-device-id,x-decrypter-trust,x-decrypter-client-version,authorization','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const enc=new TextEncoder();

function b64u(value:string){const s=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function publicKey(){const der=Uint8Array.from(atob(PUBLIC_SPKI_B64),c=>c.charCodeAt(0));return crypto.subtle.importKey('spki',der,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}
async function sha(value:string){const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function verifySigned(prefix:string,aud:string,token:string){const [p,payloadPart,signaturePart]=token.trim().split('.');if(p!==prefix||!payloadPart||!signaturePart)throw new Error(prefix==='LD2'?'KEY_INVALID_FORMAT':'TRUST_INVALID_FORMAT');const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await publicKey(),b64u(signaturePart),enc.encode(payloadPart));if(!ok)throw new Error(prefix==='LD2'?'KEY_INVALID_SIGNATURE':'TRUST_INVALID_SIGNATURE');const payload=JSON.parse(new TextDecoder().decode(b64u(payloadPart)));if(payload?.aud!==aud||Number(payload?.v)!==1)throw new Error(prefix==='LD2'?'KEY_INVALID_PAYLOAD':'TRUST_INVALID_PAYLOAD');return payload;}
async function authorize(req:Request,body:any,sb:any){const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();const token=String(req.headers.get('x-license-key')||body.license_key||bearer||'').trim();if(!token)throw new Error('KEY_REQUIRED');const signed=await verifySigned('LD2','lovable-decrypter',token);if(!signed?.license_id)throw new Error('KEY_INVALID_PAYLOAD');const now=Math.floor(Date.now()/1000);if(signed.nbf&&now<Number(signed.nbf))throw new Error('KEY_NOT_ACTIVE');if(signed.exp&&now>=Number(signed.exp))throw new Error('KEY_EXPIRED');const {data:license,error}=await sb.from('ld_license_keys').select('id,status,expires_at,credit_balance,credit_debt').eq('id',String(signed.license_id)).eq('key_hash',await sha(token)).maybeSingle();if(error)throw new Error('DB_ERROR');if(!license)throw new Error('KEY_NOT_REGISTERED');if(license.status!=='active')throw new Error('KEY_'+String(license.status).toUpperCase());const timeActive=Boolean(license.expires_at&&Date.parse(license.expires_at)>Date.now());if(!timeActive&&!(Number(license.credit_balance||0)>0&&Number(license.credit_debt||0)===0))throw new Error('ENTITLEMENT_EXHAUSTED');const deviceId=String(req.headers.get('x-device-id')||body.device_id||'').trim();if(!deviceId)throw new Error('DEVICE_REQUIRED');const deviceHash=await sha(deviceId);const {data:device,error:deviceError}=await sb.from('ld_license_devices').select('id,revoked_at').eq('license_id',license.id).eq('device_hash',deviceHash).maybeSingle();if(deviceError)throw new Error('DB_ERROR');if(!device)throw new Error('DEVICE_NOT_BOUND');if(device.revoked_at)throw new Error('DEVICE_REVOKED');return {licenseId:String(license.id),deviceHash};}
async function verifyTrust(req:Request,sb:any,auth:any){const token=String(req.headers.get('x-decrypter-trust')||'').trim();const clientVersion=String(req.headers.get('x-decrypter-client-version')||'').trim();if(!token)throw new Error('TRUST_REQUIRED');if(clientVersion!==EXPECTED_CLIENT_VERSION)throw new Error('TRUST_CLIENT_VERSION_REQUIRED');const payload=await verifySigned('LDT1','lovable-decrypter-trust',token);const now=Math.floor(Date.now()/1000);if(!payload?.sid||!payload?.license_id||!payload?.device_hash||!payload?.client_fingerprint||!payload?.client_version)throw new Error('TRUST_INVALID_PAYLOAD');if(Number(payload.exp||0)<=now)throw new Error('TRUST_EXPIRED');if(String(payload.license_id)!==auth.licenseId||String(payload.device_hash)!==auth.deviceHash)throw new Error('TRUST_BINDING_MISMATCH');if(String(payload.client_version)!==EXPECTED_CLIENT_VERSION||String(payload.client_version)!==clientVersion)throw new Error('TRUST_VERSION_MISMATCH');const {data:session,error}=await sb.from('ld_trust_sessions').select('id,license_id,device_hash,client_version,client_fingerprint,expires_at,revoked_at').eq('id',String(payload.sid)).maybeSingle();if(error)throw new Error('DB_ERROR');if(!session)throw new Error('TRUST_SESSION_NOT_FOUND');if(session.revoked_at||Date.parse(session.expires_at)<=Date.now())throw new Error('TRUST_EXPIRED');if(String(session.license_id)!==auth.licenseId||String(session.device_hash)!==auth.deviceHash||String(session.client_version)!==clientVersion||String(session.client_fingerprint)!==String(payload.client_fingerprint))throw new Error('TRUST_SESSION_MISMATCH');await sb.from('ld_trust_sessions').update({last_seen_at:new Date().toISOString()}).eq('id',session.id);return {verified:true,clientVersion};}
async function backendSecret(sb:any,name:string){const env=String(Deno.env.get(name)||'').trim();if(env)return env;const {data,error}=await sb.rpc('ld_backend_secret',{p_name:name});if(error)return '';return String(data||'').trim();}
function safeWorkerUrl(value:string){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return '';u.search='';u.hash='';return u.toString().replace(/\/+$/,'');}catch{return '';}}
async function workerConfig(sb:any){const rawUrl=await backendSecret(sb,'DECRYPTER_TOOL_WORKER_URL');const token=await backendSecret(sb,'DECRYPTER_TOOL_WORKER_TOKEN');const url=safeWorkerUrl(rawUrl);return {configured:Boolean(url&&token),url,token};}
async function workerHealth(cfg:any){if(!cfg.configured)return {configured:false,healthy:false,code:'TOOL_WORKER_NOT_CONFIGURED'};const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{const res=await fetch(`${cfg.url}/health`,{headers:{authorization:`Bearer ${cfg.token}`},signal:controller.signal});const out=await res.json().catch(()=>({}));return {configured:true,healthy:res.ok&&out?.ok===true,code:res.ok?'OK':String(out?.code||`TOOL_WORKER_HTTP_${res.status}`),schema:out?.schema||null,tools:Array.isArray(out?.tools)?out.tools:[]};}catch(e){return {configured:true,healthy:false,code:(e as Error)?.name==='AbortError'?'TOOL_WORKER_TIMEOUT':'TOOL_WORKER_UNREACHABLE'};}finally{clearTimeout(timer);}}
async function audit(sb:any,row:any){try{await sb.from('ld_tool_invocations').insert(row);}catch(e){console.error('ld-tool-runtime audit',e);}}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!service)return json({ok:false,code:'BACKEND_NOT_CONFIGURED'},503);
    const sb=createClient(url,service,{auth:{persistSession:false}});
    const body=await req.json().catch(()=>({}));
    const auth=await authorize(req,body,sb);
    const trust=await verifyTrust(req,sb,auth);
    const action=String(body.action||'status').toLowerCase();
    const cfg=await workerConfig(sb);

    if(action==='status'){
      const worker=await workerHealth(cfg);
      return json({ok:true,schema:SCHEMA,build:BUILD,authority:'server',worker,tools:[...TOOLS.entries()].map(([name,meta])=>({name,read_only:true,lsp:meta.lsp})),policy:{explicit_invocation_only:true,read_only:true,write_tools:false,arbitrary_shell:false,arbitrary_command:false,network_tool:false,raw_input_persistence:false,raw_output_persistence:false,trust_required:true,scope_lock_required_for_future_writes:true},trust:{verified:true,client_version:trust.clientVersion}});
    }
    if(action!=='invoke')return json({ok:false,code:'UNKNOWN_ACTION'},400);

    const projectId=String(body.project_id||body.projectId||'').trim().slice(0,200);
    if(!projectId)return json({ok:false,code:'PROJECT_REQUIRED'},400);
    const tool=String(body.tool||'').trim();
    const args=body.args&&typeof body.args==='object'&&!Array.isArray(body.args)?body.args:{};
    const inputRaw=JSON.stringify({project_id:projectId,tool,args});
    const inputHash=await sha(inputRaw);
    if(inputRaw.length>MAX_ARGS_BYTES){await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool||'unknown',status:'blocked',input_hash:inputHash,error_code:'TOOL_ARGS_TOO_LARGE'});return json({ok:false,code:'TOOL_ARGS_TOO_LARGE'},413);}
    if(!TOOLS.has(tool)){await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool||'unknown',status:'blocked',input_hash:inputHash,error_code:'TOOL_NOT_ALLOWLISTED'});return json({ok:false,code:'TOOL_NOT_ALLOWLISTED'},403);}
    if(!cfg.configured){await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool,status:'failed',input_hash:inputHash,error_code:'TOOL_WORKER_NOT_CONFIGURED'});return json({ok:false,code:'TOOL_WORKER_NOT_CONFIGURED'},503);}

    const started=Date.now();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),35000);
    let workerResponse:Response;
    let out:any;
    try{
      workerResponse=await fetch(`${cfg.url}/v1/tools/invoke`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${cfg.token}`},signal:controller.signal,body:JSON.stringify({workspace_id:projectId,tool,args})});
      out=await workerResponse.json().catch(()=>({}));
    }catch(e){const code=(e as Error)?.name==='AbortError'?'TOOL_WORKER_TIMEOUT':'TOOL_WORKER_UNREACHABLE';await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool,status:'failed',input_hash:inputHash,duration_ms:Date.now()-started,error_code:code});return json({ok:false,code},502);}finally{clearTimeout(timer);}
    const duration=Date.now()-started;
    if(!workerResponse!.ok||out?.ok===false){const code=String(out?.code||`TOOL_WORKER_HTTP_${workerResponse!.status}`).slice(0,160);await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool,status:'failed',input_hash:inputHash,duration_ms:duration,error_code:code});return json({ok:false,code},workerResponse!.status>=500?502:workerResponse!.status);}
    const resultRaw=JSON.stringify(out?.result??null);
    if(resultRaw.length>MAX_RESULT_BYTES){await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool,status:'blocked',input_hash:inputHash,duration_ms:duration,error_code:'TOOL_RESULT_TOO_LARGE'});return json({ok:false,code:'TOOL_RESULT_TOO_LARGE'},502);}
    const outputHash=await sha(resultRaw);
    await audit(sb,{license_id:auth.licenseId,device_hash:auth.deviceHash,project_id:projectId,tool_name:tool,status:'completed',input_hash:inputHash,output_hash:outputHash,duration_ms:duration});
    return json({ok:true,schema:SCHEMA,tool,project_id:projectId,duration_ms:duration,result:out?.result??null,audit:{input_hash:inputHash,output_hash:outputHash,raw_persisted:false},policy:{read_only:true,explicit_invocation:true}});
  }catch(error){const code=String((error as Error)?.message||'INTERNAL_ERROR');const authish=/^(KEY_|DEVICE_|ENTITLEMENT_|TRUST_)/.test(code);console.error('ld-tool-runtime',code);return json({ok:false,code},authish?403:500);}
});
