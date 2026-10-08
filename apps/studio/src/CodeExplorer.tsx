import { useState } from 'react';
import type { CodeIntelligenceIndex, CodeIntelligenceResult, CodeSemanticResult, CodeQueryKind } from '@github-decrypter/code-intelligence';

interface SourceEntry { readonly id: number; readonly path: string; readonly content: string }
type SearchResult = { readonly mode:'syntax'; readonly data:CodeIntelligenceResult } | { readonly mode:'semantic'; readonly data:CodeSemanticResult };
const MAX_FILES = 8;
function errorText(cause:unknown):string { return (cause instanceof Error ? cause.message : 'Analysis failed.').slice(0,200); }

export function CodeExplorer() {
  const [files,setFiles] = useState<SourceEntry[]>([{id:1,path:'src/example.ts',content:''}]);
  const [active,setActive] = useState(1);
  const [index,setIndex] = useState<CodeIntelligenceIndex|null>(null);
  const [result,setResult] = useState<SearchResult|null>(null);
  const [term,setTerm] = useState('');
  const [kind,setKind] = useState<CodeQueryKind>('definitions');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const selected=files.find((file)=>file.id===active) ?? files[0]!;
  function edit(next:SourceEntry[]) { setFiles(next);setIndex(null);setResult(null);setError(null); }
  function update(field:'path'|'content',value:string) {
    edit(files.map(file=>file.id===active?{...file,[field]:value}:file));
  }
  function addFile() {
    if(files.length>=MAX_FILES)return;
    const id=Math.max(...files.map(file=>file.id))+1;
    edit([...files,{id,path:'src/scratch-'+id+'.ts',content:''}]);setActive(id);
  }
  function removeFile() {
    if(files.length===1)return;
    const next=files.filter(file=>file.id!==active);
    edit(next);setActive(next[0]!.id);
  }
  function sources() {
    if(files.some(file=>!file.content.trim()))throw new Error('Fill all source files or remove the empty ones.');
    if(files.reduce((sum,file)=>sum+file.content.length,0)>400000)throw new Error('Maximum 400,000 characters.');
    return files.map(file=>({path:file.path,content:file.content}));
  }
  async function analyze() {
    if(busy)return;
    setBusy(true);setError(null);
    try {
      const {buildCodeIntelligenceIndex}=await import('@github-decrypter/code-intelligence');
      setIndex(buildCodeIntelligenceIndex(sources()));setResult(null);
    }catch(cause){setIndex(null);setError(errorText(cause));}finally{setBusy(false);}
  }
  async function search() {
    if(!index)return;
    try {
      const {queryCodeIntelligence}=await import('@github-decrypter/code-intelligence');
      setResult({mode:'syntax',data:queryCodeIntelligence(index,{kind,term,limit:64})});setError(null);
    }catch(cause){setError(errorText(cause));}
  }
  async function navigate(path:string,line:number,column:number,mode:'semantic-definitions'|'semantic-references') {
    if(!index)return;
    try {
      const {resolveCodeSemantics}=await import('@github-decrypter/code-intelligence');
      setResult({mode:'semantic',data:resolveCodeSemantics(sources(),{kind:mode,path,line,column,limit:64})});
      const file=files.find(item=>item.path===path);
      if(file)setActive(file.id);
      setError(null);
    }catch(cause){setError(errorText(cause));}
  }
  const locations=result?.mode==='semantic'?
    (result.data.request.kind==='semantic-definitions'?result.data.definitions:result.data.references):[];
  return (
    <section className="codeex" aria-labelledby="codeex-title">
      <header>
        <small>Build 73 · local scratchpad</small>
        <h1 id="codeex-title">Code Explorer</h1>
        <p>AST navigation, definitions and references for JavaScript and TypeScript.</p>
      </header>
      <p className="codeex-note" role="note">Only text entered here is analyzed, in this browser session. Repository scanning is not connected. No code is uploaded, executed or saved.</p>
      <div className="codeex-workspace">
        <nav className="codeex-files" aria-label="Scratchpad sources">
          <div><strong>Sources</strong><button type="button" onClick={addFile} disabled={files.length>=MAX_FILES}>+ Add</button></div>
          {files.map(file=><button type="button" key={file.id}
            className={file.id===active?'is-active':''} aria-current={file.id===active?'true':undefined}
            title={file.path} onClick={()=>setActive(file.id)}>{file.path}</button>)}
        </nav>
        <div className="codeex-editor">
          <label htmlFor="codeex-path">File path</label>
          <div className="codeex-line">
            <input id="codeex-path" value={selected.path} maxLength={2048} spellCheck={false}
              onChange={event=>update('path',event.target.value)}/>
            <button type="button" onClick={removeFile} disabled={files.length===1}>Remove</button>
          </div>
          <label htmlFor="codeex-source">Source code</label>
          <textarea id="codeex-source" value={selected.content} maxLength={100000} spellCheck={false}
            onChange={event=>update('content',event.target.value)}
            placeholder="Paste TypeScript or JavaScript here. Add files to resolve relative imports."/>
          <div className="codeex-line codeex-bottom">
            <span>{files.length} / {MAX_FILES} files · {selected.content.length} chars</span>
            <button className="codeex-primary" type="button" disabled={busy} onClick={()=>void analyze()}>
              {busy?'Analyzing…':'Analyze sources'}
            </button>
          </div>
        </div>
      </div>
      {error&&<p className="codeex-error" role="alert">{error}</p>}
      {index&&<section aria-label="Code intelligence results" className="codeex-results">
        <div className="codeex-metrics"><span>{index.files.length} files</span><span>{index.symbols.length} symbols</span>
          <span>{index.imports.length} imports</span><span>{index.calls.length} calls</span></div>
        <div className="codeex-line">
          <input aria-label="Search code" placeholder="Search name…" maxLength={160} value={term} onChange={event=>setTerm(event.target.value)} />
          <select aria-label="Search type" value={kind} onChange={event=>setKind(event.target.value as CodeQueryKind)}>
            <option value="definitions">Declarations</option><option value="occurrences">Occurrences</option>
            <option value="imports">Imports</option><option value="calls">Calls</option>
          </select>
          <button type="button" onClick={()=>void search()}>Find</button>
        </div>
        <div className="codeex-hits">
          {result?.mode==='syntax'?<>
            <h2>{result.data.totalMatches} matches</h2>
            {result.data.matches.map((hit,i)=><div className="codeex-hit" key={i}>
              <code>{'name' in hit?hit.name:'specifier' in hit?hit.specifier:hit.expression}</code>
              <button type="button" onClick={()=>void navigate(hit.location.path,hit.location.line,hit.location.column,'semantic-definitions')}>
                {hit.location.path}:{hit.location.line} ↗
              </button>
            </div>)}
            {result.data.truncated&&<p>Showing first 64 results.</p>}
          </>:result?.mode==='semantic'?<>
            <h2>{result.data.symbolName ?? 'Symbol'} · {result.data.resolution}</h2>
            {locations.map((location,i)=><div className="codeex-hit" key={i}>
              <code>{location.path}:{location.line}:{location.column}</code>
              <button type="button" onClick={()=>{
                const file=files.find(item=>item.path===location.path);if(file)setActive(file.id);
              }}>Open file ↗</button>
            </div>)}
          </>:<>
            <h2>Indexed declarations · click to find references</h2>
            {index.symbols.slice(0,64).map((symbol,i)=><div className="codeex-hit" key={i}>
              <code>{symbol.name}</code>
              <button type="button" onClick={()=>void navigate(symbol.location.path,symbol.location.line,symbol.location.column,'semantic-references')}>
                {symbol.location.path}:{symbol.location.line} · references
              </button>
            </div>)}
          </>}
        </div>
      </section>}
    </section>
  );
}
