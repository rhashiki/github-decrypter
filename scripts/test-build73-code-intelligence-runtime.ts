import assert from 'node:assert/strict';
import {
  buildCodeIntelligenceIndex,
  buildCodeDependencyGraph,
  buildCodebaseOnboarding,
  resolveCodeSemantics,
  queryCodeIntelligence,
  CODE_INTELLIGENCE_SCHEMA,
  CODE_INTELLIGENCE_MAX_FILE_CHARS,
} from '../packages/code-intelligence/src/index.js';

const files = [
  { path: 'src/main.ts', content: [
    "import { make } from './helper';",
    'export class Widget { render() { return make(); } }',
    'const answer = make();',
    "void import('./optional');",
  ].join('\n') },
  { path: 'src/helper.ts', content: 'export function make() { return 42; }\n' },
];
const index = buildCodeIntelligenceIndex(files);
assert.equal(index.schema, CODE_INTELLIGENCE_SCHEMA);
assert.equal(index.build, 73);
assert.deepEqual(index.files.map((f) => f.path), ['src/helper.ts', 'src/main.ts']);
assert.equal(index.astBacked, true);
assert.equal(index.semanticTypeResolution, false);
assert.equal(index.dependencyResolution, false);
assert.equal(index.callGraphResolution, false);
assert.equal(index.mutationAuthority, false);
assert.equal(index.filesystemAuthority, false);
assert.equal(index.networkAuthority, false);
assert.equal(index.persistence, false);
assert.equal(index.droppedOversizedIdentifiers, 0);
assert.ok(index.symbols.some((symbol) => symbol.name === 'Widget' && symbol.kind === 'ClassDeclaration'));
assert.ok(index.symbols.some((symbol) => symbol.name === 'make' && symbol.location.path === 'src/helper.ts'));
assert.ok(index.calls.some((call) => call.expression === 'make'));
assert.ok(index.imports.some((item) => item.specifier === './helper' && item.resolved === false));
assert.ok(index.imports.some((item) => item.specifier === './optional' && item.resolved === false));
assert.equal(index.occurrences.some((item) => item.name === 'Widget' && item.binding === 'declaration'), true);

const overview = buildCodebaseOnboarding(index);
assert.equal(overview.projectCoverage, 'supplied-sources-only');
assert.equal(overview.inferredEntrypointsOnly, true);
assert.equal(overview.executionPathVerified, false);
assert.equal(overview.codeExecution, false);
assert.equal(overview.mutationAuthority, false);
assert.equal(overview.files.length, 2);
assert.equal(overview.files.find(item=>item.path==='src/helper.ts')?.indexedInboundImports, 1);
assert.ok(overview.entrypointHints.some(item=>item.path==='src/main.ts' && item.reason==='conventional-filename'));
assert.equal(overview.entrypointHints.some(item=>item.path==='src/helper.ts'), false);
assert.throws(()=>buildCodebaseOnboarding({} as never));
const dependencies = buildCodeDependencyGraph(index);
assert.equal(dependencies.edges.length, 2);
assert.equal(dependencies.edges.find((edge) => edge.specifier === './helper')?.target, 'src/helper.ts');
assert.equal(dependencies.edges.find((edge) => edge.specifier === './optional')?.target, null);
assert.equal(dependencies.edges.find((edge) => edge.specifier === './optional')?.resolution, 'unresolved');
assert.equal(dependencies.semanticClaims, false);
assert.equal(dependencies.networkAuthority, false);
assert.equal(dependencies.mutationAuthority, false);
assert.throws(() => buildCodeDependencyGraph(index, 2049));

const semanticDefinition = resolveCodeSemantics(files, {
  kind: 'semantic-definitions', path: 'src/main.ts', line: 3, column: 16,
});
assert.equal(semanticDefinition.resolution, 'resolved');
assert.deepEqual(semanticDefinition.definitions, [{ path: 'src/helper.ts', line: 1, column: 17 }]);
assert.equal(semanticDefinition.hostFilesystemAccess, false);
assert.equal(semanticDefinition.compiler, 'typescript-program-memory-only');
assert.equal(semanticDefinition.localFilesOnly, true);
assert.equal(semanticDefinition.networkAuthority, false);
assert.equal(semanticDefinition.mutationAuthority, false);
const semanticReferences = resolveCodeSemantics(files, {
  kind: 'semantic-references', path: 'src/main.ts', line: 3, column: 16,
});
assert.equal(semanticReferences.resolution, 'resolved');
assert.equal(semanticReferences.totalReferences, 4);
assert.ok(semanticReferences.references.some((item) => item.path === 'src/main.ts' && item.line === 2));
assert.ok(semanticReferences.references.some((item) => item.path === 'src/helper.ts' && item.line === 1));
const missingSemantic = resolveCodeSemantics(files, {
  kind: 'semantic-definitions', path: 'src/main.ts', line: 4, column: 14,
});
assert.equal(missingSemantic.resolution, 'unresolved');
assert.deepEqual(missingSemantic.definitions, []);
assert.throws(() => resolveCodeSemantics(files, {
  kind: 'semantic-definitions', path: '../outside.ts', line: 1, column: 1,
}));
assert.throws(() => resolveCodeSemantics(files, {
  kind: 'semantic-definitions', path: 'src/main.ts', line: 1, column: 9999,
}));

const defs = queryCodeIntelligence(index, { kind: 'definitions', term: 'make' });
assert.equal(defs.totalMatches, 2, 'Index returns a local import binding and the original export without pretending semantic linkage');
assert.equal(defs.matches[0]?.location.line, 1);
assert.equal(defs.semanticResolution, false);
const occ = queryCodeIntelligence(index, { kind: 'occurrences', term: 'make', limit: 1 });
assert.equal(occ.truncated, true);
assert.equal(occ.matches.length, 1);
assert.equal(queryCodeIntelligence(index, { kind: 'imports', term: 'optional' }).totalMatches, 1);
assert.equal(queryCodeIntelligence(index, { kind: 'definitions', term: 'make', path: 'src/main.ts' }).totalMatches, 1);
assert.equal(JSON.stringify(index).includes('return 42;'), false, 'Full source must not be returned');

assert.throws(() => buildCodeIntelligenceIndex([{ path: '../outside.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: '/etc/passwd.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'C:\\private\\key.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: '.git/config.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: '.GIT/config.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/Node_Modules/x.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/secrets/internal.ts', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: '.env', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/secret.pem', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/file.py', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/a.ts', content: 'x'.repeat(CODE_INTELLIGENCE_MAX_FILE_CHARS + 1) }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/a.ts', content: '' }, { path: 'src/a.ts', content: '' }]));
assert.throws(() => queryCodeIntelligence(index, { kind: 'imports', term: 'make', limit: 257 }));
assert.throws(() => queryCodeIntelligence(index, { kind: 'imports', term: '' }));
assert.throws(() => queryCodeIntelligence(index, { kind: 'definitions', term: 'make', injectedSecret: 'must-not-echo' } as never));
assert.throws(() => queryCodeIntelligence(index, { kind: 'definitions', term: 'make\ninject' }));
const oversizedName = 'x'.repeat(900);
const boundedIndex = buildCodeIntelligenceIndex([{
  path:'src/big.ts',
  content:'export const '+oversizedName+' = 1;\n'+oversizedName+'();',
}]);
assert.ok(boundedIndex.droppedOversizedIdentifiers >= 2);
assert.ok(boundedIndex.symbols.every(item => item.name.length <= 160));
assert.ok(boundedIndex.occurrences.every(item => item.name.length <= 160));
assert.ok(boundedIndex.calls.every(item => item.expression.length <= 160));
const reversed = buildCodeIntelligenceIndex([...files].reverse());
assert.deepEqual(index, reversed, 'Index output is deterministic for equivalent source sets');

console.log(JSON.stringify({ ok: true, build: 73, schema: CODE_INTELLIGENCE_SCHEMA,
  ast: true, bounded: true, mutationAuthority: false,
  semanticResolution: false, files: index.files.length, symbols: index.symbols.length }, null, 2));
