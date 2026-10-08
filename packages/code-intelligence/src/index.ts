import * as ts from 'typescript';

export const CODE_INTELLIGENCE_BUILD = 73 as const;
export const CODE_INTELLIGENCE_SCHEMA = 'gd-code-intelligence/1' as const;
export const CODE_INTELLIGENCE_MAX_FILES = 256 as const;
export const CODE_INTELLIGENCE_MAX_FILE_CHARS = 256_000 as const;
export const CODE_INTELLIGENCE_MAX_TOTAL_CHARS = 4_000_000 as const;
export const CODE_INTELLIGENCE_MAX_AST_NODES = 150_000 as const;
export const CODE_INTELLIGENCE_MAX_QUERY_RESULTS = 256 as const;
export const CODE_INTELLIGENCE_MAX_IDENTIFIER_CHARS = 160 as const;

export type SourceLanguage = 'typescript' | 'javascript';
export type CodeQueryKind = 'definitions' | 'occurrences' | 'imports' | 'calls';
export interface CodeFileInput {
  readonly path: string;
  readonly content: string;
}
export interface CodeLocation {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}
export interface CodeSymbol {
  readonly name: string;
  readonly kind: string;
  readonly location: CodeLocation;
}
export interface CodeOccurrence {
  readonly name: string;
  readonly location: CodeLocation;
  readonly binding: 'declaration' | 'unresolved';
}
export interface CodeImport {
  readonly specifier: string;
  readonly location: CodeLocation;
  readonly resolved: false;
}
export interface CodeCall {
  readonly expression: string;
  readonly location: CodeLocation;
  readonly resolved: false;
}
export interface CodeIndexedFile {
  readonly path: string;
  readonly language: SourceLanguage;
  readonly lines: number;
}
export interface CodeIntelligenceIndex {
  readonly schema: typeof CODE_INTELLIGENCE_SCHEMA;
  readonly build: typeof CODE_INTELLIGENCE_BUILD;
  readonly files: readonly CodeIndexedFile[];
  readonly symbols: readonly CodeSymbol[];
  readonly occurrences: readonly CodeOccurrence[];
  readonly imports: readonly CodeImport[];
  readonly calls: readonly CodeCall[];
  readonly droppedOversizedIdentifiers: number;
  readonly astBacked: true;
  readonly semanticTypeResolution: false;
  readonly dependencyResolution: false;
  readonly callGraphResolution: false;
  readonly mutationAuthority: false;
  readonly executionAuthority: false;
  readonly filesystemAuthority: false;
  readonly networkAuthority: false;
  readonly persistence: false;
}
export interface CodeIntelligenceQuery {
  readonly kind: CodeQueryKind;
  readonly term: string;
  readonly path?: string;
  readonly limit?: number;
}
export interface CodeIntelligenceResult {
  readonly schema: 'gd-code-intelligence-query/1';
  readonly query: CodeIntelligenceQuery;
  readonly matches: readonly (CodeSymbol | CodeOccurrence | CodeImport | CodeCall)[];
  readonly totalMatches: number;
  readonly truncated: boolean;
  readonly sourceGrounded: true;
  readonly readOnly: true;
  readonly semanticResolution: false;
}

const EXTENSIONS = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const BLOCKED_SEGMENTS = new Set([
  '.git', 'node_modules', '.next', '.cache', 'dist', 'build', 'coverage',
  '.ssh', '.aws', '.config', '.vscode', '.idea',
]);
const SENSITIVE_FILE = /^(?:\.env(?:\..*)?|id_(?:rsa|ed25519|ecdsa)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets(?:\..*)?)$/i;

function canonicalPath(value: string): string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Code Intelligence requires a bounded workspace-relative source path.');
  }
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new TypeError('Absolute source paths are prohibited.');
  }
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || BLOCKED_SEGMENTS.has(part))) {
    throw new TypeError('Unsafe or noncanonical source path.');
  }
  if (parts.some((part) => SENSITIVE_FILE.test(part)) || !EXTENSIONS.test(normalized)) {
    throw new TypeError('Unsupported or sensitive source path.');
  }
  return normalized;
}

function scriptKind(path: string): ts.ScriptKind {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/i.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function locationOf(path: string, file: ts.SourceFile, node: ts.Node): CodeLocation {
  const position = file.getLineAndCharacterOfPosition(node.getStart(file));
  return Object.freeze({ path, line: position.line + 1, column: position.character + 1 });
}

function identifierName(node: ts.Node): ts.Identifier | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isMethodDeclaration(node)
      || ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)
      || ts.isParameter(node) || ts.isImportSpecifier(node) || ts.isExportSpecifier(node)) {
    return node.name && ts.isIdentifier(node.name) ? node.name : undefined;
  }
  return undefined;
}

function nodeName(node: ts.Node): string {
  return ts.SyntaxKind[node.kind] ?? 'Unknown';
}

export function buildCodeIntelligenceIndex(files: readonly CodeFileInput[]): CodeIntelligenceIndex {
  if (!Array.isArray(files) || files.length < 1 || files.length > CODE_INTELLIGENCE_MAX_FILES) {
    throw new RangeError('Code Intelligence requires 1–256 source files.');
  }
  const normalized = files.map((file) => {
    if (!file || typeof file.content !== 'string' || file.content.length > CODE_INTELLIGENCE_MAX_FILE_CHARS) {
      throw new TypeError('Code Intelligence source content is invalid or exceeds its per-file bound.');
    }
    return { path: canonicalPath(file.path), content: file.content };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (new Set(normalized.map((f) => f.path)).size !== normalized.length) {
    throw new TypeError('Duplicate canonical source paths are prohibited.');
  }
  if (normalized.reduce((sum, file) => sum + file.content.length, 0) > CODE_INTELLIGENCE_MAX_TOTAL_CHARS) {
    throw new RangeError('Code Intelligence aggregate source size exceeds its bound.');
  }

  const symbols: CodeSymbol[] = [];
  const occurrences: CodeOccurrence[] = [];
  const imports: CodeImport[] = [];
  const calls: CodeCall[] = [];
  const summary: CodeIndexedFile[] = [];
  let nodeCount = 0;
  let droppedOversizedIdentifiers = 0;

  for (const entry of normalized) {
    const file = ts.createSourceFile(entry.path, entry.content, ts.ScriptTarget.Latest, true, scriptKind(entry.path));
    summary.push(Object.freeze({
      path: entry.path,
      language: /\.[cm]?jsx?$/i.test(entry.path) ? 'javascript' : 'typescript',
      lines: file.getLineAndCharacterOfPosition(file.end).line + 1,
    }));
    const declarations = new Set<number>();
    const mark = (node: ts.Node): void => {
      nodeCount += 1;
      if (nodeCount > CODE_INTELLIGENCE_MAX_AST_NODES) {
        throw new RangeError('Code Intelligence AST node budget exceeded.');
      }

      const definition = identifierName(node);
      if (definition && definition.text.length <= CODE_INTELLIGENCE_MAX_IDENTIFIER_CHARS) {
        declarations.add(definition.getStart(file));
        symbols.push(Object.freeze({
          name: definition.text,
          kind: nodeName(node),
          location: locationOf(entry.path, file, definition),
        }));
      }

      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
          && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(Object.freeze({
          specifier: node.moduleSpecifier.text.slice(0, 512),
          location: locationOf(entry.path, file, node.moduleSpecifier),
          resolved: false,
        }));
      }
      if (ts.isCallExpression(node)) {
        const rawName = ts.isIdentifier(node.expression) ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text
          : '<dynamic-call>';
        const expression = rawName.length <= CODE_INTELLIGENCE_MAX_IDENTIFIER_CHARS
          ? rawName : '<oversized-identifier>';
        calls.push(Object.freeze({
          expression,
          location: locationOf(entry.path, file, node.expression),
          resolved: false,
        }));
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          imports.push(Object.freeze({
            specifier: node.arguments[0].text.slice(0, 512),
            location: locationOf(entry.path, file, node.arguments[0]),
            resolved: false,
          }));
        }
      }
      if (ts.isIdentifier(node)) {
        if (node.text.length > CODE_INTELLIGENCE_MAX_IDENTIFIER_CHARS) {
          droppedOversizedIdentifiers += 1;
        } else occurrences.push(Object.freeze({
          name: node.text,
          location: locationOf(entry.path, file, node),
          binding: declarations.has(node.getStart(file)) ? 'declaration' : 'unresolved',
        }));
      }
      ts.forEachChild(node, mark);
    };
    mark(file);
  }
  const bySource = (a: { location: CodeLocation }, b: { location: CodeLocation }): number =>
    a.location.path.localeCompare(b.location.path, 'en')
    || a.location.line - b.location.line || a.location.column - b.location.column;
  return Object.freeze({
    schema: CODE_INTELLIGENCE_SCHEMA,
    build: CODE_INTELLIGENCE_BUILD,
    files: Object.freeze(summary),
    symbols: Object.freeze(symbols.sort(bySource)),
    occurrences: Object.freeze(occurrences.sort(bySource)),
    imports: Object.freeze(imports.sort(bySource)),
    calls: Object.freeze(calls.sort(bySource)),
    droppedOversizedIdentifiers,
    astBacked: true,
    semanticTypeResolution: false,
    dependencyResolution: false,
    callGraphResolution: false,
    mutationAuthority: false,
    executionAuthority: false,
    filesystemAuthority: false,
    networkAuthority: false,
    persistence: false,
  });
}

export function queryCodeIntelligence(index: CodeIntelligenceIndex, query: CodeIntelligenceQuery): CodeIntelligenceResult {
  if (!index || index.schema !== CODE_INTELLIGENCE_SCHEMA || !query || typeof query.term !== 'string'
      || !query.term.trim() || query.term.length > 160) {
    throw new TypeError('Invalid Code Intelligence index or query.');
  }
  if (Object.keys(query).some((key) => !['kind','term','path','limit'].includes(key))
      || /[\u0000-\u001f\u007f]/.test(query.term)) {
    throw new TypeError('Code Intelligence query contains unsafe or unknown fields.');
  }
  if (!['definitions', 'occurrences', 'imports', 'calls'].includes(query.kind)) {
    throw new TypeError('Unsupported Code Intelligence query kind.');
  }
  const limit = query.limit ?? 64;
  if (!Number.isInteger(limit) || limit < 1 || limit > CODE_INTELLIGENCE_MAX_QUERY_RESULTS) {
    throw new RangeError('Code Intelligence query limit must be between 1 and 256.');
  }
  const path = query.path === undefined ? undefined : canonicalPath(query.path);
  const collection = query.kind === 'definitions' ? index.symbols
    : query.kind === 'occurrences' ? index.occurrences
    : query.kind === 'imports' ? index.imports : index.calls;
  const term = query.term.trim().toLocaleLowerCase('en');
  const matches = collection.filter((record) => {
    if (path && record.location.path !== path) return false;
    const token = 'name' in record ? record.name : 'specifier' in record ? record.specifier : record.expression;
    return token.toLocaleLowerCase('en').includes(term);
  });
  return Object.freeze({
    schema: 'gd-code-intelligence-query/1',
    query: Object.freeze({ kind: query.kind, term: query.term.trim(), limit, ...(path ? { path } : {}) }),
    matches: Object.freeze(matches.slice(0, limit)),
    totalMatches: matches.length,
    truncated: matches.length > limit,
    sourceGrounded: true,
    readOnly: true,
    semanticResolution: false,
  });
}

export { buildCodeDependencyGraph, CODE_DEPENDENCY_GRAPH_SCHEMA, CODE_DEPENDENCY_MAX_EDGES } from './graph.js';
export type { CodeDependencyGraph, CodeDependencyEdge } from './graph.js';

export { resolveCodeSemantics, CODE_SEMANTIC_SCHEMA, CODE_SEMANTIC_MAX_RESULTS } from './semantic.js';
export type { CodeSemanticRequest, CodeSemanticResult } from './semantic.js';
