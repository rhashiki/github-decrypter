import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.changeTrackingAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name)) files.push(absolute);
    }
  }
  return files.sort();
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/git' || rule.minimumBuild !== 22) {
  violations.push({ code: 'AG200', message: 'Human vs AI Change Tracking policy is missing or invalid.' });
} else {
  const contract = read('packages/git/src/index.ts');
  for (const marker of [
    "CHANGE_TRACKING_SCHEMA = 'gd-change-tracking/1'",
    "CHANGE_ORIGINS = ['human', 'ai', 'mixed', 'unknown']",
    'ChangePathAttribution',
    'ChangeTrackingSnapshot',
    'AiChangeSessionRecord',
  ]) {
    if (!contract.includes(marker)) violations.push({ code: 'AG201', message: 'Change Tracking contract invariant missing.', detail: marker });
  }
  if (/node:(?:fs|path|child_process|os|http|https|net|tls)|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG201', message: 'Change Tracking contract stopped being environment-neutral.' });
  }

  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_change_(?:sessions|path_events)\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({ code: 'AG202', message: 'Change Tracking persistence authority escaped apps/local.', detail: relative });
    }
  }

  const migrations = read(`${rule.ownerRoot}/src/database-migrations.ts`);
  for (const marker of [
    'CREATE TABLE gd_change_sessions',
    'CREATE TABLE gd_change_path_events',
    "name: 'human-ai-change-tracking'",
    'version: 10',
    "origin TEXT NOT NULL CHECK (origin IN ('human', 'ai', 'mixed', 'unknown'))",
    'state_digest TEXT NOT NULL',
  ]) {
    if (!migrations.includes(marker)) violations.push({ code: 'AG202', message: 'Change Tracking persistence invariant missing.', detail: marker });
  }
  const changeSchema = migrations.slice(migrations.indexOf('const MIGRATION_010_SQL'), migrations.indexOf('function checksum'));
  if (/\b(?:content|file_content|source_text|patch_text|diff_text|blob_content)\s+(?:TEXT|BLOB)\b/i.test(changeSchema)) {
    violations.push({ code: 'AG203', message: 'Change Tracking may not persist project source/file contents.' });
  }

  const trackerPath = `${rule.ownerRoot}/src/change-tracker.ts`;
  const tracker = read(trackerPath);
  for (const marker of [
    'class ChangeTracker',
    'beginAiChange',
    'completeAiChange',
    'observeHumanChanges',
    'changeTrackingWorkspaceResource',
    "capability: 'WRITE'",
    "origin: 'unknown'",
    "combineAi",
    "combineHuman",
    'baselineDigest',
    'contentPersistence: false',
    'filesystemMutation: false',
    'externalTransport: false',
  ]) {
    if (!tracker.includes(marker)) violations.push({ code: 'AG204', message: 'Change Tracking implementation invariant missing.', detail: marker });
  }
  const begin = tracker.indexOf('async beginAiChange(');
  const complete = tracker.indexOf('async completeAiChange(');
  if (begin < 0 || !tracker.slice(begin, begin + 4500).includes('#authorizeAi')) {
    violations.push({ code: 'AG204', message: 'AI change session start bypasses WRITE capability authorization.' });
  }
  if (complete < 0 || !tracker.includes('#finishAiChange') || !tracker.includes('this.#authorizeAi(workspaceId, authorization)')) {
    violations.push({ code: 'AG204', message: 'AI change session completion bypasses WRITE capability authorization.' });
  }

  if (/\b(?:guess|inferAi|inferOrigin|classifyByModel|modelAttribution|authorEmailAttribution)\b/.test(tracker)) {
    violations.push({ code: 'AG205', message: 'Build 22 attribution must use explicit boundaries, not heuristic AI inference.' });
  }
  if (!tracker.includes('explicitBoundaries: true') || !tracker.includes("previous?.origin ?? null") || !tracker.includes("return 'mixed'")) {
    violations.push({ code: 'AG205', message: 'Explicit/fail-closed attribution boundary was weakened.' });
  }

  if (/\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync|unlink|mkdirSync|mkdir|renameSync|rename|copyFileSync|copyFile|truncateSync|truncate|chmodSync|chmod)\s*\(/.test(tracker)) {
    violations.push({ code: 'AG206', message: 'Change Tracking may not mutate workspace files.' });
  }

  const server = read(`${rule.ownerRoot}/src/server.ts`);
  if (/\/v\d+\/(?:change-tracking|changes|attribution|change-origin)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG207', message: 'Change Tracking HTTP/RPC transport arrived before an owning phase.' });
  }

  const daemon = read(`${rule.ownerRoot}/src/daemon.ts`);
  for (const marker of ['createChangeTracker', 'changeTracking.initialize()', 'getChangeTrackerStatus', 'changeTracking.shutdown']) {
    if (!daemon.includes(marker)) violations.push({ code: 'AG208', message: 'Change Tracking daemon integration invariant missing.', detail: marker });
  }
  const lifecycle = read(`${rule.ownerRoot}/src/lifecycle.ts`);
  for (const marker of [
    'gd.local.change-tracking.ready',
    'gd.local.change-tracking.human-observed',
    'gd.local.change-tracking.ai-started',
    'gd.local.change-tracking.ai-completed',
    'gd.local.change-tracking.invalidated',
  ]) {
    if (!lifecycle.includes(marker)) violations.push({ code: 'AG208', message: 'Change Tracking lifecycle event invariant missing.', detail: marker });
  }
  if (!server.includes('changeTrackingReady') || !server.includes('activeAiChangeSessions')) {
    violations.push({ code: 'AG208', message: 'Change Tracking readiness integration is missing.' });
  }

  if (
    rule.gitRuntimeBuild !== 21
    || rule.githubAppBuild !== 23
    || rule.agentRuntimeBuild !== 58
    || rule.codingAgentBuild !== 60
    || rule.commitWorkflowBuild !== 109
    || rule.workspaceScoped !== true
    || rule.pathLevel !== true
    || rule.hunkLevel !== false
    || rule.explicitAttributionBoundaries !== true
    || rule.aiWriteCapability !== 'WRITE'
    || rule.contentPersistence !== false
    || rule.filesystemMutation !== false
    || rule.externalTransport !== false
    || policy.phaseGates.changeTrackingBuild !== 22
  ) {
    violations.push({ code: 'AG209', message: 'Change Tracking machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relativeName of [
      trackerPath,
      'docs/architecture/HUMAN_AI_CHANGE_TRACKING.md',
      'docs/builds/BUILD_22_HUMAN_AI_CHANGE_TRACKING.md',
      'scripts/test-build22-human-ai-change-tracking.mjs',
      'scripts/test-build22-human-ai-change-tracking-runtime.ts',
      'scripts/test-build22-change-tracking-guardian-negative.mjs',
    ]) {
      if (!fs.existsSync(path.join(root, relativeName))) violations.push({ code: 'AG209', message: 'Required Build 22 artifact is missing.', detail: relativeName });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-change-tracking-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  explicitAttributionBoundaries: rule?.explicitAttributionBoundaries ?? null,
  aiWriteCapability: rule?.aiWriteCapability ?? null,
  pathLevel: rule?.pathLevel ?? null,
  hunkLevel: rule?.hunkLevel ?? null,
  contentPersistence: rule?.contentPersistence ?? null,
  filesystemMutation: rule?.filesystemMutation ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
