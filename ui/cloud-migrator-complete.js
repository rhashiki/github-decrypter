(() => {
  'use strict';
  if (window.__LD2_CLOUD_MIGRATOR_COMPLETE_UI__) return;
  window.__LD2_CLOUD_MIGRATOR_COMPLETE_UI__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let running = false, cancelRequested = false, installedHelper = null;

  function portCall(portName, action, payload = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const port = chrome.runtime.connect({ name: portName });
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { try { port.disconnect(); } catch (_) {} reject(new Error('A operação não respondeu dentro do tempo limite.')); }, 90000);
      let done = false;
      const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); try { port.disconnect(); } catch (_) {} fn(value); };
      port.onMessage.addListener(message => {
        if (message?.id !== id) return;
        if (message?.progress) { onProgress?.(message.progress); return; }
        if (message?.ok) finish(resolve, message.data); else finish(reject, new Error(message?.error || 'Falha no Cloud Migrator.'));
      });
      port.onDisconnect.addListener(() => { if (!done && chrome.runtime.lastError) finish(reject, new Error(chrome.runtime.lastError.message)); });
      port.postMessage({ id, action, payload });
    });
  }
  const core = (action, payload = {}) => portCall('ld2-cloud-migration', action, payload);
  const assets = (action, payload = {}, progress = null) => portCall('ld2-cloud-assets', action, payload, progress);
  function parts() { const root=document.getElementById('ld2-root'); return {root,modal:root&&$('.ld2-modal',root),card:root&&$('.ld2-card',root)}; }
  function open(html) { const {modal,card}=parts(); if(!modal||!card)throw new Error('Control Center ainda não está pronto.');card.innerHTML=html;modal.classList.add('open');$('[data-cm-close]',card)?.addEventListener('click',()=>modal.classList.remove('open'));return card; }
  function toast(text,error=false) { const {root}=parts(),wrap=root&&$('.ld2-toast-wrap',root);if(!wrap)return;const el=document.createElement('div');el.className=`ld2-toast${error?' error':''}`;el.textContent=text;wrap.appendChild(el);setTimeout(()=>el.remove(),4800); }
  function context(){return window.LovableDecrypterProjectRuntime?.getContext?.()||null}
  async function settings(){return window.LovableDecrypterV2?.runtime?.({type:'LD2_SETTINGS_GET'})||{}}
  function targetFor(cfg,projectId){const mapped=cfg?.supabaseMappings?.[projectId]||{},global=cfg?.supabase||{};return{projectRef:String(mapped.projectRef||mapped.ref||global.projectRef||''),projectName:String(mapped.projectName||mapped.name||global.projectName||'')}}
  function shell(body){return `<div class="ld2-cm ld2-cm-complete"><header class="ld2-cm-head"><div><small>LOVABLE CLOUD → SUPABASE</small><h2>Cloud Migrator</h2><p>Build 7 · migração completa suportada</p></div><button type="button" data-cm-close>×</button></header><div class="ld2-cm-body">${body}</div></div>`}
  const CORE_PHASES=['schema','data','rls','auth','verify'];
  const ASSET_PHASES=['storage_buckets','storage_objects','storage_policies','realtime','edge_functions','secrets','config','verify'];
  function phaseName(p){return({schema:'SCHEMA',data:'DADOS',rls:'RLS',auth:'AUTH',verify:'VERIFICAR',storage_buckets:'BUCKETS',storage_objects:'ARQUIVOS',storage_policies:'STORAGE RLS',realtime:'REALTIME',edge_functions:'EDGE FUNCTIONS',secrets:'SECRETS',config:'CONFIG'})[p]||String(p||'').toUpperCase()}
  function phaseBar(job,phases,complete=false){const current=String(job?.phase||''),ix=phases.indexOf(current);return `<div class="ld2-cm-phases">${phases.map((p,i)=>`<span class="${complete||i<ix?'done':p===current?'active':''}">${esc(phaseName(p))}</span>`).join('')}</div>`}
  function summary(coreJob,assetJob){const c=coreJob?.inventory||{},a=assetJob?.inventory||{},p=assetJob?.progress||{};return `<div class="ld2-cm-grid"><div><small>TABELAS</small><b>${Number(c.tables?.length||0)}</b></div><div><small>LINHAS</small><b>${Number(c.totalRows||0).toLocaleString('pt-BR')}</b></div><div><small>BUCKETS</small><b>${Number(a.buckets?.length||0)}</b></div><div><small>OBJETOS</small><b>${Number(a.totalObjects||0).toLocaleString('pt-BR')}</b></div><div><small>EDGE FUNCTIONS</small><b>${Number(a.functionsExpected?.length||0)}</b></div><div><small>SECRETS</small><b>${Number(p.secrets_done||0)}</b></div></div>`}
  function logs(coreJob,assetJob){const list=[...(coreJob?.logs||[]).map(x=>({...x,src:'DB'})),...(assetJob?.logs||[]).map(x=>({...x,src:'ASSET'}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,16);return `<div class="ld2-cm-log">${list.map(x=>`<div><small>${esc(x.src)} ${esc(String(x.at||'').slice(11,19))}</small><span>${esc(x.message)}</span></div>`).join('')}</div>`}
  function warnings(coreJob,assetJob,extra=[]){const list=[...(coreJob?.warnings||[]),...(assetJob?.warnings||[]),...extra].map(String);return list.length?`<div class="ld2-cm-warnings"><b>⚠ Atenção</b>${[...new Set(list)].map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
  async function cleanup(ctx){const runtime=window.LovableDecrypterCloudMigratorContent;if(!runtime)return{ok:false,error:'Runtime do helper indisponível.'};return runtime.cleanup(ctx,installedHelper||runtime.helperSpec(ctx))}

  async function showInitial(){
    let ctx=context();if(!ctx)ctx=await window.LovableDecrypterProjectRuntime?.refresh?.(true);
    const cfg=await settings(),target=targetFor(cfg,ctx?.projectId||'');
    const sourceOk=ctx?.backend?.type==='lovable_cloud'||ctx?.backend?.managedByLovable===true;
    const targetOk=/^[a-z0-9]{8,32}$/i.test(target.projectRef);const same=targetOk&&ctx?.backend?.supabaseRef&&target.projectRef===ctx.backend.supabaseRef;
    const [activeCore,activeAssets]=ctx?.projectId?await Promise.all([core('active',{lovable_project_id:ctx.projectId}).catch(()=>null),assets('active',{lovable_project_id:ctx.projectId}).catch(()=>null)]):[null,null];
    if(activeCore?.job||activeAssets?.job)return renderJobs(activeCore?.job||null,activeAssets?.job||null,ctx,true);
    const card=open(shell(`<div class="ld2-cm-pair"><div><small>ORIGEM</small><b>${esc(ctx?.project?.name||'Projeto Lovable')}</b><span>${sourceOk?'Lovable Cloud detectado':'Lovable Cloud não detectado'}</span><em>${esc(ctx?.backend?.supabaseRef||'gerenciado')}</em></div><i>→</i><div><small>DESTINO</small><b>${esc(target.projectName||target.projectRef||'Não selecionado')}</b><span>${targetOk?'Supabase autorizado':'Selecione um Supabase no Control Center'}</span><em>${esc(target.projectRef||'—')}</em></div></div>${!sourceOk?'<div class="ld2-cm-block">Este projeto não foi identificado como Lovable Cloud.</div>':''}${!targetOk?'<div class="ld2-cm-block">Nenhum Supabase destino está vinculado.</div>':''}${same?'<div class="ld2-cm-block">Origem e destino são o mesmo projeto.</div>':''}<div class="ld2-cm-scope"><b>Escopo Build 7</b><span>Banco · dados · RLS · Auth users · Storage buckets/objetos/policies · Realtime · Edge Functions versionadas · Secrets server-side detectáveis · configuração Auth portátil.</span><small>Credenciais de provedores Auth externos não são inventadas. Sessões/MFA ativas e senhas de banco não são copiadas.</small></div><label class="ld2-cm-check"><input type="checkbox" data-cm-confirm ${sourceOk&&targetOk&&!same?'':'disabled'}><span>Confirmo o destino e entendo que a migração escreve dados, arquivos e configurações no Supabase selecionado.</span></label><div class="ld2-cm-actions"><button class="primary" type="button" data-cm-start disabled>Preparar migração completa</button></div>`));
    const check=$('[data-cm-confirm]',card),start=$('[data-cm-start]',card);check?.addEventListener('change',()=>{start.disabled=!check.checked});start?.addEventListener('click',()=>prepare(ctx,target,card));
  }
  async function prepare(ctx,target,card){
    const runtime=window.LovableDecrypterCloudMigratorContent;if(!runtime)return toast('Runtime do helper não carregou.',true);
    card.querySelector('.ld2-cm-body').innerHTML='<div class="ld2-cm-loading"><span></span><b>Inventariando GitHub e preparando os dois brokers…</b><small>Credenciais permanecem server-to-server.</small></div>';
    let coreJobId='',assetJobId='';
    try{
      const manifest=await assets('source_manifest',{projectId:ctx.projectId});const spec=runtime.helperSpec(ctx);
      const cp=await core('prepare',{lovable_project_id:ctx.projectId,lovable_project_name:ctx.project?.name||'',framework:ctx.project?.framework||'',source_project_ref:ctx.backend?.supabaseRef||'',destination_project_ref:target.projectRef,destination_project_name:target.projectName||target.projectRef,helper_path:spec.path,helper_url:spec.url});coreJobId=cp.job.id;
      const ap=await assets('prepare',{lovable_project_id:ctx.projectId,lovable_project_name:ctx.project?.name||'',source_project_ref:ctx.backend?.supabaseRef||'',destination_project_ref:target.projectRef,destination_project_name:target.projectName||target.projectRef});assetJobId=ap.job.id;
      installedHelper=await runtime.installAndHandoff({context:ctx,job:cp.job,handoffToken:cp.handoff_token,brokerUrl:cp.broker_handoff_url,assets:{job:ap.job,handoffToken:ap.handoff_token,brokerUrl:ap.broker_handoff_url}});
      if(manifest.secretNames?.length)await runtime.handoffSecrets(installedHelper,manifest.secretNames);
      const [ci,ai]=await Promise.all([core('inspect',{job_id:coreJobId}),assets('inspect',{job_id:assetJobId})]);
      await assets('functions_manifest',{job_id:assetJobId,functions:(manifest.functions||[]).map(x=>x.slug)});await assets('apply_repo_config',{projectId:ctx.projectId,job_id:assetJobId});
      const as=await assets('status',{job_id:assetJobId});await renderJobs(ci.job,as.job||ai.job,ctx,false,manifest.warnings||[]);
    }catch(error){if(coreJobId)await core('cancel',{job_id:coreJobId}).catch(()=>{});if(assetJobId)await assets('cancel',{job_id:assetJobId}).catch(()=>{});await cleanup(ctx).catch(()=>{});toast(error?.message||String(error),true);await showInitial()}
  }
  async function renderJobs(coreJob,assetJob,ctx,resumed=false,extraWarnings=[]){
    const coreDone=coreJob?.status==='completed',assetDone=assetJob?.status==='completed',failed=['failed','cancelled'].includes(coreJob?.status)||['failed','cancelled'].includes(assetJob?.status);
    const card=open(shell(`<div class="ld2-cm-job"><small>${esc(String(coreJob?.id||assetJob?.id||'').slice(0,8))}</small><b>${esc(coreJob?.lovable_project_name||assetJob?.lovable_project_name||ctx?.project?.name||'Projeto')}</b><span>${esc(coreJob?.source_project_ref||assetJob?.source_project_ref||'Lovable Cloud')} → ${esc(coreJob?.destination_project_name||assetJob?.destination_project_name||'')}</span></div>${summary(coreJob,assetJob)}<div class="ld2-cm-stage"><small>NÚCLEO</small>${phaseBar(coreJob,CORE_PHASES,coreDone)}</div><div class="ld2-cm-stage"><small>ASSETS / CONFIG</small>${phaseBar(assetJob,ASSET_PHASES,assetDone)}</div>${warnings(coreJob,assetJob,extraWarnings)}${resumed&&coreJob?.status==='prepared'?'<div class="ld2-cm-block">O job foi recarregado antes do handoff. Cancele e prepare novamente.</div>':''}<div class="ld2-cm-current"><b>${assetDone?'CONCLUÍDO':coreDone?phaseName(assetJob?.phase):phaseName(coreJob?.phase)}</b><span>${esc(assetDone?'Migração completa finalizada.':(coreDone?assetJob?.progress?.current:coreJob?.progress?.current)||'')}</span></div><div class="ld2-cm-actions">${!failed&&!(coreDone&&assetDone)&&coreJob?.status!=='prepared'?'<button class="primary" type="button" data-cm-run>Iniciar / Retomar</button>':''}${!(coreDone&&assetDone)?'<button class="danger" type="button" data-cm-cancel>Cancelar</button>':''}${coreDone&&assetDone?'<button type="button" data-cm-done>Fechar</button>':''}</div>${logs(coreJob,assetJob)}`));
    $('[data-cm-run]',card)?.addEventListener('click',()=>runAll(coreJob,assetJob,ctx));$('[data-cm-cancel]',card)?.addEventListener('click',()=>cancelAll(coreJob,assetJob,ctx));$('[data-cm-done]',card)?.addEventListener('click',()=>parts().modal?.classList.remove('open'));
  }
  async function runCore(job,assetJob,ctx){let current=job;for(let i=0;i<12000;i++){if(cancelRequested)return current;if(current?.status==='completed')return current;if(['failed','cancelled'].includes(current?.status))throw new Error(`Núcleo terminou como ${current.status}.`);current=(await core('run_next',{job_id:current.id})).job;await renderJobs(current,assetJob,ctx);await sleep(120)}throw new Error('Limite de unidades do núcleo atingido. Reabra e retome.')}
  async function runAssets(job,coreJob,ctx){let current=job;await assets('deploy_functions',{projectId:ctx.projectId,job_id:current.id},p=>toast(`Edge Functions ${p.done||0}/${p.total||0}: ${p.current||''}`));current=(await assets('status',{job_id:current.id})).job;for(let i=0;i<50000;i++){if(cancelRequested)return current;if(current?.status==='completed')return current;if(current?.status==='failed')throw new Error('Migração de assets falhou. Consulte o log.');if(current?.status==='cancelled')throw new Error('Migração de assets cancelada.');current=(await assets('run_next',{job_id:current.id})).job;await renderJobs(coreJob,current,ctx);if(current?.status==='waiting'){await assets('apply_repo_config',{projectId:ctx.projectId,job_id:current.id}).catch(()=>{});current=(await assets('status',{job_id:current.id})).job}await sleep(150)}throw new Error('Limite de unidades dos assets atingido. Reabra e retome.')}
  async function runAll(coreJob,assetJob,ctx){if(running)return;running=true;cancelRequested=false;try{const fc=await runCore(coreJob,assetJob,ctx);const fa=await runAssets(assetJob,fc,ctx);await renderJobs(fc,fa,ctx);if(fa.status==='completed'){const clean=await cleanup(ctx);toast(clean.ok?'Migração completa concluída e helper removido.':`Migração concluída; remova o helper manualmente: ${clean.error}`,!clean.ok)}}catch(error){toast(error?.message||String(error),true);const[c,a]=await Promise.all([coreJob?.id?core('status',{job_id:coreJob.id}).catch(()=>null):null,assetJob?.id?assets('status',{job_id:assetJob.id}).catch(()=>null):null]);if(c?.job||a?.job)await renderJobs(c?.job||coreJob,a?.job||assetJob,ctx,true)}finally{running=false}}
  async function cancelAll(coreJob,assetJob,ctx){if(!confirm('Cancelar a migração completa? Alterações já aplicadas no destino não são revertidas automaticamente.'))return;cancelRequested=true;await Promise.all([coreJob?.id&&coreJob.status!=='completed'?core('cancel',{job_id:coreJob.id}).catch(()=>null):null,assetJob?.id&&assetJob.status!=='completed'?assets('cancel',{job_id:assetJob.id}).catch(()=>null):null]);const clean=await cleanup(ctx);toast(clean.ok?'Migração cancelada e helper removido.':'Migração cancelada; verifique o helper.',!clean.ok);await showInitial()}
  function installButton(){const root=document.getElementById('ld2-root');if(!root)return false;const migrations=root.querySelector('[data-cc-action="migrate"]');if(!root.querySelector('[data-cc-action="cloud-migrate"]')&&migrations){const button=document.createElement('button');button.className='ld2-cc-card accent';button.type='button';button.dataset.ccAction='cloud-migrate';button.innerHTML='<span>☁</span><div><b>Migrar Cloud</b><small>Lovable Cloud → Supabase completo</small></div>';migrations.parentNode.insertBefore(button,migrations)}if(migrations){migrations.querySelector('b')&&(migrations.querySelector('b').textContent='Aplicar Migrations');migrations.querySelector('small')&&(migrations.querySelector('small').textContent='GitHub → migrations SQL → Supabase')}return!!migrations}
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('#ld2-root [data-cc-action="cloud-migrate"]'):null;if(!target)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();showInitial().catch(error=>toast(error?.message||String(error),true))},true);
  for(let i=0;i<24;i++)setTimeout(()=>installButton(),150+i*250);addEventListener('ld2:project-context',()=>installButton());
})();
