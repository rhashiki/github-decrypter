import fs from 'node:fs';
const policy=JSON.parse(fs.readFileSync('architecture.guardian.json','utf8'));
const issues=[];
const code=fs.readFileSync('packages/code-intelligence/src/index.ts','utf8');
const runtime=fs.readFileSync('apps/local/src/code-intelligence-runtime.ts','utf8');
const semantic=fs.readFileSync('packages/code-intelligence/src/semantic.ts','utf8');
const local=JSON.parse(fs.readFileSync('apps/local/package.json','utf8'));
const studio=JSON.parse(fs.readFileSync('apps/studio/package.json','utf8'));
const explorer=fs.readFileSync('apps/studio/src/CodeExplorer.tsx','utf8');
const daemon=fs.readFileSync('apps/local/src/daemon.ts','utf8');
const auth=policy.codeIntelligenceAuthority;
if(policy.currentBuild!==73||policy.phaseGates.codeIntelligenceBuild!==73)issues.push('Build 73 gate missing');
for(const [key,expect] of Object.entries({
 readCapabilityOnly:true,registeredWorkspaceRequired:true,astBacked:true,sourceGrounded:true,
 semanticResolution:false,dependencyResolution:false,unverifiedCallGraph:false,mutating:false,
 networkAuthority:false,secondaryExecutionAuthority:false,persistentIndex:false,
 maxFiles:256,maxToolFiles:64,maxFileCharacters:256000,maxTotalCharacters:4000000,maxAstNodes:150000,maxResults:256,
}))if(auth?.[key]!==expect)issues.push('Code Intelligence authority drift: '+key);
if(!policy.packageRules?.['@github-decrypter/code-intelligence']?.environmentNeutral)issues.push('Environment-neutral package not guarded');
if(!policy.appRules?.['@github-decrypter/local']?.allowedWorkspaceDependencies?.includes('@github-decrypter/code-intelligence'))issues.push('Unapproved local runtime dependency');
if(local.dependencies?.['@github-decrypter/code-intelligence']!=='workspace:*')issues.push('No local runtime code intelligence dependency');
if(studio.dependencies?.['@github-decrypter/code-intelligence']!=='workspace:*'
  || !policy.appRules?.['@github-decrypter/studio']?.allowedWorkspaceDependencies?.includes('@github-decrypter/code-intelligence'))
  issues.push('Studio scratchpad dependency not guarded');
if(auth?.studioRepositoryTransport!==false || auth?.studioFilesystemAccess!==false)
  issues.push('Code Explorer must not claim direct repo or filesystem transport');
if(!daemon.includes('...createCodeIntelligenceToolRegistrations({ workspaces: this.#workspaces }, scopeLock)'))
  issues.push('Code Intelligence missing from daemon tool registration composition');
if(/\bfetch\s*\(|\bWebSocket\b|\bFileReader\b|\blocalStorage\b|\bindexedDB\b/.test(explorer))
  issues.push('Code Explorer gained unauthorized browser network/filesystem/persistence');
if(!explorer.includes('local scratchpad') || !explorer.includes('importSourceFiles')
  || !explorer.includes('file.text()') || !explorer.includes('Go to definition'))
  issues.push('Scratchpad lacks user-initiated import or semantic navigation');
for(const token of ['CODE_INTELLIGENCE_SCHEMA','buildCodeIntelligenceIndex','queryCodeIntelligence','semanticTypeResolution: false','mutationAuthority: false','networkAuthority: false'])if(!code.includes(token))issues.push('Missing index contract '+token);
for(const token of ['resolveExistingPath','verifiedCapabilities.includes(\'READ\')','mutating: false','lstatSync','sourceScopeLockId','openSync','readSync','fstatSync','O_NOFOLLOW','realpathSync','closeSync'])if(!runtime.includes(token))issues.push('Missing runtime gate '+token);
for(const [file,s] of [['core',code],['runtime',runtime]]){
  if(/\bfetch\s*\(|\bWebSocket\b|\bchild_process\b|\bspawn\s*\(/.test(s))issues.push(file+' gained network/process authority');
}
if(!semantic.includes('hostFilesystemAccess: false') || !semantic.includes('noLib: true') || !semantic.includes('noEmit: true') || !semantic.includes('getTypeChecker()'))issues.push('Semantic resolver must remain memory-only, compiler-backed and read-only');
if(/mutationAuthority:\s*true|semanticTypeResolution:\s*true|callGraphResolution:\s*true/.test(code+runtime))issues.push('Unsupported authority claim');
console.log(JSON.stringify({ok:issues.length===0,schema:'gd-build73-guardian/1',build:73,issues},null,2));
if(issues.length)process.exit(1);
