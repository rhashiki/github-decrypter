import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,OPTIONS"};
const enc=new TextEncoder();
const VERSION_RE=/^\d+\.\d+\.\d+(?:\.\d+)?$/;
const SHA_RE=/^[0-9a-f]{64}$/i;
const CHANNELS=new Set(["stable","beta"]);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
function b64url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function validRelease(v:any,channel:string,version=""){return !!(v&&VERSION_RE.test(String(v.version||""))&&(!version||String(v.version)===version)&&String(v.channel||channel)===channel&&/^https:\/\/github\.com\/rhashiki\/lovable-decrypter-extension\/releases\/download\/v[^/]+\/Lovable-Decrypter-v[^/]+\.zip$/.test(String(v.download_url||""))&&SHA_RE.test(String(v.sha256||"")));}
async function backendSecret(sb:any,name:string){const env=Deno.env.get(name);if(env)return env;const {data,error}=await sb.rpc("ld_backend_secret",{p_name:name});if(error)return "";return String(data||"");}
async function dbRelease(sb:any,channel:string,version:string){let q=sb.from("ld_release_channels").select("channel,version,download_url,sha256,notes,active,created_at,updated_at").eq("channel",channel);if(version)q=q.eq("version",version);else q=q.eq("active",true).order("updated_at",{ascending:false}).limit(1);const {data,error}=version?await q.maybeSingle():await q.maybeSingle();if(error)throw error;return validRelease(data,channel,version)?data:null;}
async function githubStableFallback(){try{const r=await fetch("https://raw.githubusercontent.com/rhashiki/lovable-decrypter-extension/main/updates/release.json",{headers:{"user-agent":"lovable-decrypter-release-feed"},cache:"no-store"});if(!r.ok)return null;const candidate=await r.json();const normalized={...candidate,channel:"stable"};return validRelease(normalized,"stable","")?normalized:null;}catch{return null;}}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="GET")return json({ok:false,code:"METHOD_NOT_ALLOWED"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!service)return json({ok:false,code:"BACKEND_NOT_CONFIGURED"},503);
    const requestUrl=new URL(req.url);
    const channel=String(requestUrl.searchParams.get("channel")||"stable").toLowerCase();
    const version=String(requestUrl.searchParams.get("version")||"").trim();
    if(!CHANNELS.has(channel))return json({ok:false,code:"INVALID_CHANNEL"},400);
    if(version&&!VERSION_RE.test(version))return json({ok:false,code:"INVALID_VERSION"},400);

    const sb=createClient(url,service,{auth:{persistSession:false}});
    const privateJwk=await backendSecret(sb,"LD_LICENSE_PRIVATE_JWK");
    if(!privateJwk)return json({ok:false,code:"SIGNING_SECRET_NOT_CONFIGURED"},503);

    let release=await dbRelease(sb,channel,version);
    if(!release&&!version&&channel==="stable")release=await githubStableFallback();
    if(!release)return json({ok:false,code:"RELEASE_NOT_FOUND",channel,version:version||null},404);

    const payload={
      v:1,
      aud:"lovable-decrypter",
      license_id:`release-${channel}-${release.version}`,
      type:"release",
      channel,
      version:String(release.version),
      download_url:String(release.download_url),
      sha256:String(release.sha256).toLowerCase(),
      notes:release.notes||`Release ${channel} v${release.version}`,
      iat:Math.floor(Date.now()/1000),
      features:["release","sha256","channels","rollback-lookup"]
    };
    const payloadPart=b64url(enc.encode(JSON.stringify(payload)));
    const key=await crypto.subtle.importKey("jwk",JSON.parse(privateJwk),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
    const signature=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(payloadPart)));
    return json({payload:payloadPart,signature:b64url(signature)});
  }catch(e){console.error("ld-release-feed",e);return json({ok:false,code:"INTERNAL_ERROR"},500);}
});
