import type { CodeIntelligenceIndex } from './index.js';
import { buildCodeDependencyGraph } from './graph.js';

export const CODEBASE_ONBOARDING_SCHEMA = 'gd-codebase-onboarding/1' as const;
export interface IndexedFileOverview {
  readonly path: string;
  readonly language: 'typescript' | 'javascript';
  readonly lines: number;
  readonly declarations: number;
  readonly imports: number;
  readonly indexedInboundImports: number;
  readonly indexedOutboundImports: number;
  readonly unresolvedImports: number;
}
export interface EntrypointHint {
  readonly path: string;
  readonly reason: 'conventional-filename' | 'no-indexed-importers';
  readonly inferredOnly: true;
  readonly executionVerified: false;
}
export interface CodebaseOnboarding {
  readonly schema: typeof CODEBASE_ONBOARDING_SCHEMA;
  readonly build: 73;
  readonly files: readonly IndexedFileOverview[];
  readonly entrypointHints: readonly EntrypointHint[];
  readonly importedEdgeCount: number;
  readonly unresolvedImportCount: number;
  readonly droppedDependencyEdges: number;
  readonly projectCoverage: 'supplied-sources-only';
  readonly inferredEntrypointsOnly: true;
  readonly executionPathVerified: false;
  readonly codeExecution: false;
  readonly externalRepositoryDiscovery: false;
  readonly persistence: false;
  readonly mutationAuthority: false;
}

export function buildCodebaseOnboarding(index: CodeIntelligenceIndex): CodebaseOnboarding {
  if (!index || index.schema !== 'gd-code-intelligence/1' || index.build !== 73) {
    throw new TypeError('Codebase onboarding requires a canonical Build 73 syntax index.');
  }
  const graph=buildCodeDependencyGraph(index);
  const inbound=new Map(index.files.map(file=>[file.path,0]));
  const outbound=new Map(index.files.map(file=>[file.path,0]));
  const unresolved=new Map(index.files.map(file=>[file.path,0]));
  const perImports=new Map(index.files.map(file=>[file.path,0]));
  const declarations=new Map(index.files.map(file=>[file.path,0]));
  for(const item of index.symbols) declarations.set(item.location.path,(declarations.get(item.location.path)??0)+1);
  for(const item of index.imports) perImports.set(item.location.path,(perImports.get(item.location.path)??0)+1);
  for(const edge of graph.edges) {
    if(edge.target) {
      inbound.set(edge.target,(inbound.get(edge.target)??0)+1);
      outbound.set(edge.source.path,(outbound.get(edge.source.path)??0)+1);
    } else {
      unresolved.set(edge.source.path,(unresolved.get(edge.source.path)??0)+1);
    }
  }
  const files=Object.freeze(index.files.map(file=>Object.freeze({
    path:file.path,language:file.language,lines:file.lines,
    declarations:declarations.get(file.path)??0,
    imports:perImports.get(file.path)??0,
    indexedInboundImports:inbound.get(file.path)??0,
    indexedOutboundImports:outbound.get(file.path)??0,
    unresolvedImports:unresolved.get(file.path)??0,
  })));
  const hints:EntrypointHint[]=[];
  for(const file of files) {
    const base=file.path.split('/').at(-1)??'';
    if(/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(base))continue;
    const conventional=/^(?:main|index|app|server|cli|entry)\.[cm]?[jt]sx?$/i.test(base);
    if(conventional||file.indexedInboundImports===0) {
      hints.push(Object.freeze({
        path:file.path,
        reason:conventional?'conventional-filename':'no-indexed-importers',
        inferredOnly:true,
        executionVerified:false,
      }));
    }
  }
  hints.sort((a,b)=>Number(b.reason==='conventional-filename')-Number(a.reason==='conventional-filename') || (a.path < b.path?-1:a.path > b.path?1:0));
  return Object.freeze({
    schema:CODEBASE_ONBOARDING_SCHEMA,
    build:73,
    files,
    entrypointHints:Object.freeze(hints.slice(0,32)),
    importedEdgeCount:graph.edges.filter(edge=>edge.target!==null).length,
    unresolvedImportCount:graph.edges.filter(edge=>edge.target===null).length,
    droppedDependencyEdges:graph.dropped,
    projectCoverage:'supplied-sources-only',
    inferredEntrypointsOnly:true,
    executionPathVerified:false,
    codeExecution:false,
    externalRepositoryDiscovery:false,
    persistence:false,
    mutationAuthority:false,
  });
}
