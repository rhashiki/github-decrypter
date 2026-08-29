import { VERSION, TRUST_PROTOCOL_VERSION, DEFAULT_BACKEND_BASE } from '../settings/config.js';

const SESSION_KEY='ld2_trust_session_v1';
const REFRESH_SKEW_SECONDS=60;
const CRITICAL_ASSETS=Object.freeze([
  'manifest.json',
  'security/license.js',
  'core/model-gateway.js',
  'background/model-gateway-bootstrap.js',
  'background/service-worker-entry.js',
  'content/composer-guardian.js'
]);
let memorySession=null;

function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function sha256(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value))));}
function randomNonce(){const bytes=crypto.getRandomValues(new Uint8Array(24));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
async function sessionGet(){try{if(chrome?.storage?.session){const data=await chrome.storage.session.get(SESSION_KEY);return data[SESSION_KEY]||null;}}catch(_){}return memorySession;}
async function sessionSet(value){memorySession=value||null;try{if(chrome?.storage?.session){if(value)await chrome.storage.session.set({[SESSION_KEY]:value});else await chrome.storage.session.remove(SESSION_KEY);}}catch(_){} }

export async function computeClientIntegrityFingerprint(){
  const rows=[];
  for(const path of CRITICAL_ASSETS){
    const response=await fetch(chrome.runtime.getURL(path),{cache:'no-store'});
    if(!response.ok)throw new Error(`TRUST_ASSET_UNAVAILABLE:${path}`);
    const text=await response.text();
    rows.push({path,sha256:await sha256(text),bytes:new TextEncoder().encode(text).byteLength});
  }
  const canonical=rows.map(row=>`${row.path}:${row.sha256}`).join('\n');
  return Object.freeze({algorithm:'sha256',fingerprint:await sha256(canonical),critical_assets:rows.length,assets:rows});
}

function cacheValid(cached,settings){
  if(!cached?.token||!String(cached.token).startsWith('LDT1.'))return false;
  const exp=Date.parse(cached.expiresAt||'');
  if(!Number.isFinite(exp)||exp<=Date.now()+REFRESH_SKEW_SECONDS*1000)return false;
  if(String(cached.licenseId||'')!==String(settings?.auth?.licenseId||''))return false;
  if(String(cached.deviceId||'')!==String(settings?.auth?.deviceId||''))return false;
  if(String(cached.clientVersion||'')!==TRUST_PROTOCOL_VERSION)return false;
  return true;
}

export async function clearTrustSession(){await sessionSet(null);}

export async function ensureTrustSession(settings={},options={}){
  const force=options?.force===true;
  const auth=settings?.auth||{};
  const licenseKey=String(auth.licenseKey||'');
  const licenseId=String(auth.licenseId||'');
  const deviceId=String(auth.deviceId||'');
  const backendBase=String(auth.backendBase||DEFAULT_BACKEND_BASE).replace(/\/+$/,'');
  if(!licenseKey||!licenseId||!deviceId||!backendBase)throw new Error('TRUST_AUTH_UNAVAILABLE');
  if(!force){const cached=await sessionGet();if(cacheValid(cached,settings))return cached;}
  const integrity=await computeClientIntegrityFingerprint();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(`${backendBase}/ld-trust-attest`,{
      method:'POST',
      headers:{'content-type':'application/json','x-license-key':licenseKey,'x-device-id':deviceId},
      body:JSON.stringify({client_version:TRUST_PROTOCOL_VERSION,client_fingerprint:integrity.fingerprint,nonce:randomNonce(),integrity:{algorithm:integrity.algorithm,critical_assets:integrity.critical_assets}}),
      signal:controller.signal
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body?.ok!==true||!String(body?.trust_token||'').startsWith('LDT1.'))throw new Error(body?.code||`TRUST_HTTP_${response.status}`);
    const expiresAt=String(body.expires_at||'');if(!Number.isFinite(Date.parse(expiresAt)))throw new Error('TRUST_RESPONSE_INVALID');
    const session=Object.freeze({token:String(body.trust_token),expiresAt,licenseId,deviceId,appVersion:VERSION,clientVersion:TRUST_PROTOCOL_VERSION,clientFingerprint:integrity.fingerprint,policy:body.policy||{}});
    await sessionSet(session);return session;
  }catch(error){await clearTrustSession();if(error?.name==='AbortError')throw new Error('TRUST_ATTEST_TIMEOUT');throw error;}finally{clearTimeout(timer);}
}

export async function trustPublicSummary(settings={}){
  const cached=await sessionGet();
  if(!cacheValid(cached,settings))return {required:true,active:false,app_version:VERSION,client_version:TRUST_PROTOCOL_VERSION};
  return {required:true,active:true,app_version:VERSION,client_version:TRUST_PROTOCOL_VERSION,expires_at:cached.expiresAt,client_fingerprint_prefix:String(cached.clientFingerprint||'').slice(0,12)};
}

export const TRUST_CRITICAL_ASSETS=CRITICAL_ASSETS;
