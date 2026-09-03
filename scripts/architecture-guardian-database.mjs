import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
const rule = policy.databaseAuthority;
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

if (!rule || typeof rule.ownerRoot !== 'string' || typeof rule.engineImport !== 'string') {
  violations.push({ code: 'AG090', message: 'Persistent database authority policy is missing or invalid.' });
} else {
  const ownerPrefix = `${rule.ownerRoot.replace(/\/$/, '')}/`;
  for (const absolute of [...walk('apps'), ...walk('packages')]) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');
    const importsDatabaseEngine = source.includes(`from '${rule.engineImport}'`)
      || source.includes(`from \"${rule.engineImport}\"`)
      || source.includes(`import('${rule.engineImport}')`)
      || source.includes(`import(\"${rule.engineImport}\")`);

    if (importsDatabaseEngine && !relative.startsWith(ownerPrefix)) {
      violations.push({
        code: 'AG091',
        message: 'SQLite authority escaped the Local Runtime owner boundary.',
        detail: relative,
      });
    }
  }

  if (policy.currentBuild < rule.durableJobSchemaBuild) {
    const migrationRoot = path.join(root, rule.ownerRoot, 'src');
    for (const absolute of walk(path.relative(root, migrationRoot))) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (!relative.includes('database-migration')) continue;
      const source = fs.readFileSync(absolute, 'utf8');
      if (/\bgd_(?:jobs?|job_|queue|checkpoints?)\b/i.test(source)) {
        violations.push({
          code: 'AG092',
          message: `Durable Job Engine schema arrived before Build ${rule.durableJobSchemaBuild}.`,
          detail: relative,
        });
      }
    }
  }
}

const report = {
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-database-report/1',
  currentBuild: policy.currentBuild,
  ownerRoot: rule?.ownerRoot ?? null,
  engineImport: rule?.engineImport ?? null,
  violations,
};

console.log(JSON.stringify(report, null, 2));
if (violations.length > 0) process.exit(1);
