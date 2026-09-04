import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  ChangeTracker,
  DurableJobEngine,
  GitRuntime,
  LocalDatabase,
  LocalRuntimeDaemon,
  WorkspaceManager,
  LOCAL_DATABASE_SCHEMA_VERSION,
  type CapabilityAuthorizationRequest,
  type CapabilityGrantId,
  type CapabilitySecurityAuthority,
  type LocalRuntimeEventCatalog,
  type OfflineExecutionCoordinator,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build22-'));
let nowMs = Date.parse('2026-09-04T11:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const tick = () => { nowMs += 1_000; };

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
  git(repoRoot, ['config', 'user.email', 'change-tracking-test@example.invalid']);
  writeFileSync(join(repoRoot, 'tracked.txt'), 'baseline\n');
  git(repoRoot, ['add', 'tracked.txt']);
  git(repoRoot, ['commit', '-m', 'initial']);

  const database = new LocalDatabase({ path: join(tempRoot, 'change-tracking.sqlite3'), now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 10);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 10);
  assert.equal(database.listMigrations().length, 10);

  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build22-test', now });
  const observed: unknown[] = [];
  for (const name of [
    'gd.local.change-tracking.ready',
    'gd.local.change-tracking.human-observed',
    'gd.local.change-tracking.ai-started',
    'gd.local.change-tracking.ai-completed',
    'gd.local.change-tracking.invalidated',
  ] as const) {
    bus.subscribe(name, (event) => { observed.push(event); });
  }

  const workspaces = new WorkspaceManager({ database, eventBus: bus, now });
  await workspaces.initialize();
  const workspace = workspaces.register(repoRoot, 'Build 22 Fixture');

  const authorizations: CapabilityAuthorizationRequest[] = [];
  const capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'> = {
    async assertAuthorized(request, token): Promise<CapabilityGrantId> {
      if (token !== 'allow') throw new Error('Capability authorization denied: test-token.');
      authorizations.push(request);
      return 'gd_capgrant_build22_test' as CapabilityGrantId;
    },
  };
  const offline = {
    status: () => ({ connectivity: 'online' } as ReturnType<OfflineExecutionCoordinator['status']>),
  } as Pick<OfflineExecutionCoordinator, 'status'>;

  const gitRuntime = new GitRuntime({ workspaces, capabilities, offline, eventBus: bus, now, timeoutMs: 10_000 });
  const gitStatus = await gitRuntime.initialize();
  assert.equal(gitStatus.ready, true);
  assert.equal(gitStatus.available, true);

  const jobs = new DurableJobEngine({ database, eventBus: bus, now });
  const aiJob = await jobs.enqueue({ kind: 'build22-ai-change', payload: { test: true } });
  const tracker = new ChangeTracker({
    database,
    git: gitRuntime,
    workspaces,
    capabilities,
    eventBus: bus,
    processInstanceId: 'gd_process_build22_a',
    now,
  });
  const initialStatus = await tracker.initialize();
  assert.equal(initialStatus.ready, true);
  assert.equal(initialStatus.trackedPaths, 0);
  assert.equal(initialStatus.explicitBoundaries, true);
  assert.equal(initialStatus.contentPersistence, false);
  assert.equal(initialStatus.filesystemMutation, false);
  assert.equal(initialStatus.externalTransport, false);
  assert.equal((await tracker.snapshot(workspace.id)).paths.length, 0);

  const humanMarker = 'HUMAN-CONTENT-MUST-NOT-BE-PERSISTED';
  writeFileSync(join(repoRoot, 'tracked.txt'), `baseline\n${humanMarker}\n`);
  tick();
  const human = await tracker.observeHumanChanges(workspace.id);
  assert.equal(human.counts.human, 1);
  assert.equal(human.paths[0]?.path, 'tracked.txt');
  assert.equal(human.paths[0]?.origin, 'human');

  const session = await tracker.beginAiChange(workspace.id, { jobId: aiJob.id, token: 'allow' });
  assert.equal(session.state, 'active');
  assert.equal(session.workspaceId, workspace.id);
  assert.equal(session.jobId, aiJob.id);
  const aiAuthorization = authorizations.at(-1);
  assert.equal(aiAuthorization?.jobId, aiJob.id);
  assert.deepEqual(aiAuthorization?.requirements, [{ capability: 'WRITE', resource: `gd://workspace/${workspace.id}/files` }]);

  const aiMarker = 'AI-CONTENT-MUST-NOT-BE-PERSISTED';
  writeFileSync(join(repoRoot, 'tracked.txt'), `baseline\n${humanMarker}\n${aiMarker}\n`);
  tick();
  const mixedCompletion = await tracker.completeAiChange(session.id, { jobId: aiJob.id, token: 'allow' });
  assert.equal(mixedCompletion.session.state, 'completed');
  assert.equal(mixedCompletion.snapshot.counts.mixed, 1);
  assert.equal(mixedCompletion.snapshot.paths[0]?.origin, 'mixed');

  git(repoRoot, ['reset', '--hard', 'HEAD']);
  git(repoRoot, ['clean', '-fd']);
  tick();
  assert.equal((await tracker.snapshot(workspace.id)).paths.length, 0);

  const pureAiJob = await jobs.enqueue({ kind: 'build22-pure-ai', payload: null });
  const pureAiSession = await tracker.beginAiChange(workspace.id, { jobId: pureAiJob.id, token: 'allow' });
  writeFileSync(join(repoRoot, 'ai-only.txt'), `${aiMarker}\n`);
  tick();
  const pureAi = await tracker.completeAiChange(pureAiSession.id, { jobId: pureAiJob.id, token: 'allow' });
  assert.equal(pureAi.snapshot.paths.find((path) => path.path === 'ai-only.txt')?.origin, 'ai');
  assert.equal(pureAi.snapshot.counts.ai, 1);

  writeFileSync(join(repoRoot, 'ai-only.txt'), `${aiMarker}\nexternal drift\n`);
  tick();
  const unexplained = await tracker.snapshot(workspace.id);
  assert.equal(unexplained.paths.find((path) => path.path === 'ai-only.txt')?.origin, 'unknown');

  const humanAfterAi = await tracker.observeHumanChanges(workspace.id);
  assert.equal(humanAfterAi.paths.find((path) => path.path === 'ai-only.txt')?.origin, 'mixed');

  await assert.rejects(
    () => tracker.beginAiChange(workspace.id, { jobId: aiJob.id, token: 'deny' }),
    /authorization denied/i,
  );

  git(repoRoot, ['reset', '--hard', 'HEAD']);
  git(repoRoot, ['clean', '-fd']);
  tick();
  await tracker.observeHumanChanges(workspace.id);

  const terminalJob = await jobs.enqueue({ kind: 'build22-terminal', payload: null });
  const terminalClaim = await jobs.claimNext('build22-terminal-worker');
  assert.ok(terminalClaim);
  const claimedTerminal = terminalClaim!.job.id === terminalJob.id
    ? terminalClaim!
    : await (async () => {
        await jobs.complete(terminalClaim!.job.id, terminalClaim!.leaseToken, null);
        const next = await jobs.claimNext('build22-terminal-worker');
        assert.ok(next && next.job.id === terminalJob.id);
        return next!;
      })();
  await jobs.complete(claimedTerminal.job.id, claimedTerminal.leaseToken, null);
  await assert.rejects(
    () => tracker.beginAiChange(workspace.id, { jobId: terminalJob.id, token: 'allow' }),
    /terminal job/i,
  );

  const cancelJob = await jobs.enqueue({ kind: 'build22-cancel', payload: null });
  const cancelSession = await tracker.beginAiChange(workspace.id, { jobId: cancelJob.id, token: 'allow' });
  await assert.rejects(
    () => tracker.beginAiChange(workspace.id, { jobId: cancelJob.id, token: 'allow' }),
    /only one AI change session/i,
  );
  writeFileSync(join(repoRoot, 'cancelled.txt'), 'cancelled session content\n');
  tick();
  const cancelled = await tracker.cancelAiChange(cancelSession.id, { jobId: cancelJob.id, token: 'allow' });
  assert.equal(cancelled.session.state, 'cancelled');
  assert.equal(cancelled.snapshot.paths.find((path) => path.path === 'cancelled.txt')?.origin, 'unknown');

  git(repoRoot, ['reset', '--hard', 'HEAD']);
  git(repoRoot, ['clean', '-fd']);
  tick();
  await tracker.observeHumanChanges(workspace.id);

  const staleJob = await jobs.enqueue({ kind: 'build22-stale', payload: null });
  const staleSession = await tracker.beginAiChange(workspace.id, { jobId: staleJob.id, token: 'allow' });
  const restartedTracker = new ChangeTracker({
    database,
    git: gitRuntime,
    workspaces,
    capabilities,
    eventBus: bus,
    processInstanceId: 'gd_process_build22_b',
    now,
  });
  await restartedTracker.initialize();
  assert.equal(restartedTracker.getSession(staleSession.id)?.state, 'invalidated');
  assert.match(restartedTracker.getSession(staleSession.id)?.invalidationReason ?? '', /process restarted/i);

  const persisted = database.read((sqlite) => {
    const sessions = sqlite.prepare('SELECT baseline_json, baseline_digest FROM gd_change_sessions').all() as unknown as Array<Record<string, unknown>>;
    const events = sqlite.prepare('SELECT path, origin, state_digest, dirty FROM gd_change_path_events').all() as unknown as Array<Record<string, unknown>>;
    return JSON.stringify({ sessions, events });
  });
  assert.equal(persisted.includes(humanMarker), false, 'human source content must not be persisted');
  assert.equal(persisted.includes(aiMarker), false, 'AI source content must not be persisted');
  assert.equal(persisted.includes('diff --git'), false, 'Git diff text must not be persisted');

  const serializedEvents = JSON.stringify(observed);
  assert.equal(serializedEvents.includes(repoRoot), false, 'Change Tracking events must not expose absolute workspace paths');
  assert.equal(serializedEvents.includes(humanMarker), false, 'Change Tracking events must not expose human file content');
  assert.equal(serializedEvents.includes(aiMarker), false, 'Change Tracking events must not expose AI file content');

  await restartedTracker.shutdown('build22 restart test complete');
  await tracker.shutdown('build22 test complete');
  gitRuntime.shutdown();
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
  assert.equal(daemon.changeTracking.status().ready, true);
  const readiness = await fetch(`${address.origin}/readyz`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.changeTrackingReady, true);
  assert.equal(readiness.trackedChangePaths, 0);
  assert.equal(readiness.activeAiChangeSessions, 0);
  const health = await fetch(`${address.origin}/healthz`).then((response) => response.json()) as { changeTracking?: Record<string, unknown> };
  assert.equal(health.changeTracking?.ready, true);
  assert.equal(health.changeTracking?.explicitBoundaries, true);
  assert.equal(health.changeTracking?.contentPersistence, false);
  assert.equal(health.changeTracking?.filesystemMutation, false);
  assert.equal(health.changeTracking?.externalTransport, false);
  for (const endpoint of ['/v1/change-tracking', '/v1/changes', '/v1/attribution']) {
    assert.equal((await fetch(`${address.origin}${endpoint}`)).status, 404);
  }
  await daemon.stop('build22 daemon test complete');

  assert.equal(readFileSync(join(repoRoot, 'tracked.txt'), 'utf8'), 'baseline\n', 'Change Tracker itself must not mutate tracked project files');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build22-human-ai-change-tracking-runtime/1',
    databaseSchema: 10,
    explicitHumanObservation: true,
    explicitAiSession: true,
    aiWriteCapability: true,
    jobBinding: true,
    humanAttribution: true,
    aiAttribution: true,
    mixedAttribution: true,
    unknownFailsClosed: true,
    singleActiveAiSession: true,
    cancelledSessionFailsClosed: true,
    restartInvalidatesActiveSession: true,
    baselineIntegrityDigest: true,
    sourceContentPersistence: false,
    filesystemMutation: false,
    metadataOnlyEvents: true,
    daemonReadinessIntegrated: true,
    externalTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
