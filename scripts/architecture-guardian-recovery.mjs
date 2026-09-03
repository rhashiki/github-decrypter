import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.recoveryAuthority;
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
  violations.push({ code: 'AG110', message: 'Crash & Power Recovery authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    if (/\bgd_(?:runtime_sessions|job_recoveries)\b/.test(source) && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG111',
        message: 'Crash/power recovery persistence authority escaped apps/local.',
        detail: relative,
      });
    }
  }

  if (policy.currentBuild < rule.offlineExecutionBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/offlineExecution|waitForNetwork|connectivityMonitor|networkAvailable|offlineRetry/i.test(source)) {
        violations.push({
          code: 'AG112',
          message: `Offline execution arrived before Build ${rule.offlineExecutionBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild < rule.capabilitySecurityBuild) {
    for (const absolute of walk(`${rule.ownerRoot}/src`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const source = fs.readFileSync(absolute, 'utf8');
      if (/CapabilityGrant|capabilityToken|authorizeCapability|CAPABILITY_[A-Z_]+/.test(source)) {
        violations.push({
          code: 'AG113',
          message: `Capability Security authority arrived before Build ${rule.capabilitySecurityBuild}.`,
          detail: relative,
        });
      }
    }
  }

  if (policy.currentBuild >= rule.minimumBuild) {
    for (const relative of [
      `${rule.ownerRoot}/src/recovery-engine.ts`,
      'docs/architecture/CRASH_POWER_RECOVERY.md',
      'docs/builds/BUILD_13_CRASH_POWER_RECOVERY.md',
    ]) {
      if (!fs.existsSync(path.join(root, relative))) {
        violations.push({ code: 'AG114', message: 'Crash & Power Recovery authority artifact is missing.', detail: relative });
      }
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-recovery-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  offlineExecutionBuild: rule?.offlineExecutionBuild ?? null,
  capabilitySecurityBuild: rule?.capabilitySecurityBuild ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
