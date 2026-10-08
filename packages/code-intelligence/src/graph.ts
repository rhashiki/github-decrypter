import type { CodeIntelligenceIndex, CodeLocation } from './index.js';

export const CODE_DEPENDENCY_GRAPH_SCHEMA = 'gd-code-dependency-graph/1' as const;
export const CODE_DEPENDENCY_MAX_EDGES = 2048 as const;

export interface CodeDependencyEdge {
  readonly source: CodeLocation;
  readonly specifier: string;
  readonly target: string | null;
  readonly resolution: 'indexed-relative-file' | 'unresolved';
  readonly typeChecked: false;
  readonly executable: false;
}
export interface CodeDependencyGraph {
  readonly schema: typeof CODE_DEPENDENCY_GRAPH_SCHEMA;
  readonly build: 73;
  readonly edges: readonly CodeDependencyEdge[];
  readonly totalImports: number;
  readonly dropped: number;
  readonly bounded: true;
  readonly sourceGrounded: true;
  readonly semanticClaims: false;
  readonly filesystemReads: false;
  readonly mutationAuthority: false;
  readonly networkAuthority: false;
}

function candidatePaths(importer: string, specifier: string): readonly string[] {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return [];
  if (specifier.length > 512 || /[\u0000-\u001f\u007f\\?#]/.test(specifier)) return [];
  const stack = importer.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (!stack.length) return [];
      stack.pop();
      continue;
    }
    if (part === '.git' || part === 'node_modules' || part === '.env') return [];
    stack.push(part);
  }
  const base = stack.join('/');
  if (!base || base.startsWith('/')) return [];
  const explicit = /\.[cm]?[jt]sx?$/i.test(base);
  if (explicit) return [base];
  return [
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    base + '.mts', base + '.cts', base + '.mjs', base + '.cjs',
    base + '/index.ts', base + '/index.tsx', base + '/index.js', base + '/index.jsx',
  ];
}

export function buildCodeDependencyGraph(index: CodeIntelligenceIndex, maxEdges: number = CODE_DEPENDENCY_MAX_EDGES): CodeDependencyGraph {
  if (!index || index.schema !== 'gd-code-intelligence/1' || index.build !== 73) {
    throw new TypeError('Code Dependency Graph requires the canonical Build 73 AST index.');
  }
  if (!Number.isInteger(maxEdges) || maxEdges < 1 || maxEdges > CODE_DEPENDENCY_MAX_EDGES) {
    throw new RangeError('Code Dependency Graph edge budget must be between 1 and 2048.');
  }
  const files = new Set(index.files.map((entry) => entry.path));
  const edges: CodeDependencyEdge[] = [];
  for (const item of index.imports.slice(0, maxEdges)) {
    const target = candidatePaths(item.location.path, item.specifier).find((candidate) => files.has(candidate)) ?? null;
    edges.push(Object.freeze({
      source: item.location,
      specifier: item.specifier,
      target,
      resolution: target ? 'indexed-relative-file' : 'unresolved',
      typeChecked: false,
      executable: false,
    }));
  }
  return Object.freeze({
    schema: CODE_DEPENDENCY_GRAPH_SCHEMA,
    build: 73,
    edges: Object.freeze(edges),
    totalImports: index.imports.length,
    dropped: Math.max(0, index.imports.length - edges.length),
    bounded: true,
    sourceGrounded: true,
    semanticClaims: false,
    filesystemReads: false,
    mutationAuthority: false,
    networkAuthority: false,
  });
}
