import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  PORTABLE_SKILL_SCHEMA,
  PORTABLE_SKILL_REGISTRY_SCHEMA,
  PORTABLE_SKILL_STAGE_SCHEMA,
  PORTABLE_SKILL_LIMITS,
  parseSkillMarkdown,
  canonicalSkillPath,
  assertSafeRemoteSkillSource,
  buildPortableSkillPackage,
  portableSkillFromLegacy,
  routePortableSkills,
  stagePortableSkillForRun
} from '../core/portable-skills.js';

const read=path=>fs.readFileSync(path,'utf8');
const manifest=JSON.parse(read('manifest.json'));
const pkg=JSON.parse(read('release/runtime-package.json'));
const settings=read('settings/config.js');
const core=read('core/portable-skills.js');
const runtime=read('background/portable-skills-runtime.js');
const client=read('content/portable-skills-client.js');
const router=read('content/skill-router.js');
const entry=read('background/service-worker-entry.js');
const roadmap=read('docs/ROADMAP_V2_6_LOCAL_FIRST_AI.md');

assert.equal(manifest.version,'2.6.72');
assert.match(manifest.version_name,/Build 72 · Portable Skills v2/);
assert.equal(pkg.candidate,manifest.version);
assert.ok(settings.includes("VERSION = '2.6.72'"));
assert.ok(settings.includes("PORTABLE_SKILL_SCHEMA = 'ld-portable-skill/2'"));
assert.ok(settings.includes("PORTABLE_SKILL_REGISTRY_SCHEMA = 'ld-portable-skill-registry/2'"));
assert.equal(PORTABLE_SKILL_SCHEMA,'ld-portable-skill/2');
assert.equal(PORTABLE_SKILL_REGISTRY_SCHEMA,'ld-portable-skill-registry/2');
assert.equal(PORTABLE_SKILL_STAGE_SCHEMA,'ld-portable-skill-stage/1');

const skillMd=`---\nname: ui-review\ndescription: "Review UI implementation when a request changes layout or interaction."\nallowed-tools: "repo.read diagnostics.run repo.patch_apply"\ntags: [ui, review]\n---\n# UI Review\n\nKeep the requested scope.\n`;
const parsed=parseSkillMarkdown(skillMd);
assert.equal(parsed.metadata.name,'ui-review');
assert.equal(parsed.metadata.description.startsWith('Review UI'),true);
assert.deepEqual(parsed.metadata.allowedTools,['repo.read','diagnostics.run','repo.patch_apply']);
assert.deepEqual(parsed.metadata.tags,['ui','review']);
assert.throws(()=>parseSkillMarkdown('# no frontmatter'),e=>e?.code==='SKILL_FRONTMATTER_REQUIRED');
assert.throws(()=>parseSkillMarkdown('---\nname: Bad Name\ndescription: ok\n---\nbody'),e=>e?.code==='SKILL_NAME_INVALID');
assert.throws(()=>parseSkillMarkdown('---\nname: ok\ndescription: "<bad>"\n---\nbody'),e=>e?.code==='SKILL_DESCRIPTION_INVALID');

assert.equal(canonicalSkillPath('SKILL.md'),'SKILL.md');
assert.equal(canonicalSkillPath('references/api.md'),'references/api.md');
assert.throws(()=>canonicalSkillPath('../outside.md'),e=>e?.code==='SKILL_PATH_TRAVERSAL');
assert.throws(()=>canonicalSkillPath('references/../../outside.md'),e=>e?.code==='SKILL_PATH_TRAVERSAL');
assert.throws(()=>canonicalSkillPath('.env'),e=>['SKILL_SENSITIVE_FILE_FORBIDDEN','SKILL_PATH_ROOT_FORBIDDEN'].includes(e?.code));
assert.throws(()=>canonicalSkillPath('assets/private.pem'),e=>e?.code==='SKILL_SENSITIVE_FILE_FORBIDDEN');
assert.throws(()=>canonicalSkillPath('other/file.md'),e=>e?.code==='SKILL_PATH_ROOT_FORBIDDEN');

assert.match(assertSafeRemoteSkillSource('https://github.com/acme/skills'),/^https:\/\/github\.com\//);
for(const url of ['http://github.com/acme/skills','https://localhost/skill','https://127.0.0.1/skill','https://192.168.1.2/skill','https://example.com/skill']) {
  assert.throws(()=>assertSafeRemoteSkillSource(url));
}

const imported=await buildPortableSkillPackage({
  files:[
    {path:'SKILL.md',content:skillMd},
    {path:'references/checklist.md',content:'# Checklist\nStay inside scope.'},
    {path:'scripts/helper.js',content:'export const helper = true;'},
    {path:'assets/template.txt',content:'template'}
  ],
  trust:'imported',
  source:{kind:'github',url:'https://github.com/acme/skills/tree/main/ui-review',revision:'abc123'}
});
assert.equal(imported.schema,PORTABLE_SKILL_SCHEMA);
assert.equal(imported.contentHash.length,64);
assert.equal(imported.provenance.sourceRevision,'abc123');
assert.equal(imported.permissions.canWriteAuthoritative,false);
assert.equal(imported.permissions.canExpandScope,false);
assert.equal(imported.permissions.scriptsAllowed,false);
assert.equal(imported.writeAuthority,false);
assert.equal(imported.cloudRequired,false);

const importedAgain=await buildPortableSkillPackage({
  files:[
    {path:'assets/template.txt',content:'template'},
    {path:'references/checklist.md',content:'# Checklist\nStay inside scope.'},
    {path:'scripts/helper.js',content:'export const helper = true;'},
    {path:'SKILL.md',content:skillMd}
  ],
  trust:'imported',source:{kind:'bundle'}
});
assert.equal(importedAgain.contentHash,imported.contentHash,'content hash must be canonical across file ordering');

const verified=await buildPortableSkillPackage({files:[{path:'SKILL.md',content:skillMd},{path:'scripts/helper.js',content:'export const helper=true;'}],trust:'verified',scriptExecutionApproved:true});
assert.equal(verified.permissions.scriptsAllowed,true);
const defaultStage=await stagePortableSkillForRun(imported,{contextBytes:12000,includeReferences:true,allowScripts:false});
assert.equal(defaultStage.schema,PORTABLE_SKILL_STAGE_SCHEMA);
assert.equal(defaultStage.sourceImmutable,true);
assert.equal(defaultStage.permissions.writeAuthority,false);
assert.equal(defaultStage.files.some(file=>file.path.startsWith('scripts/')),false);
assert.equal(defaultStage.files.some(file=>file.path==='references/checklist.md'),true);
assert.equal(defaultStage.stageFingerprint.length,64);
assert.equal(imported.files.some(file=>file.path==='scripts/helper.js'),true,'source package must remain unchanged after staging');
const verifiedStage=await stagePortableSkillForRun(verified,{allowScripts:true});
assert.equal(verifiedStage.files.some(file=>file.path.startsWith('scripts/')),true);

const legacy=await portableSkillFromLegacy({slug:'payments-review',display_name:'Payments Review',description:'Review payment code when checkout changes.',content_md:'Check only requested payment files.',official:true,user:{enabled:true,pinned:true}});
assert.equal(legacy.trust,'builtin');
assert.equal(legacy.pinned,true);
const routed=routePortableSkills('please review checkout payment changes',[imported,legacy]);
assert.equal(routed.method,'portable-local-v2');
assert.equal(routed.cloudUsed,false);
assert.ok(routed.slugs.includes('payments-review'));

assert.throws(()=>buildPortableSkillPackage({files:Array.from({length:PORTABLE_SKILL_LIMITS.files+1},(_,i)=>({path:i===0?'SKILL.md':`references/${i}.md`,content:i===0?skillMd:'x'}))}),e=>e?.code==='SKILL_FILE_COUNT_LIMIT');

for(const token of ['SKILL_FRONTMATTER_REQUIRED','SKILL_PATH_TRAVERSAL','SKILL_SOURCE_PRIVATE_NETWORK_FORBIDDEN','SKILL_TOTAL_SIZE_LIMIT','sourceImmutable:true','canExpandScope:false','writeAuthority:false'])assert.ok(core.includes(token),token);
for(const token of ["PORT_NAME='ld2-portable-skills-v2'","STORAGE_KEY='ld72_portable_skills_v2'",'import_github_public','api.github.com','geminiRequired:false','cloudRequired:false'])assert.ok(runtime.includes(token),token);
assert.ok(entry.includes('installPortableSkillsRuntime();'));
assert.ok(client.includes('ld2-portable-skills-v2'));
assert.ok(manifest.content_scripts.some(item=>(item.js||[]).includes('content/portable-skills-client.js')));
const scripts=manifest.content_scripts.find(item=>(item.js||[]).includes('content/skill-router.js')).js;
assert.ok(scripts.indexOf('content/portable-skills-client.js')<scripts.indexOf('content/skill-router.js'));
assert.ok(router.includes('portable-local-v2'));
assert.ok(router.includes('cloudRoutingRequired:false'));
assert.ok(router.includes('geminiRoutingRequired:false'));
assert.ok(!router.includes('x-gemini-key'));
assert.ok(!router.includes("cloud(cfg, 'ld-skills', { action: 'route'"));
assert.ok(!router.includes("cloud(cfg, 'ld-custom-skills', { action: 'route'"));
assert.match(pkg.notes,/Portable Skills v2/);
assert.match(pkg.notes,/writeAuthority=false/);
assert.match(pkg.notes,/No OTA metadata, GitHub Release or store publication is authorized/);
assert.match(roadmap,/Build 72 — Portable Skills v2/);
assert.match(roadmap,/Build 73 — Agent Sandbox \/ Shadow Worktree/);

console.log('Build72 Portable Skills v2 contract OK');
