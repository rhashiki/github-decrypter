import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const workflowPolicy = policy.workflow ?? {};
const allowlist = new Set(workflowPolicy.writePermissionAllowlist ?? []);
const scopes = workflowPolicy.writeScopes ?? {};
const violations = [];

function fail(code, message, detail) {
  violations.push({ code, message, ...(detail ? { detail } : {}) });
}

for (const workflow of allowlist) {
  const scope = scopes[workflow];
  const absolute = path.join(root, workflow);
  if (!scope) {
    fail('AG073', 'Write-allowlisted workflow has no explicit scope rule.', workflow);
    continue;
  }
  if (!fs.existsSync(absolute)) {
    fail('AG074', 'Write-allowlisted workflow is missing.', workflow);
    continue;
  }

  const source = fs.readFileSync(absolute, 'utf8');
  const writePermissions = [...source.matchAll(/^\s*([a-z-]+)\s*:\s*write\s*(?:#.*)?$/gmi)]
    .map((match) => match[1]);
  for (const permission of writePermissions) {
    if (permission !== 'contents') {
      fail('AG075', 'Scoped repository-write workflow may use only contents: write.', `${workflow} :: ${permission}`);
    }
  }
  if (!writePermissions.includes('contents')) {
    fail('AG076', 'Scoped repository-write workflow no longer declares its expected contents: write permission.', workflow);
  }

  const allowedPrefixes = scope.allowedGitAddPrefixes ?? [];
  const gitAddLines = source.match(/^\s*git add\s+.+$/gmi) ?? [];
  if (gitAddLines.length === 0) {
    fail('AG077', 'Scoped repository-write workflow must declare at least one bounded git add command.', workflow);
  }
  for (const line of gitAddLines) {
    const args = line.trim().replace(/^git add\s+/, '').split(/\s+/).map((arg) => arg.replace(/^['"]|['"]$/g, ''));
    for (const arg of args) {
      const allowed = allowedPrefixes.some((prefix) => arg === prefix || arg.startsWith(`${prefix}/`));
      if (!allowed) {
        fail('AG078', 'Scoped workflow stages a path outside its allowlist.', `${workflow} :: ${arg}`);
      }
    }
  }

  const pushLines = source.match(/^\s*git push(?:\s+.*)?$/gmi) ?? [];
  for (const line of pushLines) {
    const command = line.trim();
    if (!scope.allowPlainGitPush || command !== 'git push') {
      fail('AG079', 'Scoped workflow may only use the explicitly approved plain git push.', `${workflow} :: ${command}`);
    }
  }

  const forbidden = [
    /\bgit\s+tag\b/i,
    /\bgit\s+push\b[^\n]*--tags/i,
    /\bgh\s+release\b/i,
    /action-gh-release/i,
    /\bnpm\s+publish\b/i,
    /\bdocker\s+push\b/i,
    /\bkubectl\b/i,
    /\bterraform\s+apply\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      fail('AG07A', 'Scoped project-map workflow gained publication/deployment authority.', `${workflow} :: ${pattern}`);
    }
  }
}

for (const workflow of Object.keys(scopes)) {
  if (!allowlist.has(workflow)) {
    fail('AG07B', 'Workflow write scope exists without matching write allowlist entry.', workflow);
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-workflow-write-report/1',
  currentBuild: policy.currentBuild,
  allowlistedWorkflows: [...allowlist],
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
