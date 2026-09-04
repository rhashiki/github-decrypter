import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.projectDetectionAuthority;
const violations = [];

function read(relative) {
  const absolute = path.join(root, relative);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

if (!rule || rule.ownerRoot !== 'apps/local' || rule.contractPackage !== '@github-decrypter/workspace' || rule.minimumBuild !== 20) {
  violations.push({ code: 'AG180', message: 'Project Detection policy is missing or invalid.' });
} else {
  const contract = read('packages/workspace/src/index.ts');
  for (const marker of ["PROJECT_DETECTION_SCHEMA = 'gd-project-detection/1'", 'ProjectDetectionResult', 'ProjectPackageManager', 'ProjectFramework', 'ProjectDetectionConfidence']) {
    if (!contract.includes(marker)) violations.push({ code: 'AG181', message: 'Project Detection contract invariant missing.', detail: marker });
  }
  if (/node:(?:fs|path|child_process|os|http|https|net|tls)|\bwindow\.|\bdocument\.|\bchrome\./.test(contract)) {
    violations.push({ code: 'AG181', message: 'Project Detection contract stopped being environment-neutral.' });
  }

  const detectorPath = `${rule.ownerRoot}/src/project-detector.ts`;
  const detector = read(detectorPath);
  for (const marker of ['class ProjectDetector', 'MAX_PACKAGE_JSON_BYTES', 'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', "framework: 'next'", "framework: 'astro'", "framework: 'react'", "framework: 'vue'", "framework: 'svelte'", "framework: 'vite'", "framework: 'vanilla'", 'readOnly: true', 'filesystemMutation: false', 'networkAccess: false', 'gitAuthority: false', 'externalTransport: false']) {
    if (!detector.includes(marker)) violations.push({ code: 'AG182', message: 'Project Detector invariant missing.', detail: marker });
  }

  const forbiddenMutation = /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|rm|unlinkSync|unlink|mkdirSync|mkdir|renameSync|rename|copyFileSync|copyFile|truncateSync|truncate|chmodSync|chmod|chownSync|chown|symlinkSync|symlink|linkSync|link)\b/;
  if (forbiddenMutation.test(detector)) {
    violations.push({ code: 'AG183', message: 'Project Detection must remain read-only and may not mutate project files.' });
  }

  if (/\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\b/.test(detector)) {
    violations.push({ code: 'AG184', message: 'Build 20 Project Detection is root-only and may not recursively enumerate the workspace.' });
  }

  if (/(?:node:(?:child_process|http|https|net|tls|dgram)|\bfetch\s*\(|\bWebSocket\s*\(|\bgit\s+(?:clone|fetch|pull|status|diff|log)\b|\bsimple-git\b|\bisomorphic-git\b)/i.test(detector)) {
    violations.push({ code: 'AG185', message: 'Project Detection gained network, process or Git authority before its owning phase.' });
  }

  const server = read(`${rule.ownerRoot}/src/server.ts`);
  if (/\/v\d+\/(?:project(?:-detection)?|detect-project|detection)(?:\b|\/)/i.test(server)) {
    violations.push({ code: 'AG186', message: 'Project Detection control/query HTTP transport arrived before an owning transport phase.' });
  }

  const daemon = read(`${rule.ownerRoot}/src/daemon.ts`);
  for (const marker of ['createProjectDetector', 'projectDetection.initialize()', 'getProjectDetectionStatus', 'projectDetection.shutdown()']) {
    if (!daemon.includes(marker)) violations.push({ code: 'AG187', message: 'Project Detection daemon integration invariant missing.', detail: marker });
  }

  const lifecycle = read(`${rule.ownerRoot}/src/lifecycle.ts`);
  for (const marker of ['gd.local.project-detection.ready', 'gd.local.project.detected']) {
    if (!lifecycle.includes(marker)) violations.push({ code: 'AG188', message: 'Project Detection event invariant missing.', detail: marker });
  }

  if (
    rule.workspaceManagerBuild !== 19
    || rule.gitRuntimeBuild !== 21
    || rule.rootOnly !== true
    || rule.readOnly !== true
    || rule.filesystemMutation !== false
    || rule.networkAccess !== false
    || rule.gitAuthority !== false
    || rule.externalTransport !== false
    || rule.maxPackageJsonBytes !== 1048576
  ) {
    violations.push({ code: 'AG189', message: 'Project Detection machine-readable invariants were weakened.' });
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relativeName of [
      detectorPath,
      'docs/architecture/PROJECT_DETECTION.md',
      'docs/builds/BUILD_20_PROJECT_DETECTION.md',
    ]) {
      if (!fs.existsSync(path.join(root, relativeName))) violations.push({ code: 'AG189', message: 'Required Build 20 artifact is missing.', detail: relativeName });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-project-detection-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  contractPackage: rule?.contractPackage ?? null,
  rootOnly: rule?.rootOnly ?? null,
  readOnly: rule?.readOnly ?? null,
  filesystemMutation: rule?.filesystemMutation ?? null,
  networkAccess: rule?.networkAccess ?? null,
  gitAuthority: rule?.gitAuthority ?? null,
  externalTransport: rule?.externalTransport ?? null,
  violations,
};
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
