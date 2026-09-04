import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  GitHubAppRuntime,
  GitHubProvider,
  LocalDatabase,
  OfflineExecutionCoordinator,
  SecretsVault,
  GITHUB_APP_CONFIG_RESOURCE,
  GITHUB_APP_INSTALLATIONS_RESOURCE,
  GITHUB_APP_PRIVATE_KEY_RESOURCE,
  GITHUB_APP_WEBHOOK_SECRET_RESOURCE,
  GITHUB_PROVIDER_INSTALLATIONS_RESOURCE,
  LOCAL_DATABASE_SCHEMA_VERSION,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build24-'));
let nowMs = Date.parse('2026-09-04T16:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const tick = (milliseconds = 1_000) => { nowMs += milliseconds; };

const installationId = 246810;
const installationToken = 'ghs_BUILD24_TOKEN_MUST_NOT_BE_PERSISTED';

const repo = (name: string, defaultBranch: string | null = 'main') => ({
  id: name === 'alpha' ? 101 : 102,
  node_id: name === 'alpha' ? 'R_alpha' : 'R_empty',
  name,
  full_name: `example-org/${name}`,
  private: name !== 'alpha',
  fork: false,
  archived: false,
  disabled: false,
  default_branch: defaultBranch,
  html_url: `https://github.com/example-org/${name}`,
  clone_url: `https://github.com/example-org/${name}.git`,
  updated_at: '2026-09-04T15:00:00Z',
  owner: { login: 'example-org' },
});

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'github-provider.sqlite3'), now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 11);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 11);

  const jobs = new DurableJobEngine({ database, now });
  const offline = new OfflineExecutionCoordinator({ database, jobs, now });
  await offline.initialize();
  await offline.markOnline('build24-test');

  const capabilities = new CapabilitySecurityAuthority({
    database,
    now,
    processInstanceId: 'gd_process_build24_test',
  });
  await capabilities.initialize();

  const vault = new SecretsVault({
    database,
    capabilities,
    keyPath: join(tempRoot, 'vault.key'),
    now,
  });
  await vault.initialize();

  const job = await jobs.enqueue({ kind: 'build24-github-provider', payload: null });
  const issued = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60 * 60 * 1_000,
    label: 'Build 24 GitHub Provider test',
    claims: [
      { capability: 'READ', resource: GITHUB_APP_CONFIG_RESOURCE, match: 'exact' },
      { capability: 'READ', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'DATABASE_WRITE', resource: GITHUB_APP_CONFIG_RESOURCE, match: 'exact' },
      { capability: 'DATABASE_WRITE', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'NETWORK', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'SECRETS', resource: GITHUB_APP_PRIVATE_KEY_RESOURCE, match: 'exact' },
      { capability: 'SECRETS', resource: GITHUB_APP_WEBHOOK_SECRET_RESOURCE, match: 'exact' },
      { capability: 'READ', resource: GITHUB_PROVIDER_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'NETWORK', resource: GITHUB_PROVIDER_INSTALLATIONS_RESOURCE, match: 'prefix' },
    ],
  });

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const webhookSecret = 'BUILD24_WEBHOOK_SECRET_MUST_NOT_BE_PERSISTED';
  let appFetchCalls = 0;
  let appAuthorization = '';
  const appFetch: typeof fetch = async (_input, init) => {
    appFetchCalls += 1;
    appAuthorization = String((init?.headers as Record<string, string> | undefined)?.authorization ?? '');
    assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({
      token: installationToken,
      expires_at: new Date(nowMs + 60 * 60 * 1_000).toISOString(),
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  const githubApp = new GitHubAppRuntime({
    database,
    capabilities,
    vault,
    offline,
    fetchImpl: appFetch,
    now,
  });
  await githubApp.initialize();
  await githubApp.configure({
    jobId: job.id,
    token: issued.token,
    appId: 123456,
    privateKeyPem,
    webhookSecret,
  });
  await githubApp.upsertInstallation({
    jobId: job.id,
    token: issued.token,
    installationId,
    accountLogin: 'example-org',
    accountType: 'Organization',
    repositorySelection: 'selected',
  });

  const providerRequests: Array<{ url: string; method: string; authorization: string; apiVersion: string }> = [];
  let providerMode: 'normal' | 'untrusted-url' = 'normal';
  const providerFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = init?.headers as Record<string, string> | undefined;
    providerRequests.push({
      url,
      method: String(init?.method ?? ''),
      authorization: String(headers?.authorization ?? ''),
      apiVersion: String(headers?.['x-github-api-version'] ?? ''),
    });
    assert.equal(init?.method, 'GET');
    assert.equal(headers?.authorization, `Bearer ${installationToken}`);
    assert.equal(headers?.['x-github-api-version'], '2022-11-28');

    if (url.includes('/installation/repositories?')) {
      return new Response(JSON.stringify({
        total_count: 3,
        repositories: [repo('alpha'), repo('empty', null)],
      }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    if (url.includes('/repos/example-org/alpha/branches?')) {
      return new Response(JSON.stringify([
        { name: 'main', commit: { sha: 'a'.repeat(40) }, protected: true },
        { name: 'feature/provider', commit: { sha: 'b'.repeat(40) }, protected: false },
      ]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/repos/example-org/alpha')) {
      const body = repo('alpha');
      if (providerMode === 'untrusted-url') body.html_url = 'https://example.invalid/example-org/alpha';
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  const provider = new GitHubProvider({ capabilities, offline, githubApp, fetchImpl: providerFetch, now });
  const initial = await provider.initialize();
  assert.equal(initial.ready, true);
  assert.equal(initial.configured, true);
  assert.deepEqual(initial.operations, ['repositories.list', 'repository.get', 'branches.list']);
  assert.equal(initial.readOnly, true);
  assert.equal(initial.installationScoped, true);
  assert.equal(initial.installationTokenPersistence, false);
  assert.equal(initial.responsePersistence, false);
  assert.equal(initial.genericRequestApi, false);
  assert.equal(initial.collaborationMutation, false);

  tick();
  const repositories = await provider.listRepositories({
    jobId: job.id,
    token: issued.token,
    installationId,
    page: 1,
    perPage: 2,
  });
  assert.equal(repositories.schema, 'gd-github-provider/1');
  assert.equal(repositories.totalCount, 3);
  assert.equal(repositories.hasMore, true);
  assert.equal(repositories.repositories.length, 2);
  assert.equal(repositories.repositories[0]?.fullName, 'example-org/alpha');
  assert.equal(repositories.repositories[1]?.defaultBranch, null);

  tick();
  const repository = await provider.getRepository({
    jobId: job.id,
    token: issued.token,
    installationId,
    owner: 'example-org',
    repo: 'alpha',
  });
  assert.equal(repository.repository.defaultBranch, 'main');
  assert.equal(repository.repository.cloneUrl, 'https://github.com/example-org/alpha.git');

  tick();
  const branches = await provider.listBranches({
    jobId: job.id,
    token: issued.token,
    installationId,
    owner: 'example-org',
    repo: 'alpha',
    page: 1,
    perPage: 2,
  });
  assert.equal(branches.branches.length, 2);
  assert.equal(branches.branches[0]?.name, 'main');
  assert.equal(branches.branches[0]?.commitSha, 'a'.repeat(40));
  assert.equal(branches.branches[1]?.name, 'feature/provider');
  assert.equal(branches.hasMore, true);

  assert.equal(appFetchCalls, 3, 'each Provider operation must request an ephemeral installation token');
  assert.match(appAuthorization, /^Bearer eyJ/);
  assert.equal(providerRequests.length, 3);
  assert.ok(providerRequests.every((request) => request.method === 'GET'));
  assert.ok(providerRequests.every((request) => request.authorization === `Bearer ${installationToken}`));

  const persisted = database.read((sqlite) => JSON.stringify({
    schema: sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name").all(),
    config: sqlite.prepare('SELECT * FROM gd_github_app_config').all(),
    installations: sqlite.prepare('SELECT * FROM gd_github_app_installations').all(),
  }));
  assert.equal(persisted.includes(privateKeyPem), false);
  assert.equal(persisted.includes(webhookSecret), false);
  assert.equal(persisted.includes(installationToken), false);
  assert.equal(persisted.includes('gd_github_provider'), false);

  await offline.markOffline('build24-test');
  const appCallsBeforeOffline = appFetchCalls;
  const providerCallsBeforeOffline = providerRequests.length;
  await assert.rejects(
    () => provider.listRepositories({ jobId: job.id, token: issued.token, installationId }),
    /requires online connectivity/i,
  );
  assert.equal(appFetchCalls, appCallsBeforeOffline, 'offline rejection must happen before GitHub App token exchange');
  assert.equal(providerRequests.length, providerCallsBeforeOffline, 'offline rejection must happen before Provider transport');

  await offline.markOnline('build24-test');
  await assert.rejects(
    () => provider.getRepository({ jobId: job.id, token: 'invalid-token', installationId, owner: 'example-org', repo: 'alpha' }),
    /capability/i,
  );
  assert.equal(providerRequests.length, providerCallsBeforeOffline, 'capability rejection must happen before Provider transport');

  await assert.rejects(
    () => provider.listRepositories({ jobId: job.id, token: issued.token, installationId: 999999 }),
    /not registered locally/i,
  );
  assert.equal(providerRequests.length, providerCallsBeforeOffline, 'unknown installation must fail before Provider transport');

  providerMode = 'untrusted-url';
  await assert.rejects(
    () => provider.getRepository({ jobId: job.id, token: issued.token, installationId, owner: 'example-org', repo: 'alpha' }),
    /untrusted repository html_url/i,
  );
  providerMode = 'normal';

  provider.shutdown();
  assert.equal(provider.status().ready, false);
  githubApp.shutdown();
  vault.shutdown();
  await capabilities.shutdown('build24 test complete');
  database.close();

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build24-github-provider-runtime/1',
    databaseSchema: 11,
    operations: ['repositories.list', 'repository.get', 'branches.list'],
    readOnly: true,
    installationScoped: true,
    capabilityGated: true,
    githubAppTokenAuthorityPreserved: true,
    ephemeralInstallationTokenPerOperation: true,
    offlineFailsClosedBeforeNetwork: true,
    responseNormalization: true,
    trustedRepositoryUrls: true,
    installationTokenPersistence: false,
    responsePersistence: false,
    providerDatabaseTables: false,
    genericRequestApi: false,
    collaborationMutation: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
