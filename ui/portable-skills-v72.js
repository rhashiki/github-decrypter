(()=>{
  'use strict';
  if(window.__LD72_PORTABLE_SKILLS_UI__)return;
  window.__LD72_PORTABLE_SKILLS_UI__=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function router(){return window.LovableDecrypterSkillRouter;}
  function portable(){return window.LovableDecrypterPortableSkills;}
  function parseGithubSource(sourceUrl,requestedRef,requestedPath){
    let url;
    try{url=new URL(sourceUrl);}catch{throw Object.assign(new Error('URL GitHub inválida.'),{code:'SKILL_SOURCE_URL_INVALID'});}
    if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='github.com'||url.username||url.password)throw Object.assign(new Error('Use uma URL HTTPS pública do github.com.'),{code:'SKILL_SOURCE_HOST_FORBIDDEN'});
    const parts=url.pathname.split('/').filter(Boolean);
    if(parts.length<2)throw Object.assign(new Error('Informe owner e repositório na URL.'),{code:'SKILL_GITHUB_REPOSITORY_REQUIRED'});
    const owner=parts[0],repo=parts[1].replace(/\.git$/i,'');
    let ref=requestedRef||'main';
    let path=requestedPath||'';
    if(parts[2]==='tree'){
      if(parts[3])ref=parts[3];
      if(!path&&parts.length>4)path=parts.slice(4).join('/');
    }else if(parts.length>2&&!path){
      throw Object.assign(new Error('Para subpastas use uma URL /tree/<branch>/<caminho> ou informe o caminho abaixo.'),{code:'SKILL_GITHUB_PATH_REQUIRED'});
    }
    return {owner,repo,ref,path};
  }
  function inject(){
    const panel=document.querySelector('.ld2-skills-install');
    if(!panel||panel.querySelector('[data-portable-import]'))return;
    const box=document.createElement('section');
    box.dataset.portableImport='';
    box.innerHTML=`<hr><div class="ld2-skills-install-head"><div><b>Importar Portable Skill</b><small>GitHub público · SKILL.md · validação local-first</small></div><span>V2</span></div>
      <label>URL GitHub<input type="url" data-portable-url placeholder="https://github.com/owner/repo/tree/main/skill"></label>
      <label>Revision / branch<input type="text" data-portable-ref value="main" maxlength="160"></label>
      <label>Caminho da Skill<input type="text" data-portable-path placeholder="skills/ui-review" maxlength="300"></label>
      <button type="button" class="ld2-skills-primary" data-portable-import-btn>Importar do GitHub</button>
      <small data-portable-status></small>`;
    panel.appendChild(box);
    box.querySelector('[data-portable-import-btn]').onclick=async()=>{
      const status=box.querySelector('[data-portable-status]');
      const button=box.querySelector('[data-portable-import-btn]');
      try{
        if(!router()||!portable())throw new Error('Portable Skills v2 indisponível.');
        const sourceUrl=box.querySelector('[data-portable-url]').value.trim();
        const requestedRef=box.querySelector('[data-portable-ref]').value.trim()||'main';
        const requestedPath=box.querySelector('[data-portable-path]').value.trim();
        if(!sourceUrl)throw new Error('Informe a URL pública do GitHub.');
        const source=parseGithubSource(sourceUrl,requestedRef,requestedPath);
        button.disabled=true;status.textContent='Validando e importando…';
        const skill=await router().importGithub(source);
        status.textContent=`Importada: ${skill?.display_name||skill?.slug||'Skill'} · hash ${String(skill?.contentHash||'').slice(0,12)}`;
        window.dispatchEvent(new CustomEvent('ld2:portable-skill-imported',{detail:{slug:skill?.slug||'',contentHash:skill?.contentHash||'',trust:skill?.trust||'imported'}}));
        document.querySelector('[data-skills-search]')?.dispatchEvent(new Event('input',{bubbles:true}));
      }catch(error){status.innerHTML=`<span class="error">${esc(error?.code||error?.message||String(error))}</span>`;}finally{button.disabled=false;}
    };
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('#ld2-root [data-action="skills"]'))setTimeout(inject,0);},true);
  window.addEventListener('ld2:portable-skills-ready',()=>setTimeout(inject,0));
})();
