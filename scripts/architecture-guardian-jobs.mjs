import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.jobAuthority;
const violations = [];

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

if (!rule || typeof rule.ownerRoot !== 'string' || !Number.isSafeInteger(rule.minimumBuild)) {
  violations.push({ code: 'AG100', message: 'Durable Job Engine authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_(?:jobs|job_dependencies|job_transitions)\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG101',
        message: 'Durable job persistence authority escaped apps/local.',
        detail: relative,
      });
    }
  }

  if (policy.currentBuild < rule.crashRecoveryBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/recoverExpiredLeases|recoverStale|requeueExpired|autoRecover|recoverRunningJobs/i.test(source)) {
        violations.push({
          code: 'AG102',
          message: `Automatic crash/power job recovery arrived before Build ${rule.crashRecoveryBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild < rule.jobControlTransportBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\/v1\/jobs(?:\/|['"`])|job\.(?:enqueue|claim|cancel|pause|resume)/i.test(source)) {
        violations.push({
          code: 'AG103',
          message: `Durable job control transport arrived before Build ${rule.jobControlTransportBuild}.`,
          detail: relative,
        });
      }
    }
  }

  const required = [
    `${rule.ownerRoot}/src/job-types.ts`,
    `${rule.ownerRoot}/src/job-engine.ts`,
  ];
  for (const relative of required) {
    if (!fs.existsSync(path.join(root, relative))) {
      violations.push({ code: 'AG104', message: 'Durable Job Engine authority artifact is missing.', detail: relative });
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-jobs-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  crashRecoveryBuild: rule?.crashRecoveryBuild ?? null,
  jobControlTransportBuild: rule?.jobControlTransportBuild ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
