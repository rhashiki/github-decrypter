const STRICT_JSON = /(?:^|\/)(?:package(?:-lock)?\.json|composer\.json|manifest\.json|deno\.json)$/i;
const JSONC = /(?:^|\/)(?:tsconfig(?:\.[^/]+)?\.json|jsconfig\.json|deno\.jsonc|\.vscode\/[^/]+\.json)$/i;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|css|scss|sass|less|html?|py|rb|php|go|rs|java|kt|swift|sql)$/i;
const WORKFLOW_PATH = /^\.github\/workflows\/[^/]+\.(?:ya?ml)$/i;
const SCRIPT_PRIORITY = [
  ['lint', ['lint', 'lint:check', 'check:lint']],
  ['typecheck', ['typecheck', 'type-check', 'check:types', 'check-types', 'types:check']],
  ['test', ['test:ci', 'test']],
  ['build', ['build']]
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripJsonComments(text) {
  const input = String(text || '');
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function stripTrailingCommas(text) {
  const input = String(text || '');
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j += 1;
      if (input[j] === '}' || input[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

function parseJsonLike(text, jsonc = false) {
  const source = jsonc ? stripTrailingCommas(stripJsonComments(text)) : String(text || '');
  return JSON.parse(source);
}

function packageDir(path) {
  const value = String(path || '');
  return value === 'package.json' ? '' : value.replace(/\/package\.json$/, '');
}

function pathInsideDir(path, dir) {
  if (!dir) return true;
  return path === dir || path.startsWith(`${dir}/`);
}

function choosePackagePaths(treeEntries = [], changedPaths = []) {
  const packages = (Array.isArray(treeEntries) ? treeEntries : [])
    .filter(entry => entry?.type === 'blob' && /(?:^|\/)package\.json$/.test(String(entry.path || '')))
    .map(entry => String(entry.path))
    .filter(path => !/(?:^|\/)node_modules\//.test(path));
  if (!packages.length) return [];

  const chosen = new Set();
  if (packages.includes('package.json')) chosen.add('package.json');
  for (const changedPath of changedPaths) {
    const matches = packages
      .map(path => ({ path, dir: packageDir(path) }))
      .filter(item => pathInsideDir(changedPath, item.dir))
      .sort((a, b) => b.dir.length - a.dir.length);
    if (matches[0]) chosen.add(matches[0].path);
  }
  return [...chosen].slice(0, 8);
}

function detectPackageManager(pkg = {}, treePaths = [], dir = '') {
  const managerField = String(pkg?.packageManager || '').split('@')[0].toLowerCase();
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(managerField)) return managerField;
  const at = name => dir ? `${dir}/${name}` : name;
  if (treePaths.has(at('pnpm-lock.yaml'))) return 'pnpm';
  if (treePaths.has(at('yarn.lock'))) return 'yarn';
  if (treePaths.has(at('bun.lockb')) || treePaths.has(at('bun.lock'))) return 'bun';
  return 'npm';
}

function detectScripts(pkg = {}) {
  const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const selected = [];
  for (const [kind, aliases] of SCRIPT_PRIORITY) {
    const name = aliases.find(alias => typeof scripts[alias] === 'string' && scripts[alias].trim());
    if (name) selected.push({ kind, name, script: scripts[name] });
  }
  return selected;
}

function installCommand(manager, pkg = {}, treePaths = new Set(), dir = '') {
  const at = name => dir ? `${dir}/${name}` : name;
  if (manager === 'pnpm') return 'corepack enable\npnpm install --frozen-lockfile';
  if (manager === 'yarn') {
    const version = String(pkg?.packageManager || '').match(/^yarn@(\d+)/)?.[1];
    if (version && Number(version) >= 2) return 'corepack enable\nyarn install --immutable';
    return 'corepack enable\nyarn install --frozen-lockfile';
  }
  if (manager === 'bun') return 'bun install --frozen-lockfile';
  return treePaths.has(at('package-lock.json')) ? 'npm ci' : 'npm install';
}

function scriptCommand(manager, name) {
  const quoted = JSON.stringify(String(name));
  if (manager === 'pnpm') return `pnpm run ${quoted}`;
  if (manager === 'yarn') return `yarn run ${quoted}`;
  if (manager === 'bun') return `bun run ${quoted}`;
  return `npm run ${quoted}`;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function evaluateStaticValidation(files = []) {
  const violations = [];
  const warnings = [];
  const checks = [];

  for (const file of Array.isArray(files) ? files : []) {
    const path = String(file?.path || '');
    const action = String(file?.action || '').toLowerCase();
    if (action === 'delete') continue;
    const content = typeof file?.content === 'string' ? file.content : '';

    if (SOURCE_FILE.test(path) && !content.trim()) violations.push(`Arquivo-fonte vazio após alteração: ${path}`);

    if (STRICT_JSON.test(path)) {
      try {
        parseJsonLike(content, false);
        checks.push(`json:${path}`);
      } catch (error) {
        violations.push(`JSON inválido em ${path}: ${error?.message || error}`);
      }
    } else if (JSONC.test(path)) {
      try {
        parseJsonLike(content, true);
        checks.push(`jsonc:${path}`);
      } catch (error) {
        violations.push(`JSON/JSONC inválido em ${path}: ${error?.message || error}`);
      }
    }

    if (/package\.json$/i.test(path)) {
      try {
        const pkg = parseJsonLike(content, false);
        if (pkg?.scripts != null && (typeof pkg.scripts !== 'object' || Array.isArray(pkg.scripts))) {
          violations.push(`package.json possui campo scripts inválido: ${path}`);
        }
      } catch (_) {}
    }
  }

  if (!checks.length) warnings.push('Nenhum arquivo JSON/JSONC alterado exigiu validação sintática interna.');
  return { ok: violations.length === 0, violations, warnings, checks };
}

export async function detectValidationTargets({ adapter, bundle, shadow } = {}) {
  if (!adapter || !shadow?.treeSha || !shadow?.commitSha) throw new Error('VALIDATION_GATE_SHADOW_REQUIRED');
  const tree = await adapter.getTree(shadow.treeSha, true);
  if (tree?.truncated) throw new Error('VALIDATION_GATE_TREE_TRUNCATED');
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const treePaths = new Set(entries.map(entry => String(entry.path || '')));
  const changedPaths = (Array.isArray(bundle?.plan?.files) ? bundle.plan.files : []).map(file => String(file?.path || ''));
  const packagePaths = choosePackagePaths(entries, changedPaths);
  const packages = [];

  for (const path of packagePaths) {
    try {
      const file = await adapter.getFileByPath(path, shadow.commitSha);
      const pkg = JSON.parse(String(file?.text || '{}'));
      const dir = packageDir(path);
      const manager = detectPackageManager(pkg, treePaths, dir);
      const scripts = detectScripts(pkg);
      packages.push({
        path,
        dir,
        manager,
        scripts,
        install: installCommand(manager, pkg, treePaths, dir)
      });
    } catch (error) {
      throw new Error(`VALIDATION_GATE_PACKAGE_READ_FAILED: ${path} · ${error?.message || error}`);
    }
  }

  const workflowPaths = entries.filter(entry => entry?.type === 'blob' && WORKFLOW_PATH.test(String(entry.path || ''))).map(entry => String(entry.path));
  const commands = packages.flatMap(pkg => pkg.scripts.map(script => ({
    package: pkg.path,
    directory: pkg.dir || '.',
    manager: pkg.manager,
    kind: script.kind,
    script: script.name,
    command: scriptCommand(pkg.manager, script.name)
  })));

  return {
    treeEntries: entries,
    packages,
    commands,
    workflowPaths,
    hasExecutableChecks: commands.length > 0
  };
}

export function buildValidationWorkflow({ branch, targets } = {}) {
  const packages = Array.isArray(targets?.packages) ? targets.packages.filter(pkg => pkg.scripts?.length) : [];
  if (!packages.length) return '';
  const needsBun = packages.some(pkg => pkg.manager === 'bun');
  const lines = [
    'name: Lovable Decrypter Validation Gate',
    '',
    'on:',
    '  push:',
    '    branches:',
    `      - ${yamlString(branch)}`,
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 12',
    '    env:',
    "      CI: 'true'",
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          persist-credentials: false',
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '22'"
  ];
  if (needsBun) lines.push('      - uses: oven-sh/setup-bun@v2');

  for (const pkg of packages) {
    const wd = pkg.dir || '.';
    lines.push(
      `      - name: ${yamlString(`Install · ${pkg.path}`)}`,
      '        shell: bash',
      `        working-directory: ${yamlString(wd)}`,
      '        run: |'
    );
    for (const commandLine of String(pkg.install || '').split('\n')) lines.push(`          ${commandLine}`);
    for (const script of pkg.scripts) {
      lines.push(
        `      - name: ${yamlString(`${script.kind} · ${pkg.path}`)}`,
        '        shell: bash',
        `        working-directory: ${yamlString(wd)}`,
        `        run: ${yamlString(scriptCommand(pkg.manager, script.name))}`
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function summarizeRuns(runs = [], validationCommitSha = '') {
  return (Array.isArray(runs) ? runs : [])
    .filter(run => String(run?.head_sha || '') === String(validationCommitSha))
    .map(run => ({
      id: run.id,
      name: run.name || run.display_title || 'GitHub Actions',
      status: run.status || '',
      conclusion: run.conclusion || null,
      htmlUrl: run.html_url || ''
    }));
}

async function runExternalValidation({ adapter, shadow, targets, startupTimeoutMs = 25000, completionTimeoutMs = 12 * 60 * 1000 } = {}) {
  if (!targets?.hasExecutableChecks) return { status: 'not-needed', runs: [], branch: null, commands: [] };
  if (typeof adapter.createBranch !== 'function' || typeof adapter.deleteBranch !== 'function' || typeof adapter.listActionsRuns !== 'function') {
    return { status: 'unavailable', reason: 'github-actions-adapter-capability-missing', runs: [], branch: null, commands: targets.commands };
  }

  const suffix = `${String(shadow.commitSha).slice(0, 8)}-${Date.now().toString(36)}`;
  const branch = `ld-validation/${suffix}`;
  let branchCreated = false;
  try {
    const existingWorkflows = (targets.workflowPaths || []).filter(path => path !== '.github/workflows/ld-validation.yml');
    const treeEntries = existingWorkflows.map(path => ({ path, mode: '100644', type: 'blob', sha: null }));
    const workflow = buildValidationWorkflow({ branch, targets });
    if (!workflow) return { status: 'not-needed', runs: [], branch: null, commands: [] };
    const blob = await adapter.createBlob(workflow);
    treeEntries.push({ path: '.github/workflows/ld-validation.yml', mode: '100644', type: 'blob', sha: blob.sha });
    const validationTree = await adapter.createTree(shadow.treeSha, treeEntries);
    const validationCommit = await adapter.createCommit('chore: Lovable Decrypter validation gate', validationTree.sha, shadow.commitSha);
    await adapter.createBranch(branch, validationCommit.sha);
    branchCreated = true;

    const startupDeadline = Date.now() + startupTimeoutMs;
    let runs = [];
    while (Date.now() < startupDeadline) {
      runs = summarizeRuns(await adapter.listActionsRuns(branch), validationCommit.sha);
      if (runs.length) break;
      await sleep(2000);
    }
    if (!runs.length) {
      return {
        status: 'unavailable',
        reason: 'github-actions-did-not-start',
        branch,
        validationCommitSha: validationCommit.sha,
        runs: [],
        commands: targets.commands
      };
    }

    const completionDeadline = Date.now() + completionTimeoutMs;
    while (Date.now() < completionDeadline) {
      runs = summarizeRuns(await adapter.listActionsRuns(branch), validationCommit.sha);
      if (runs.length && runs.every(run => run.status === 'completed')) break;
      await sleep(3000);
    }

    if (!runs.length || runs.some(run => run.status !== 'completed')) {
      const error = new Error('VALIDATION_GATE_CI_TIMEOUT');
      error.code = 'VALIDATION_GATE_BLOCKED';
      error.validationGate = { status: 'blocked', reason: 'ci-timeout', branch, runs, commands: targets.commands };
      throw error;
    }
    const failed = runs.filter(run => run.conclusion !== 'success' && run.conclusion !== 'neutral' && run.conclusion !== 'skipped');
    if (failed.length) {
      const error = new Error(`VALIDATION_GATE_CI_FAILED: ${failed.map(run => `${run.name}:${run.conclusion}`).join(' | ')}`);
      error.code = 'VALIDATION_GATE_BLOCKED';
      error.validationGate = { status: 'blocked', reason: 'ci-failed', branch, runs, commands: targets.commands };
      throw error;
    }
    return {
      status: 'passed',
      branch,
      validationCommitSha: validationCommit.sha,
      runs,
      commands: targets.commands
    };
  } catch (error) {
    if (error?.code === 'VALIDATION_GATE_BLOCKED') throw error;
    return {
      status: 'unavailable',
      reason: error?.message || String(error),
      branch: branchCreated ? branch : null,
      runs: [],
      commands: targets?.commands || []
    };
  } finally {
    if (branchCreated) {
      try { await adapter.deleteBranch(branch); } catch (_) {}
    }
  }
}

export async function runValidationGate({ adapter, bundle, shadow } = {}) {
  if (!adapter || !shadow?.commitSha || !shadow?.treeSha) throw new Error('VALIDATION_GATE_SHADOW_REQUIRED');
  const files = Array.isArray(bundle?.plan?.files) ? bundle.plan.files : [];
  const staticResult = evaluateStaticValidation(files);
  if (!staticResult.ok) {
    const error = new Error(`VALIDATION_GATE_BLOCKED: ${staticResult.violations.join(' | ')}`);
    error.code = 'VALIDATION_GATE_BLOCKED';
    error.validationGate = { status: 'blocked', phase: 'static', ...staticResult };
    throw error;
  }

  const targets = await detectValidationTargets({ adapter, bundle, shadow });
  const external = await runExternalValidation({ adapter, shadow, targets });
  const warnings = [...staticResult.warnings];
  if (external.status === 'unavailable' && targets.hasExecutableChecks) {
    warnings.push(`Checks externos detectados, mas não executados: ${external.reason || 'runner indisponível'}.`);
  }

  return {
    ok: true,
    status: external.status === 'passed' ? 'passed' : 'passed-with-limitations',
    checkedAt: new Date().toISOString(),
    static: staticResult,
    detected: {
      packages: targets.packages.map(pkg => ({ path: pkg.path, manager: pkg.manager, scripts: pkg.scripts.map(script => script.name) })),
      commands: targets.commands,
      existingWorkflowCount: targets.workflowPaths.length
    },
    external,
    warnings
  };
}
