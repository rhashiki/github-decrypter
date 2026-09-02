import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const manifest=json('manifest.json');
const pkg=json('release/runtime-package.json');
const checkpoint=json('docs/checkpoints/build84-integrations-resource-management-validated.json');
const ux=read('launcher/ux-polish-v84-2.js');
const editor=read('launcher/editor-direct-authority-v84.js');
const resources=read('launcher/integration-resource-manager-v84-2.js');
const supabase=read('launcher/supabase-project-manager-v84-2.js');
const githubSync=read('launcher/github-sync-v84.js');
const entrypoints=read('launcher/integration-resource-entrypoints-v84.js');
const gemini=read('launcher/gemini-integration-v84-2.js');
const editorRuntime=read('background/editor-direct-runtime-v84.js');
const supabaseRuntime=read('background/supabase-project-manager-runtime-v84.js');
const renameRuntime=read('background/supabase-project-rename-runtime-v84.js');
const githubRuntime=read('background/github-sync-runtime-v84.js');
const geminiRuntime=read('background/gemini-provider-runtime-v84.js');
const integrationsRuntime=read('background/runtime-entry-v84-integrations.js');
const worker=read('background/build84-service-worker.js');
assert.equal(manifest.version,'2.6.84');
assert.equal(manifest.background?.service_worker,'background/build84-service-worker.js');
assert.deepEqual(manifest.permissions||[],['storage']);
const app=(manifest.content_scripts||[]).find(x=>Array.isArray(x.js)&&x.js.includes('launcher/launcher-runtime.js'));
assert.ok(app,'canonical launcher missing');
assert.deepEqual(app.js,[
  'launcher/launcher-runtime.js',
  'launcher/runtime-client-v84.js',
  'launcher/account-controller-v84.js',
  'launcher/ux-polish-v84-2.js',
  'launcher/editor-direct-authority-v84.js',
  'launcher/integration-resource-manager-v84-2.js',
  'launcher/supabase-project-manager-v84-2.js',
  'launcher/github-sync-v84.js',
  'launcher/integration-resource-entrypoints-v84.js',
  'launcher/gemini-integration-v84-2.js'
]);
assert.equal(app.run_at,'document_start');
assert.equal(app.all_frames,false);
for(const forbidden of ['launcher/ux-polish-v84.js','launcher/editor-direct-v84.js','launcher/integration-resource-manager-v84.js','launcher/supabase-project-manager-v84.js','launcher/gemini-integration-v84.js'])assert.ok(!app.js.includes(forbidden),`legacy UI still shipped: ${forbidden}`);
assert.equal(checkpoint.status,'VALIDADO');
assert.equal(checkpoint.validation,'real-browser');
assert.equal(checkpoint.browser_results.ram_stabilizes,true);
assert.equal(checkpoint.browser_results.github_resource_manager_nested_once,true);
assert.equal(checkpoint.browser_results.supabase_resource_manager_nested_once,true);

// Editor Direct: unique real authority and full command path.
assert.ok(ux.includes("editor.dataset.ldEditorDirect='true'"));
assert.ok(!ux.includes('Controle restaurado. O motor de edição direta será reativado'));
assert.ok(!ux.includes('showEditorDirectModal'));
assert.ok(editor.includes("[data-ld-parity=\"editor-direct\"], [data-ld-editor-direct]"));
assert.ok(editor.includes("delete control.dataset.ldParity"));
for(const type of ['ld84.editor.resources','ld84.editor.bind','ld84.editor.configure','ld84.editor.health','ld84.editor.plan','ld84.editor.build','ld84.editor.apply'])assert.ok(editor.includes(type),`Editor Direct action missing: ${type}`);
for(const label of ['Salvar vínculo','Salvar e testar IA local','Planejar · ZERO WRITE','Preparar Shadow Build','Aplicar no GitHub'])assert.ok(editor.includes(label),`Editor Direct UI missing: ${label}`);
assert.ok(editorRuntime.includes("const LD84_EDITOR_BINDINGS_KEY = 'ld84_project_bindings'"));
assert.ok(editorRuntime.includes("type === 'ld84.editor.bind'"));
assert.ok(editorRuntime.includes("method: 'PATCH'"),'explicit Apply path must remain present');
assert.ok(editorRuntime.includes('force: false'),'Apply remains non-force');

// Resource manager: one immediate retry only for transient DB/config errors.
assert.ok(resources.includes('function resourceStatus(integration)'));
assert.ok(resources.includes('transientDB(out)'));
assert.ok(resources.includes("'DB_ERROR'"));
assert.ok(resources.includes('Tentar novamente'));
assert.ok(resources.includes('GitHub Sync & History'));
assert.ok(resources.includes('Gerenciador Supabase'));
assert.ok(entrypoints.includes('function ensureSingleNestedEntry('));
assert.ok(!entrypoints.includes('GitHub · Gerenciar repositórios'));
assert.ok(!entrypoints.includes('Supabase · Gerenciar projetos'));

// GitHub Sync remains fail-closed and read-only; binding comes from Editor Direct.
for(const code of ['GITHUB_PROJECT_BINDING_REQUIRED','GITHUB_REPOSITORY_NOT_AUTHORIZED','GITHUB_REPOSITORY_NOT_SELECTED'])assert.ok(githubRuntime.includes(code));
assert.ok(githubRuntime.includes("bindingAuthority: 'explicit-project-binding'"));
assert.ok(githubRuntime.includes('historyReadOnly: true'));
assert.ok(githubRuntime.includes('compareReadOnly: true'));
assert.ok(!githubRuntime.includes("method: 'PATCH'"));
assert.ok(!githubRuntime.includes("method: 'DELETE'"));
for(const label of ['Sincronizar estado','Ver histórico','Comparar'])assert.ok(githubSync.includes(label));

// Supabase manager refinements requested in real browser test.
for(const label of ['Disponíveis ao Decrypter','Atualizar provisionamento','Testar acesso','Vincular ao Lovable','Renomear projeto'])assert.ok(supabase.includes(label),`Supabase UI missing ${label}`);
assert.ok(supabase.includes("row.addEventListener('click',()=>renderDetail"),'listed projects must open detail');
assert.ok(supabase.includes("'testing'"));
assert.ok(supabase.includes("'success'"));
assert.ok(supabase.includes('@keyframes ld84SbmPulse'));
assert.ok(supabase.includes("type:'ld84.supabase.rename'"));
assert.ok(supabaseRuntime.includes("type === 'ld84.supabase.manager.project-status'"));
assert.ok(renameRuntime.includes("ld-supabase-project-rename"));
assert.ok(renameRuntime.includes("type||'')!=='ld84.supabase.rename'"));
assert.ok(renameRuntime.includes('SUPABASE_PROJECT_NOT_SELECTED'));

// Gemini remains Free Only by default, paid models require explicit opt-in.
assert.ok(gemini.includes('Mostrar também modelos pagos / potencialmente cobrados'));
assert.ok(gemini.includes('PAGO / POTENCIALMENTE COBRÁVEL'));
assert.ok(gemini.includes('scrollbar-color'));
assert.ok(gemini.includes('::-webkit-scrollbar-thumb'));
for(const type of ['ld84.gemini.v2.status','ld84.gemini.v2.models','ld84.gemini.v2.save','ld84.gemini.v2.clear'])assert.ok(gemini.includes(type));
assert.ok(geminiRuntime.includes("includePaidModels=input.includePaidModels===true"));
assert.ok(geminiRuntime.includes('GEMINI_PAID_MODEL_OPT_IN_REQUIRED'));
assert.ok(geminiRuntime.includes("costClass:freeVerified?'free':'paid-or-unverified'"));
assert.ok(geminiRuntime.includes("centralOrchestrator:'local-ai'"));
assert.ok(geminiRuntime.includes('automaticExecution:false'));
assert.ok(geminiRuntime.includes('bootActivation:false'));
assert.ok(!geminiRuntime.includes(':generateContent'));
assert.ok(integrationsRuntime.includes("centralOrchestrator: 'local-ai'"));

// Service worker composition and clean event-driven invariants.
for(const script of ['editor-direct-runtime-v84.js','supabase-project-manager-runtime-v84.js','supabase-project-rename-runtime-v84.js','github-sync-runtime-v84.js','gemini-provider-runtime-v84.js'])assert.ok(worker.includes(script),`worker missing ${script}`);
for(const [name,source] of Object.entries({ux,editor,resources,supabase,githubSync,gemini,editorRuntime,supabaseRuntime,renameRuntime,githubRuntime,geminiRuntime,integrationsRuntime,worker})){
  assert.ok(!/MutationObserver\s*\(/.test(source),`${name}: MutationObserver forbidden`);
  assert.ok(!/setInterval\s*\(/.test(source),`${name}: setInterval forbidden`);
  assert.ok(!/\.inert\s*=|setAttribute\(\s*['\"]inert/.test(source),`${name}: inert takeover forbidden`);
  assert.ok(!/XMLHttpRequest\.prototype\s*\.|window\.fetch\s*=|globalThis\.fetch\s*=|navigator\.sendBeacon\s*=/.test(source),`${name}: network monkeypatch forbidden`);
}
assert.ok(!renameRuntime.includes('chrome.alarms'));
assert.ok(!geminiRuntime.includes('chrome.alarms'));
assert.ok(!githubRuntime.includes('chrome.alarms'));

const paths=new Set(pkg.paths||[]);
for(const required of [
  'manifest.json','assets','launcher/launcher-runtime.js','launcher/runtime-client-v84.js','launcher/account-controller-v84.js','launcher/ux-polish-v84-2.js','launcher/editor-direct-authority-v84.js','launcher/integration-resource-manager-v84-2.js','launcher/supabase-project-manager-v84-2.js','launcher/github-sync-v84.js','launcher/integration-resource-entrypoints-v84.js','launcher/gemini-integration-v84-2.js','background/runtime-entry-v84.js','background/runtime-entry-v84-integrations.js','background/editor-direct-runtime-v84.js','background/supabase-project-manager-runtime-v84.js','background/supabase-project-rename-runtime-v84.js','background/github-sync-runtime-v84.js','background/gemini-provider-runtime-v84.js','background/build84-service-worker.js'
])assert.ok(paths.has(required),`package missing ${required}`);
for(const forbidden of pkg.forbidden_paths||[])assert.ok(!paths.has(forbidden),`forbidden path leaked into package: ${forbidden}`);
console.log(JSON.stringify({ok:true,schema:'ld-build84-browser-refinement/1',editorDirectAuthority:'functional-only',resourceDbRetry:'single-immediate',supabaseProjectDetail:true,supabaseRename:true,geminiPaidModels:'explicit-opt-in',githubSync:'read-only-fail-closed',continuousPolling:0,globalObservers:0},null,2));
