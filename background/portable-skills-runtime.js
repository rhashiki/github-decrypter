import {
  PORTABLE_SKILL_SCHEMA,
  PORTABLE_SKILL_REGISTRY_SCHEMA,
  PORTABLE_SKILL_LIMITS,
  buildPortableSkillPackage,
  portableSkillFromLegacy,
  routePortableSkills,
  stagePortableSkillForRun,
  skillPublicRecord,
  assertSafeRemoteSkillSource,
  canonicalSkillPath
} from '../core/portable-skills.js';

const PORT_NAME='ld2-portable-skills-v2';
const STORAGE_KEY='ld72_portable_skills_v2';
const MAX_REGISTRY_SKILLS=160;
const text=(value,max=4000)=>String(value??'').trim().slice(0,max);

function err(code,details={}){return Object.assign(new Error(code),{code,...details});}

async function loadRegistry(){
  const out=await chrome.storage.local.get(STORAGE_KEY);
  const value=out?.[STORAGE_KEY];
  if(!value||value.schema!==PORTABLE_SKILL_REGISTRY_SCHEMA||typeof value.skills!=='object'){
    return {schema:PORTABLE_SKILL_REGISTRY_SCHEMA,revision:0,updatedAt:null,skills:{}};
  }
  const skills={};
  for(const [slug,skill] of Object.entries(value.skills||{})){
    if(skill?.schema===PORTABLE_SKILL_SCHEMA&&skill.slug===slug)skills[slug]=skill;
  }
  return {schema:PORTABLE_SKILL_REGISTRY_SCHEMA,revision:Number(value.revision)||0,updatedAt:value.updatedAt||null,skills};
}

async function saveRegistry(registry){
  const entries=Object.entries(registry.skills||{});
  if(entries.length>MAX_REGISTRY_SKILLS)throw err('SKILL_REGISTRY_LIMIT',{count:entries.length,max:MAX_REGISTRY_SKILLS});
  const next={schema:PORTABLE_SKILL_REGISTRY_SCHEMA,revision:(Number(registry.revision)||0)+1,updatedAt:new Date().toISOString(),skills:registry.skills||{}};
  await chrome.storage.local.set({[STORAGE_KEY]:next});
  return next;
}

async function upsertPackages(packages=[]){
  const registry=await loadRegistry();
  for(const skill of packages){
    if(skill?.schema!==PORTABLE_SKILL_SCHEMA)throw err('SKILL_PACKAGE_INVALID');
    registry.skills[skill.slug]=structuredClone(skill);
  }
  return saveRegistry(registry);
}

async function list({includeBody=false}={}){
  const registry=await loadRegistry();
  const all=Object.values(registry.skills).sort((a,b)=>String(a.display_name||a.slug).localeCompare(String(b.display_name||b.slug)));
  const publicRows=all.map(skill=>includeBody?structuredClone(skill):skillPublicRecord(skill));
  return {
    schema:PORTABLE_SKILL_REGISTRY_SCHEMA,
    revision:registry.revision,
    updatedAt:registry.updatedAt,
    all:publicRows,
    official:publicRows.filter(skill=>skill.official),
    custom:publicRows.filter(skill=>skill.custom),
    imported:publicRows.filter(skill=>!skill.official&&!skill.custom),
    localAuthority:true,
    cloudRequired:false
  };
}

async function getMany(slugs=[]){
  const registry=await loadRegistry();
  return (Array.isArray(slugs)?slugs:[]).map(slug=>registry.skills[String(slug||'')]).filter(Boolean).map(skill=>structuredClone(skill));
}

async function syncLegacy(skills=[]){
  const packages=[];
  for(const row of Array.isArray(skills)?skills:[]){
    try{packages.push(await portableSkillFromLegacy(row));}catch(error){packages.push({error:error?.code||error?.message||String(error),sourceSlug:text(row?.slug,120)});}
  }
  const valid=packages.filter(item=>item?.schema===PORTABLE_SKILL_SCHEMA);
  if(valid.length)await upsertPackages(valid);
  return {synced:valid.length,failed:packages.length-valid.length,skills:valid.map(skillPublicRecord)};
}

async function setPreference(slug,patch={}){
  const registry=await loadRegistry();
  const skill=registry.skills[String(slug||'')];
  if(!skill)throw err('SKILL_NOT_FOUND');
  skill.enabled=patch.enabled!==false;
  if(patch.pinned!=null)skill.pinned=Boolean(patch.pinned);
  if(patch.auto_activation!=null)skill.auto_activation=Boolean(patch.auto_activation);
  await saveRegistry(registry);
  return skillPublicRecord(skill);
}

function slugify(value='skill'){
  return text(value,64).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/--+/g,'-').slice(0,50).replace(/-+$/,'')||'skill';
}

async function createCustom(input={}){
  const slug=`custom-${slugify(input.slug||input.display_name||input.name)}`.slice(0,64).replace(/-+$/,'');
  const description=text(input.description||input.use_when||`Use ${input.display_name||slug} when relevant.`,1024).replace(/[<>]/g,'');
  const definition=text(input.definition||input.content_md||input.body,150000);
  if(!definition)throw err('SKILL_BODY_REQUIRED');
  const md=[
    '---',
    `name: ${slug}`,
    `description: ${JSON.stringify(description)}`,
    '---','',
    `# ${text(input.display_name||slug,120)}`,'',
    input.use_when?`## Use When\n${text(input.use_when,4000)}`:'',
    input.avoid_when?`## Avoid When\n${text(input.avoid_when,4000)}`:'',
    '## Instructions',definition
  ].filter(Boolean).join('\n\n');
  const skill=await buildPortableSkillPackage({
    files:[{path:'SKILL.md',content:md}],
    trust:'custom',
    enabled:input.enabled!==false,
    pinned:Boolean(input.pinned),
    source:{kind:'custom',displayName:input.display_name||slug,autoActivation:input.auto_activation!==false,githubOnly:false}
  });
  await upsertPackages([skill]);
  return structuredClone(skill);
}

async function remove(slug){
  const registry=await loadRegistry();
  const key=String(slug||'');
  const existed=Boolean(registry.skills[key]);
  delete registry.skills[key];
  if(existed)await saveRegistry(registry);
  return {removed:existed,slug:key};
}

async function importBundle(input={}){
  const skill=await buildPortableSkillPackage({
    files:input.files,
    trust:input.trust||'imported',
    enabled:input.enabled!==false,
    pinned:Boolean(input.pinned),
    scriptExecutionApproved:input.scriptExecutionApproved===true,
    source:{
      kind:input.source?.kind||'bundle',
      url:input.source?.url||null,
      revision:input.source?.revision||null,
      signature:input.source?.signature||null,
      signatureVerified:input.source?.signatureVerified===true,
      displayName:input.source?.displayName||'',
      autoActivation:input.auto_activation!==false,
      githubOnly:input.source?.githubOnly!==false
    }
  });
  await upsertPackages([skill]);
  return structuredClone(skill);
}

function safeGithubSegment(value,label){
  const out=text(value,160);
  if(!out||!/^[A-Za-z0-9_.-]+$/.test(out)||out==='.'||out==='..')throw err(`SKILL_GITHUB_${label}_INVALID`);
  return out;
}

function normalizeGithubRoot(input=''){
  const raw=String(input||'').replace(/^\/+|\/+$/g,'');
  if(!raw)return '';
  const sentinel=`${raw}/SKILL.md`;
  canonicalSkillPath(sentinel.slice(raw.length+1));
  const parts=raw.split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'||part.includes('\\')))throw err('SKILL_GITHUB_PATH_INVALID');
  return parts.join('/');
}

async function githubJson(url){
  assertSafeRemoteSkillSource(url,{githubOnly:true});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url,{headers:{accept:'application/vnd.github+json'},credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw err(`SKILL_GITHUB_HTTP_${response.status}`);
    return response.json();
  }finally{clearTimeout(timer);}
}

async function importGithubPublic(input={}){
  const owner=safeGithubSegment(input.owner,'OWNER');
  const repo=safeGithubSegment(input.repo,'REPO');
  const ref=text(input.ref||'main',200);
  if(!ref||/[\0\r\n]/.test(ref))throw err('SKILL_GITHUB_REF_INVALID');
  const root=normalizeGithubRoot(input.path||'');
  const treeUrl=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const tree=await githubJson(treeUrl);
  if(tree?.truncated===true)throw err('SKILL_GITHUB_TREE_TRUNCATED');
  const prefix=root?`${root}/`:'';
  const entries=(Array.isArray(tree?.tree)?tree.tree:[]).filter(item=>item?.type==='blob'&&String(item.path||'').startsWith(prefix));
  if(entries.length>PORTABLE_SKILL_LIMITS.files)throw err('SKILL_FILE_COUNT_LIMIT');
  const files=[];
  let total=0;
  for(const entry of entries){
    const relative=String(entry.path).slice(prefix.length);
    let path;
    try{path=canonicalSkillPath(relative);}catch{continue;}
    const size=Number(entry.size)||0;
    if(size>PORTABLE_SKILL_LIMITS.singleFileBytes)throw err('SKILL_FILE_TOO_LARGE',{path,size});
    total+=size;
    if(total>PORTABLE_SKILL_LIMITS.totalBytes)throw err('SKILL_TOTAL_SIZE_LIMIT');
    const blob=await githubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(entry.sha)}`);
    if(blob?.encoding!=='base64'||typeof blob?.content!=='string')throw err('SKILL_GITHUB_BLOB_ENCODING_INVALID',{path});
    files.push({path,base64:String(blob.content).replace(/\s+/g,'')});
  }
  if(!files.some(file=>file.path==='SKILL.md'))throw err('SKILL_MD_REQUIRED');
  return importBundle({
    files,
    trust:'imported',
    source:{kind:'github',url:`https://github.com/${owner}/${repo}/tree/${encodeURIComponent(ref)}/${root}`,revision:text(tree?.sha||ref,160),githubOnly:true}
  });
}

async function route(command,options={}){
  const registry=await loadRegistry();
  return routePortableSkills(command,Object.values(registry.skills),options||{});
}

async function stage(slug,options={}){
  const registry=await loadRegistry();
  const skill=registry.skills[String(slug||'')];
  if(!skill)throw err('SKILL_NOT_FOUND');
  return stagePortableSkillForRun(skill,options||{});
}

async function status(){
  const registry=await loadRegistry();
  const all=Object.values(registry.skills);
  return {
    schema:PORTABLE_SKILL_REGISTRY_SCHEMA,
    build:72,
    count:all.length,
    revision:registry.revision,
    localAuthority:true,
    cloudRequired:false,
    geminiRequired:false,
    sourceImmutable:true,
    stagedCopyRequired:true,
    externalAgentsMayConsume:true,
    skillMayExpandIntent:false,
    writeAuthority:false,
    storage:'chrome.storage.local',
    storageContainsSecrets:false,
    limits:{...PORTABLE_SKILL_LIMITS}
  };
}

async function handle(action,payload={}){
  const op=String(action||'status').toLowerCase();
  if(op==='status')return status();
  if(op==='list')return list(payload||{});
  if(op==='get_many')return {skills:await getMany(payload.slugs||[])};
  if(op==='route')return route(payload.command||'',payload.options||{});
  if(op==='stage')return stage(payload.slug,payload.options||{});
  if(op==='sync_legacy')return syncLegacy(payload.skills||[]);
  if(op==='set_preference')return {skill:await setPreference(payload.slug,payload)};
  if(op==='create_custom')return {skill:await createCustom(payload)};
  if(op==='delete')return remove(payload.slug);
  if(op==='import_bundle')return {skill:await importBundle(payload)};
  if(op==='import_github_public')return {skill:await importGithubPublic(payload)};
  throw err('PORTABLE_SKILLS_ACTION_INVALID');
}

export function installPortableSkillsRuntime(){
  if(globalThis.__LD72_PORTABLE_SKILLS_RUNTIME__)return;
  globalThis.__LD72_PORTABLE_SKILLS_RUNTIME__=true;
  chrome.runtime.onConnect.addListener(port=>{
    if(port.name!==PORT_NAME)return;
    const listener=async message=>{
      const id=String(message?.id||'');
      try{port.postMessage({id,ok:true,data:await handle(message?.action,message?.payload||{})});}
      catch(error){try{port.postMessage({id,ok:false,error:error?.message||String(error),code:error?.code||'PORTABLE_SKILLS_FAILED'});}catch(_){}}
    };
    port.onMessage.addListener(listener);
  });
  globalThis.LovableDecrypterPortableSkillsRuntime=Object.freeze({
    build:72,
    schema:PORTABLE_SKILL_REGISTRY_SCHEMA,
    port:PORT_NAME,
    localAuthority:true,
    cloudRequired:false,
    geminiRequired:false,
    writeAuthority:false
  });
}
