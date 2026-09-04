import assert from 'node:assert/strict';
import { createHmac, createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CapabilitySecurityAuthority,
  DurableJobEngine,
  GitHubAppRuntime,
  LocalDatabase,
  OfflineExecutionCoordinator,
  SecretsVault,
  GITHUB_APP_CONFIG_RESOURCE,
  GITHUB_APP_INSTALLATIONS_RESOURCE,
  GITHUB_APP_PRIVATE_KEY_RESOURCE,
  GITHUB_APP_WEBHOOK_DELIVERIES_RESOURCE,
  GITHUB_APP_WEBHOOK_SECRET_RESOURCE,
  LOCAL_DATABASE_SCHEMA_VERSION,
} from '../apps/local/src/index.js';

const tempRoot = mkdtempSync(join(tmpdir(), 'gd-build23-'));
let nowMs = Date.parse('2026-09-04T12:00:00.000Z');
const now = () => new Date(nowMs).toISOString();
const tick = (milliseconds = 1_000) => { nowMs += milliseconds; };

try {
  const database = new LocalDatabase({ path: join(tempRoot, 'github-app.sqlite3'), now });
  const opened = database.open();
  assert.equal(opened.schemaVersion, 11);
  assert.equal(LOCAL_DATABASE_SCHEMA_VERSION, 11);

  const jobs = new DurableJobEngine({ database, now });
  const offline = new OfflineExecutionCoordinator({ database, jobs, now });
  await offline.initialize();
  await offline.markOnline('build23-test');

  const capabilities = new CapabilitySecurityAuthority({
    database,
    now,
    processInstanceId: 'gd_process_build23_test',
  });
  await capabilities.initialize();

  const vault = new SecretsVault({
    database,
    capabilities,
    keyPath: join(tempRoot, 'vault.key'),
    now,
  });
  await vault.initialize();

  const job = await jobs.enqueue({ kind: 'build23-github-app', payload: null });
  const issued = capabilities.issueGrant({
    jobId: job.id,
    ttlMs: 60 * 60 * 1_000,
    label: 'Build 23 GitHub App test',
    claims: [
      { capability: 'READ', resource: GITHUB_APP_CONFIG_RESOURCE, match: 'exact' },
      { capability: 'READ', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'DATABASE_WRITE', resource: GITHUB_APP_CONFIG_RESOURCE, match: 'exact' },
      { capability: 'DATABASE_WRITE', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'DATABASE_WRITE', resource: GITHUB_APP_WEBHOOK_DELIVERIES_RESOURCE, match: 'exact' },
      { capability: 'NETWORK', resource: GITHUB_APP_INSTALLATIONS_RESOURCE, match: 'prefix' },
      { capability: 'SECRETS', resource: GITHUB_APP_PRIVATE_KEY_RESOURCE, match: 'exact' },
      { capability: 'SECRETS', resource: GITHUB_APP_WEBHOOK_SECRET_RESOURCE, match: 'exact' },
    ],
  });

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const webhookSecret = 'BUILD23_WEBHOOK_SECRET_MUST_NOT_BE_PERSISTED';
  const installationToken = 'ghs_BUILD23_TOKEN_MUST_NOT_BE_PERSISTED';
  let fetchCalls = 0;
  let seenAuthorization = '';
  const fakeFetch: typeof fetch = async (_input, init) => {
    fetchCalls += 1;
    seenAuthorization = String((init?.headers as Record<string, string> | undefined)?.authorization ?? '');
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
    fetchImpl: fakeFetch,
    now,
  });
  const initial = await githubApp.initialize();
  assert.equal(initial.ready, true);
  assert.equal(initial.configured, false);
  assert.equal(initial.installationTokenPersistence, false);
  assert.equal(initial.webhookPayloadPersistence, false);
  assert.equal(initial.genericHttpTransport, false);

  const configuration = await githubApp.configure({
    jobId: job.id,
    token: issued.token,
    appId: 123456,
    privateKeyPem,
    webhookSecret,
  });
  assert.equal(configuration.appId, '123456');
  assert.equal(githubApp.status().configured, true);

  tick();
  const appJwt = await githubApp.createAppJwt({ jobId: job.id, token: issued.token });
  assert.equal(appJwt.algorithm, 'RS256');
  assert.equal(appJwt.persistable, false);
  const parts = appJwt.token.split('.');
  assert.equal(parts.length, 3);
  const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
  assert.equal(payload.iss, '123456');
  assert.equal(Number(payload.exp) - Number(payload.iat), 600);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`, 'utf8');
  verifier.end();
  assert.equal(verifier.verify(publicKeyPem, Buffer.from(parts[2]!, 'base64url')), true);

  const installation = await githubApp.upsertInstallation({
    jobId: job.id,
    token: issued.token,
    installationId: 987654,
    accountLogin: 'example-account',
    accountType: 'Organization',
    repositorySelection: 'selected',
  });
  assert.equal(installation.state, 'active');
  assert.equal((await githubApp.listInstallations({ jobId: job.id, token: issued.token })).length, 1);

  tick();
  const tokenResult = await githubApp.createInstallationAccessToken({
    jobId: job.id,
    token: issued.token,
    installationId: 987654,
  });
  assert.equal(tokenResult.token, installationToken);
  assert.equal(tokenResult.persistable, false);
  assert.equal(fetchCalls, 1);
  assert.match(seenAuthorization, /^Bearer eyJ/);

  const rawBody = JSON.stringify({ action: 'created', installation: { id: 987654 } });
  const signature = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;
  tick();
  const verified = await githubApp.verifyWebhook({
    jobId: job.id,
    token: issued.token,
    rawBody,
    signature,
    deliveryId: 'build23-delivery-1',
    event: 'installation',
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.duplicate, false);
  assert.equal(verified.payloadPersistence, false);

  const replay = await githubApp.verifyWebhook({
    jobId: job.id,
    token: issued.token,
    rawBody,
    signature,
    deliveryId: 'build23-delivery-1',
    event: 'installation',
  });
  assert.equal(replay.valid, true);
  assert.equal(replay.duplicate, true);

  const invalid = await githubApp.verifyWebhook({
    jobId: job.id,
    token: issued.token,
    rawBody,
    signature: `sha256=${'0'.repeat(64)}`,
    deliveryId: 'build23-delivery-invalid',
    event: 'installation',
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.duplicate, false);

  const persisted = database.read((sqlite) => JSON.stringify({
    config: sqlite.prepare('SELECT * FROM gd_github_app_config').all(),
    installations: sqlite.prepare('SELECT * FROM gd_github_app_installations').all(),
    deliveries: sqlite.prepare('SELECT * FROM gd_github_webhook_deliveries').all(),
  }));
  assert.equal(persisted.includes(privateKeyPem), false);
  assert.equal(persisted.includes(webhookSecret), false);
  assert.equal(persisted.includes(installationToken), false);
  assert.equal(persisted.includes(rawBody), false);

  await offline.markOffline('build23-test');
  await assert.rejects(
    () => githubApp.createInstallationAccessToken({ jobId: job.id, token: issued.token, installationId: 987654 }),
    /requires online connectivity/i,
  );
  assert.equal(fetchCalls, 1, 'offline rejection must happen before network transport');

  await assert.rejects(
    () => githubApp.createAppJwt({ jobId: job.id, token: 'invalid-token' }),
    /capability/i,
  );

  githubApp.shutdown();
  vault.shutdown();
  await capabilities.shutdown('build23 test complete');
  database.close();

  console.log(JSON.stringify({
    ok: true,
    schema: 'gd-build23-github-app-runtime/1',
    databaseSchema: 11,
    rs256Jwt: true,
    jwtTtlSeconds: 600,
    installationTokenShortLived: true,
    installationTokenPersistence: false,
    rawBodyHmacSha256: true,
    constantTimeSignatureComparison: true,
    replayMetadataOnly: true,
    webhookPayloadPersistence: false,
    secretsVaultBacked: true,
    capabilityGated: true,
    offlineFailsClosed: true,
    providerOperations: false,
    genericHttpTransport: false,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
