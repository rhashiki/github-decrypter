import * as ts from 'typescript';
import {
  buildCodeIntelligenceIndex,
  type CodeFileInput,
  type CodeLocation,
} from './index.js';

export const CODE_SEMANTIC_SCHEMA = 'gd-code-semantic-navigation/1' as const;
export const CODE_SEMANTIC_MAX_RESULTS = 128 as const;
const PREFIX = '/gd-virtual-workspace/';

export interface CodeSemanticRequest {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly kind: 'semantic-definitions' | 'semantic-references';
  readonly limit?: number;
}
export interface CodeSemanticResult {
  readonly schema: typeof CODE_SEMANTIC_SCHEMA;
  readonly build: 73;
  readonly request: CodeSemanticRequest;
  readonly symbolName: string | null;
  readonly definitions: readonly CodeLocation[];
  readonly references: readonly CodeLocation[];
  readonly totalDefinitions: number;
  readonly totalReferences: number;
  readonly truncated: boolean;
  readonly resolution: 'resolved' | 'unresolved';
  readonly compiler: 'typescript-program-memory-only';
  readonly localFilesOnly: true;
  readonly hostFilesystemAccess: false;
  readonly emitsCode: false;
  readonly networkAuthority: false;
  readonly mutationAuthority: false;
  readonly persistence: false;
}

function locate(path: string, file: ts.SourceFile, node: ts.Node): CodeLocation {
  const at = file.getLineAndCharacterOfPosition(node.getStart(file));
  return Object.freeze({ path, line: at.line + 1, column: at.character + 1 });
}
function lexicalSort(a: CodeLocation, b: CodeLocation): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || a.column - b.column;
}
function unique(items: readonly CodeLocation[]): readonly CodeLocation[] {
  const seen = new Set<string>();
  return Object.freeze([...items].sort(lexicalSort).filter((entry) => {
    const key = entry.path + ':' + entry.line + ':' + entry.column;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}
function symbolTarget(checker: ts.TypeChecker, node: ts.Identifier): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const target = checker.getAliasedSymbol(symbol);
    return target?.declarations?.length ? target : undefined;
  }
  return symbol.declarations?.length ? symbol : undefined;
}
function identifierAt(file: ts.SourceFile, pos: number): ts.Identifier | undefined {
  let found: ts.Identifier | undefined;
  function walk(node: ts.Node): void {
    if (pos < node.getStart(file) || pos >= node.getEnd()) return;
    if (ts.isIdentifier(node)) found = node;
    ts.forEachChild(node, walk);
  }
  walk(file);
  return found;
}

export function resolveCodeSemantics(files: readonly CodeFileInput[], request: CodeSemanticRequest): CodeSemanticResult {
  const index = buildCodeIntelligenceIndex(files); // strict source/path/AST budgets precede semantic work
  if (!request || !['semantic-definitions','semantic-references'].includes(request.kind)) {
    throw new TypeError('Unsupported Code Intelligence semantic query.');
  }
  if (typeof request.path !== 'string' || !index.files.some((item) => item.path === request.path)) {
    throw new TypeError('Semantic query path must exactly match an indexed source file.');
  }
  if (!Number.isInteger(request.line) || request.line < 1 || !Number.isInteger(request.column) || request.column < 1) {
    throw new TypeError('Semantic query line/column must be positive integers.');
  }
  const limit = request.limit ?? 64;
  if (!Number.isInteger(limit) || limit < 1 || limit > CODE_SEMANTIC_MAX_RESULTS) {
    throw new RangeError('Semantic result limit must be between 1 and 128.');
  }
  const fileMap = new Map<string, string>();
  for (const file of files) fileMap.set(PREFIX + file.path.replace(/\\/g, '/'), file.content);
  const settings: ts.CompilerOptions = {
    noLib: true,
    types: [],
    noEmit: true,
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
  };
  const directories = new Set<string>(['/', PREFIX.slice(0, -1)]);
  for (const name of fileMap.keys()) {
    let directory = name.slice(0, name.lastIndexOf('/'));
    while (directory && !directories.has(directory)) {
      directories.add(directory);
      directory = directory.slice(0, directory.lastIndexOf('/'));
    }
  }
  const parsed = new Map<string, ts.SourceFile>();
  const host: ts.CompilerHost = {
    getSourceFile: (name, lang) => {
      if (!fileMap.has(name)) return undefined;
      let source = parsed.get(name);
      if (!source) {
        source = ts.createSourceFile(name, fileMap.get(name)!, lang, true);
        parsed.set(name, source);
      }
      return source;
    },
    getDefaultLibFileName: () => PREFIX + 'no-lib.d.ts',
    getCurrentDirectory: () => PREFIX.slice(0, -1),
    getDirectories: () => [],
    directoryExists: (name) => directories.has(name),
    fileExists: (name) => fileMap.has(name),
    readFile: (name) => fileMap.get(name),
    writeFile: () => { throw new Error('Semantic index cannot emit files.'); },
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    realpath: (name) => name,
  };
  const program = ts.createProgram([...fileMap.keys()].sort(), settings, host);
  const checker = program.getTypeChecker();
  const targetFile = program.getSourceFile(PREFIX + request.path);
  if (!targetFile || request.line > targetFile.getLineAndCharacterOfPosition(targetFile.end).line + 1) {
    throw new RangeError('Semantic query line exceeds file range.');
  }
  const lineStart = targetFile.getPositionOfLineAndCharacter(request.line - 1, 0);
  const lineEnd = request.line < targetFile.getLineAndCharacterOfPosition(targetFile.end).line + 1
    ? targetFile.getPositionOfLineAndCharacter(request.line, 0) : targetFile.end;
  const position = lineStart + request.column - 1;
  if (position >= lineEnd || position >= targetFile.end) {
    throw new RangeError('Semantic query column exceeds line range.');
  }
  const origin = identifierAt(targetFile, position);
  const original = origin ? symbolTarget(checker, origin) : undefined;
  const locations: CodeLocation[] = [];
  for (const declaration of original?.declarations ?? []) {
    const source = declaration.getSourceFile();
    if (!fileMap.has(source.fileName)) continue;
    const name = (declaration as ts.NamedDeclaration).name;
    const node = name && ts.isIdentifier(name) ? name : declaration;
    locations.push(locate(source.fileName.slice(PREFIX.length), source, node));
  }
  const definitions = unique(locations);
  const references: CodeLocation[] = [];
  if (original && request.kind === 'semantic-references' && definitions.length) {
    let budget = 0;
    for (const file of program.getSourceFiles()) {
      if (!fileMap.has(file.fileName)) continue;
      function visit(node: ts.Node): void {
        if (++budget > 150_000) throw new RangeError('Semantic AST visit budget exceeded.');
        if (ts.isIdentifier(node) && symbolTarget(checker, node) === original) {
          references.push(locate(file.fileName.slice(PREFIX.length), file, node));
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
  const distinctReferences = unique(references);
  const selectedDefinitions = request.kind === 'semantic-definitions' ? definitions.slice(0, limit) : definitions.slice(0, 16);
  const selectedReferences = distinctReferences.slice(0, limit);
  const requestSnapshot: CodeSemanticRequest = Object.freeze({
    kind: request.kind, path: request.path, line: request.line, column: request.column, limit,
  });
  return Object.freeze({
    schema: CODE_SEMANTIC_SCHEMA,
    build: 73,
    request: requestSnapshot,
    symbolName: origin && origin.text.length <= 160 ? origin.text : null,
    definitions: Object.freeze(selectedDefinitions),
    references: Object.freeze(selectedReferences),
    totalDefinitions: definitions.length,
    totalReferences: distinctReferences.length,
    truncated: definitions.length > selectedDefinitions.length || distinctReferences.length > selectedReferences.length,
    resolution: definitions.length ? 'resolved' : 'unresolved',
    compiler: 'typescript-program-memory-only',
    localFilesOnly: true,
    hostFilesystemAccess: false,
    emitsCode: false,
    networkAuthority: false,
    mutationAuthority: false,
    persistence: false,
  });
}
