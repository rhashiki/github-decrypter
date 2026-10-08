import assert from 'node:assert/strict';
import {
  buildCodeIntelligenceIndex,
  buildCodeDependencyGraph,
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
assert.ok(index.symbols.some((symbol) => symbol.name === 'Widget' && symbol.kind === 'ClassDeclaration'));
assert.ok(index.symbols.some((symbol) => symbol.name === 'make' && symbol.location.path === 'src/helper.ts'));
assert.ok(index.calls.some((call) => call.expression === 'make'));
assert.ok(index.imports.some((item) => item.specifier === './helper' && item.resolved === false));
assert.ok(index.imports.some((item) => item.specifier === './optional' && item.resolved === false));
assert.equal(index.occurrences.some((item) => item.name === 'Widget' && item.binding === 'declaration'), true);

const dependencies = buildCodeDependencyGraph(index);
assert.equal(dependencies.edges.length, 2);
assert.equal(dependencies.edges.find((edge) => edge.specifier === './helper')?.target, 'src/helper.ts');
assert.equal(dependencies.edges.find((edge) => edge.specifier === './optional')?.target, null);
assert.equal(dependencies.edges.find((edge) => edge.specifier === './optional')?.resolution, 'unresolved');
assert.equal(dependencies.semanticClaims, false);
assert.equal(dependencies.networkAuthority, false);
assert.equal(dependencies.mutationAuthority, false);
assert.throws(() => buildCodeDependencyGraph(index, 2049));
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
assert.throws(() => buildCodeIntelligenceIndex([{ path: '.env', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/secret.pem', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/file.py', content: '' }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/a.ts', content: 'x'.repeat(CODE_INTELLIGENCE_MAX_FILE_CHARS + 1) }]));
assert.throws(() => buildCodeIntelligenceIndex([{ path: 'src/a.ts', content: '' }, { path: 'src/a.ts', content: '' }]));
assert.throws(() => queryCodeIntelligence(index, { kind: 'imports', term: 'make', limit: 257 }));
assert.throws(() => queryCodeIntelligence(index, { kind: 'imports', term: '' }));
const reversed = buildCodeIntelligenceIndex([...files].reverse());
assert.deepEqual(index, reversed, 'Index output is deterministic for equivalent source sets');

console.log(JSON.stringify({ ok: true, build: 73, schema: CODE_INTELLIGENCE_SCHEMA,
  ast: true, bounded: true, mutationAuthority: false,
  semanticResolution: false, files: index.files.length, symbols: index.symbols.length }, null, 2));
