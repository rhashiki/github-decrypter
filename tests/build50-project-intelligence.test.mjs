import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const js=fs.readFileSync('ui/project-intelligence-v50.js','utf8');
const css=fs.readFileSync('ui/project-intelligence-v50.css','utf8');
const settings=fs.readFileSync('settings/config.js','utf8');
const app=manifest.content_scripts.find(x=>x.js?.includes('ui/project-intelligence-v50.js'));
if(!app) throw new Error('Build50 UI missing');
if(manifest.version!=='2.5.50'||pkg.candidate!=='2.5.50'||!settings.includes("VERSION = '2.5.50'")) throw new Error('Build50 version mismatch');
if(app.js.indexOf('ui/project-intelligence-v50.js')<=app.js.indexOf('ui/ui-kernel-v48.js')) throw new Error('Project Intelligence must register after UI kernel');
for(const id of ['brain','rules','skills','impact','explain']) if(!js.includes(`registry.register(id,()=>open(id))`) && !js.includes(`['${id}'`)) {/* covered by TABS */}
if(!js.includes("['brain','Brain']")||!js.includes("['rules','Rules']")||!js.includes("['skills','Skills']")||!js.includes("['impact','Impact']")||!js.includes("['explain','Explain']")) throw new Error('five intelligence tabs missing');
if(!js.includes("cloud('get_brain')")||!js.includes("cloud('list_rules')")||!js.includes("cloud('list_impacts'")||!js.includes("cloud('explain_project')")) throw new Error('direct intelligence data access missing');
if(js.includes('.click(')||js.includes('data-cc-intel')) throw new Error('legacy UI delegation returned');
if(!js.includes("[data-close]")) throw new Error('close control missing');
if(!css.includes('clamp(')||!css.includes('backdrop-filter:blur(30px)')) throw new Error('responsive Nexus styling missing');
console.log('Build50 Project Intelligence contract OK');
