import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '../packages/shared/src/index.js';
import {
  LocalDatabase,
  LocalRuntimeDaemon,
  ProjectDetector,
  WorkspaceManager,
  type LocalRuntimeEventCatalog,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build20-'));
let nowMs = Date.parse('2026-09-04T09:00:00.000Z');
const now = () => new Date(nowMs).toISOString();

function fixture(name: string, packageJson?: Record<string, unknown>, extraFiles: Record<string, string> = {}): string {
  const root = join(tempRoot, name);
  mkdirSync(root, { recursive: true });
  if (packageJson) writeFileSync(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  for (const [relative, content] of Object.entries(extraFiles)) writeFileSync(join(root, relative), content);
  return root;
}

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'detection.sqlite3'), now });
  database.open();
  const bus = createEventBus<LocalRuntimeEventCatalog>({ defaultSource: 'build20-test', now });
  const observed: unknown[] = [];
  bus.subscribe('gd.local.project.detected', (event) => observed.push(event));
  const workspaces = new WorkspaceManager({ database, eventBus: bus, now });
  await workspaces.initialize();
  const detector = new ProjectDetector({ workspaces, eventBus: bus, now });
  await detector.initialize();

  const nextRoot = fixture('next-pnpm', {
    name: 'next-pnpm',
    packageManager: 'pnpm@10.15.0',
    scripts: { dev: 'next dev' },
    dependencies: { next: '^15.0.0', react: '^19.0.0' },
  }, { 'pnpm-lock.yaml': 'lockfileVersion: 9\n' });
  const nextBefore = readFileSync(join(nextRoot, 'package.json'), 'utf8');
  const nextWorkspace = workspaces.register(nextRoot, 'Next Fixture');
  const next = await detector.detect(nextWorkspace.id);
  assert.equal(next.packageManager, 'pnpm');
  assert.equal(next.framework, 'next');
  assert.equal(next.devScript, 'dev');
  assert.equal(next.devCommand, 'pnpm dev');
  assert.equal(next.confidence, 'high');
  assert.equal(next.readOnly, true);
  assert.equal(readFileSync(join(nextRoot, 'package.json'), 'utf8'), nextBefore, 'detection must not mutate package.json');

  nowMs += 1_000;
  const reactRoot = fixture('react-vite-npm', {
    name: 'react-vite-npm',
    scripts: { dev: 'vite' },
    dependencies: { react: '^19.0.0' },
    devDependencies: { vite: '^7.0.0' },
  }, { 'package-lock.json': '{}\n', 'index.html': '<div id="root"></div>\n' });
  const reactWorkspace = workspaces.register(reactRoot);
  const react = await detector.detect(reactWorkspace.id);
  assert.equal(react.packageManager, 'npm');
  assert.equal(react.framework, 'react');
  assert.equal(react.devCommand, 'npm run dev');
  assert.equal(react.confidence, 'high');

  nowMs += 1_000;
  const astroRoot = fixture('astro-yarn', {
    name: 'astro-yarn',
    scripts: { dev: 'astro dev' },
    dependencies: { astro: '^5.0.0' },
  }, { 'yarn.lock': '# yarn lock\n' });
  const astroWorkspace = workspaces.register(astroRoot);
  const astro = await detector.detect(astroWorkspace.id);
  assert.equal(astro.packageManager, 'yarn');
  assert.equal(astro.framework, 'astro');
  assert.equal(astro.devCommand, 'yarn dev');

  nowMs += 1_000;
  const vanillaRoot = fixture('vanilla', undefined, { 'index.html': '<!doctype html>\n' });
  const vanillaWorkspace = workspaces.register(vanillaRoot);
  const vanilla = await detector.detect(vanillaWorkspace.id);
  assert.equal(vanilla.packageJsonPresent, false);
  assert.equal(vanilla.packageManager, 'unknown');
  assert.equal(vanilla.framework, 'vanilla');
  assert.equal(vanilla.devCommand, null);
  assert.equal(vanilla.confidence, 'medium');

  nowMs += 1_000;
  const conflictRoot = fixture('manager-conflict', {
    name: 'manager-conflict',
    packageManager: 'yarn@4.9.0',
    scripts: { start: 'node server.js' },
  }, { 'package-lock.json': '{}\n' });
  const conflictWorkspace = workspaces.register(conflictRoot);
  const conflict = await detector.detect(conflictWorkspace.id);
  assert.equal(conflict.packageManager, 'yarn');
  assert.equal(conflict.devScript, 'start');
  assert.equal(conflict.devCommand, 'yarn start');
  assert.equal(conflict.confidence, 'medium');

  const malformedRoot = fixture('malformed');
  writeFileSync(join(malformedRoot, 'package.json'), '{not-json\n');
  const malformedWorkspace = workspaces.register(malformedRoot);
  await assert.rejects(() => detector.detect(malformedWorkspace.id), /Unable to parse package\.json/i);

  const outsideRoot = fixture('outside', { name: 'outside', dependencies: { next: '^15.0.0' } });
  const symlinkRoot = fixture('symlink-escape');
  let symlinkEscapeChecked = false;
  try {
    symlinkSync(join(outsideRoot, 'package.json'), join(symlinkRoot, 'package.json'), 'file');
    symlinkEscapeChecked = true;
    const symlinkWorkspace = workspaces.register(symlinkRoot);
    await assert.rejects(() => detector.detect(symlinkWorkspace.id), /outside the registered root/i);
  } catch (error) {
    if (symlinkEscapeChecked) throw error;
  }

  const serializedEvents = JSON.stringify(observed);
  assert.equal(serializedEvents.includes(nextRoot), false, 'detection events must not expose workspace root paths');
  assert.equal(serializedEvents.includes('Next Fixture'), false, 'detection events must not expose workspace display names');
  assert.ok(detector.status().detections >= 5);
  assert.equal(detector.status().filesystemMutation, false);
  assert.equal(detector.status().networkAccess, false);
  assert.equal(detector.status().gitAuthority, false);
  detector.shutdown();
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
  const daemonWorkspace = daemon.workspaces.register(nextRoot, 'Daemon Project');
  const daemonDetection = await daemon.projectDetection.detect(daemonWorkspace.id);
  assert.equal(daemonDetection.framework, 'next');
  const readiness = await fetch(`${address.origin}/readyz`).then((response) => response.json()) as Record<string, unknown>;
  assert.equal(readiness.ready, true);
  assert.equal(readiness.projectDetectionReady, true);
  assert.equal(readiness.projectDetections, 1);
  const health = await fetch(`${address.origin}/healthz`).then((response) => response.json()) as { projectDetection?: Record<string, unknown> };
  assert.equal(health.projectDetection?.ready, true);
  assert.equal(health.projectDetection?.rootOnly, true);
  assert.equal(health.projectDetection?.readOnly, true);
  assert.equal(health.projectDetection?.filesystemMutation, false);
  assert.equal(health.projectDetection?.networkAccess, false);
  assert.equal(health.projectDetection?.gitAuthority, false);
  assert.equal(health.projectDetection?.externalTransport, false);
  const forbiddenEndpoint = await fetch(`${address.origin}/v1/project-detection`);
  assert.equal(forbiddenEndpoint.status, 404);
  await daemon.stop('build20 test complete');

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build20-project-detection-runtime/1',
    nextPnpm: true,
    reactViteNpm: true,
    astroYarn: true,
    vanillaFallback: true,
    packageManagerConflict: true,
    malformedPackageRejected: true,
    symlinkEscapeChecked,
    filesystemMutation: false,
    metadataOnlyEvents: true,
    daemonReadinessIntegrated: true,
    externalTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
