import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const json = (relative) => JSON.parse(read(relative));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const policy = json('architecture.guardian.json');
const planPackage = json('packages/plan/package.json');
const localPackage = json('apps/local/package.json');
const source = read('packages/plan/src/project-rules.ts');
const store = read('apps/local/src/project-rules-store.ts');
const localIndex = read('apps/local/src/index.ts');

assert(policy.currentBuild === 50, 'Build 50 must be the active architecture phase.');
assert(policy.phaseGates?.projectRulesBuild === 50, 'Project Rules phase gate must be Build 50.');
assert(planPackage.version === '0.0.50', '@github-decrypter/plan must be version 0.0.50.');
assert(planPackage.exports?.['./project-rules'] === './src/project-rules.ts', 'Project Rules export is missing.');
assert(localPackage.version === '0.0.50', 'Local Runtime package must be version 0.0.50.');
assert(localIndex.includes("export * from './project-rules-store.js'"), 'Local Project Rules Store export is missing.');

for (const marker of [
  'PROJECT_RULES_BUILD = 50',
  "PROJECT_RULES_SCHEMA = 'gd-project-rules/1'",
  "PROJECT_RULES_WORKSPACE_SCHEMA = 'gd-workspace/1'",
  'createProjectRules(',
  'assertProjectRulesRecord(',
  'selectProjectRulesForStage(',
  'structuredRulesOnly: true',
  'semanticInference: false',
  'automaticComplianceDecision: false',
  'impactSimulationApplied: false',
  'buildTransitionAuthorized: false',
]) assert(source.includes(marker), `Project Rules core marker missing: ${marker}`);

for (const marker of [
  'LOCAL_PROJECT_RULES_STORE_BUILD = 50',
  "LOCAL_PROJECT_RULES_STORE_SCHEMA = 'gd-local-project-rules-store/1'",
  "LOCAL_PROJECT_RULES_METADATA_PREFIX = 'project-rules:'",
  'gd_workspaces',
  '.getMetadata(',
  '.setMetadata(',
  'storageRevision',
]) assert(store.includes(marker), `Project Rules store marker missing: ${marker}`);

assert(!/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|\bchild_process\b|\bspawn\s*\(|\bexec\s*\(/.test(source + store), 'Project Rules gained transport or process authority.');
assert(!/\.enqueue\s*\(|\.claimNext\s*\(|\.grant\s*\(|\.authorize\s*\(/.test(source + store), 'Project Rules gained job/capability authority.');
assert(!source.includes('impactSimulationApplied: true'), 'Project Rules prematurely applied Impact Simulation.');
assert(!source.includes('buildTransitionAuthorized: true'), 'Project Rules prematurely authorized BUILD transition.');

console.log(JSON.stringify({ ok:true, schema:'gd-build50-project-rules-static/1', build:50 }, null, 2));
