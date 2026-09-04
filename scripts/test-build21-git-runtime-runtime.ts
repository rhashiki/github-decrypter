import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  GitRuntime,
  LocalDatabase,
  LocalRuntimeDaemon,
  WorkspaceManager,
  type CapabilityAuthorizationRequest,
  type CapabilityGrantId,
  type CapabilitySecurityAuthority,
  type LocalRuntimeEventCatalog,
  type OfflineExecutionCoordinator,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build21-'));
let nowMs = Date.parse('2026-09-04T10:00:00.000Z');
const now = () => new Date(nowMs).toISOString();

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C' },
  });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const repoRoot = join(tempRoot, 'repo');
  mkdirSync(repoRoot);
  git(repoRoot, ['init', '-b', 'main']);
  git(repoRoot, ['config', 'user.name', 'GitHub Decrypter Test']);
  git(repoRoot, ['config', 'user.email', 'git-runtime-test@example.invalid']);
  writeFileSync(join(repoRoot, 'README.md'), '# fixture\n');
  git(repoRoot, ['add', 'README.md']);
  git(repoRoot, ['commit', '-m', 'initial']);

  const database = new LocalDatabase({ path: join(tempRoot, 'git-runtime.sqlite3'), now });
  database.open();
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build21-test', now });
  const observed: unknown[] = [];
  bus.subscribe('gd.local.git.ready', (event) => { observed.push(event); });
  bus.subscribe('gd.local.git.operation', (event) => { observed.push(event); });

  const workspaces = new WorkspaceManager({ database, eventBus: bus, now });
  await workspaces.initialize();
  const workspace = workspaces.register(repoRoot, 'Git Fixture');

  const authorizations: CapabilityAuthorizationRequest[] = [];
  const capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'> = {
    async assertAuthorized(request, token): Promise<CapabilityGrantId> {
      if (token !== 'allow') throw new Error('Capability authorization denied: test-token.');
      authorizations.push(request);
      return 'gd_capgrant_build21_test' as CapabilityGrantId;
    },
  };
  let connectivity: 'online' | 'offline' = 'online';
  const offline = {
    status: () => ({ connectivity } as ReturnType<OfflineExecutionCoordinator['status']>),
  } as Pick<OfflineExecutionCoordinator, 'status'>;

  const runtime = new GitRuntime({
    workspaces,
    capabilities,
    offline,
    eventBus: bus,
    now,
    timeoutMs: 10_000,
    maxOutputBytes: 2 * 1024 * 1024,
  });
  const runtimeStatus = await runtime.initialize();
  assert.equal(runtimeStatus.ready, true);
  assert.equal(runtimeStatus.available, true);
  assert.ok(runtimeStatus.version);
  assert.equal(runtimeStatus.shellExecution, false);
  assert.equal(runtimeStatus.forcePush, false);
  assert.equal(runtimeStatus.hardReset, false);

  const status = await runtime.statusSnapshot(workspace.id);
  assert.equal(status.repository, true);
  assert.equal(status.branch, 'main');
  assert.equal(status.clean, true);
  assert.ok(status.head);

  const history = await runtime.log(workspace.id, 10);
  assert.equal(history.entries[0]?.subject, 'initial');
  const branches = await runtime.branches(workspace.id);
  assert.equal(branches.branches.some((branch) => branch.name === 'main' && branch.current), true);
  const blame = await runtime.blame(workspace.id, 'README.md');
  assert.match(blame.text, /fixture/);
  const base = await runtime.mergeBase(workspace.id, 'HEAD', 'main');
  assert.equal(base.text, status.head);

  writeFileSync(join(repoRoot, 'README.md'), '# fixture\nchanged\n');
  const diff = await runtime.diff(workspace.id);
  assert.match(diff.text, /changed/);
  await assert.rejects(() => runtime.diff(workspace.id, { paths: ['../outside'] }), /escapes the registered workspace/i);

  await assert.rejects(
    () => runtime.restore(workspace.id, ['README.md'], { jobId: 'gd_job_denied' as never, token: 'deny' }),
    /authorization denied/i,
  );
  await runtime.restore(workspace.id, ['README.md'], { jobId: 'gd_job_restore' as never, token: 'allow' });
  assert.equal(readFileSync(join(repoRoot, 'README.md'), 'utf8'), '# fixture\n');

  nowMs += 1_000;
  await runtime.createBranch(workspace.id, 'feature/runtime', { jobId: 'gd_job_branch' as never, token: 'allow' });
  assert.equal((await runtime.statusSnapshot(workspace.id)).branch, 'feature/runtime');

  writeFileSync(join(repoRoot, 'feature.txt'), 'git runtime\n');
  git(repoRoot, ['add', 'feature.txt']);
  await runtime.commit(workspace.id, 'feature commit', { jobId: 'gd_job_commit' as never, token: 'allow' });
  assert.equal((await runtime.log(workspace.id, 1)).entries[0]?.subject, 'feature commit');

  writeFileSync(join(repoRoot, 'README.md'), '# fixture\nstashed\n');
  await runtime.stashPush(workspace.id, { jobId: 'gd_job_stash_push' as never, token: 'allow' }, 'build21');
  assert.equal((await runtime.statusSnapshot(workspace.id)).clean, true);
  await runtime.stashPop(workspace.id, { jobId: 'gd_job_stash_pop' as never, token: 'allow' });
  assert.match(readFileSync(join(repoRoot, 'README.md'), 'utf8'), /stashed/);
  await runtime.restore(workspace.id, ['README.md'], { jobId: 'gd_job_restore2' as never, token: 'allow' });
  await runtime.checkout(workspace.id, 'main', { jobId: 'gd_job_checkout' as never, token: 'allow' });
  assert.equal((await runtime.statusSnapshot(workspace.id)).branch, 'main');

  const remoteRoot = join(tempRoot, 'remote.git');
  git(tempRoot, ['init', '--bare', remoteRoot]);
  git(repoRoot, ['remote', 'add', 'origin', remoteRoot]);
  await runtime.push(workspace.id, { jobId: 'gd_job_push' as never, token: 'allow' }, { branch: 'main' });
  await runtime.fetch(workspace.id, { jobId: 'gd_job_fetch' as never, token: 'allow' });
  const networkAuthorization = authorizations.find((request) => request.jobId === ('gd_job_push' as never));
  assert.deepEqual(networkAuthorization?.requirements.map((entry) => entry.capability), ['GIT_WRITE', 'NETWORK']);

  connectivity = 'offline';
  await assert.rejects(
    () => runtime.fetch(workspace.id, { jobId: 'gd_job_offline' as never, token: 'allow' }),
    /connectivity state online/i,
  );
  connectivity = 'online';

  const emptyRoot = join(tempRoot, 'empty');
  mkdirSync(emptyRoot);
  const emptyWorkspace = workspaces.register(emptyRoot, 'Empty Fixture');
  const emptyStatus = await runtime.statusSnapshot(emptyWorkspace.id);
  assert.equal(emptyStatus.repository, false);
  await assert.rejects(
    () => runtime.clone(emptyWorkspace.id, 'https://user:pass@example.com/repo.git', { jobId: 'gd_job_clone' as never, token: 'allow' }),
    /may not embed credentials/i,
  );

  const serializedEvents = JSON.stringify(observed);
  assert.equal(serializedEvents.includes(repoRoot), false, 'Git Runtime events must not expose workspace paths');
  assert.equal(serializedEvents.includes('Git Fixture'), false, 'Git Runtime events must not expose workspace display names');
  assert.ok(runtime.status().operations >= 10);
  runtime.shutdown();
  workspaces.shutdown();
  database.close();

  const daemonRoot = join(tempRoot, 'daemon');
  mkdirSync(daemonRoot);
  const daemon = new LocalRuntimeDaemon({
    config: {
      host: '127.0.0.1',
      port: 0,
      databasePath: join(daemonRoot, 'runtime.sqlite3'),
      lockPath: join(daemonRoot, 'runtime.lock'),
      vaultKeyPath: join(daemonRoot, 'vault.key'),
    },
    now,
  });
  const address = await daemon.start();
  assert.equal(daemon.git.status().ready, true);
  assert.equal(daemon.git.status().available, true);
  const readiness = await fetch(`${address.origin}/readyz`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.gitRuntimeReady, true);
  assert.equal(readiness.gitAvailable, true);
  const health = await fetch(`${address.origin}/healthz`).then((response) => response.json()) as { git?: Record<string, unknown> };
  assert.equal(health.git?.ready, true);
  assert.equal(health.git?.available, true);
  assert.equal(health.git?.shellExecution, false);
  assert.equal(health.git?.forcePush, false);
  assert.equal(health.git?.hardReset, false);
  assert.equal(health.git?.externalTransport, false);
  const forbiddenEndpoint = await fetch(`${address.origin}/v1/git`);
  assert.equal(forbiddenEndpoint.status, 404);
  await daemon.stop('build21 test complete');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build21-git-runtime-runtime/1',
    gitAvailable: true,
    status: true,
    diff: true,
    log: true,
    branches: true,
    blame: true,
    mergeBase: true,
    capabilityGatedWrites: true,
    networkRequiresGitWriteAndNetwork: true,
    offlineNetworkFailsClosed: true,
    embeddedRemoteCredentialsRejected: true,
    forcePush: false,
    shellExecution: false,
    metadataOnlyEvents: true,
    daemonReadinessIntegrated: true,
    externalTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
