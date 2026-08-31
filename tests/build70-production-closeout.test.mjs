import fs from 'node:fs';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPrivateKey, sign, verify } from 'node:crypto';
import { detectRsaPrivateKeyFormat, normalizeRsaPrivateKeyToPkcs8Der } from '../supabase/functions/_shared/github-rsa.js';
import { sanitizeDurableSettings } from '../storage/secret-sanitizer.js';

const read = path => fs.readFileSync(path, 'utf8');

// PKCS#1 and PKCS#8 must both produce a valid PKCS#8 key accepted by Node/WebCrypto-compatible tooling.
const pair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type:'spki', format:'pem' },
  privateKeyEncoding: { type:'pkcs1', format:'pem' }
});
assert.equal(detectRsaPrivateKeyFormat(pair.privateKey), 'pkcs1');
const normalizedDer = normalizeRsaPrivateKeyToPkcs8Der(pair.privateKey);
const normalizedKey = createPrivateKey({ key:Buffer.from(normalizedDer), format:'der', type:'pkcs8' });
const payload = Buffer.from('lovable-decrypter-build70-pkcs-compat');
const signature = sign('sha256', payload, normalizedKey);
assert.equal(verify('sha256', payload, pair.publicKey, signature), true);
const pkcs8Pem = createPrivateKey(pair.privateKey).export({ type:'pkcs8', format:'pem' }).toString();
assert.equal(detectRsaPrivateKeyFormat(pkcs8Pem), 'pkcs8');
assert.deepEqual(Buffer.from(normalizeRsaPrivateKeyToPkcs8Der(pkcs8Pem)), createPrivateKey(pkcs8Pem).export({ type:'pkcs8', format:'der' }));
assert.throws(() => normalizeRsaPrivateKeyToPkcs8Der('-----BEGIN EC PRIVATE KEY-----\nAA==\n-----END EC PRIVATE KEY-----'), /UNSUPPORTED/);

// Provider secrets must be stripped even when unexpected fields are injected.
const dirty = {
  auth:{ licenseKey:'LD2.allowed', deviceId:'device-ok' },
  github:{ authMode:'legacy_token', token:'ghp-forbidden', privateKey:'pem', installationToken:'ghs-forbidden', owner:'acme', repo:'app' },
  supabase:{ authMode:'oauth', projectRef:'abcdefghijklmnopqrst', anonKey:'anon-forbidden', managementToken:'mgmt-forbidden', clientSecret:'secret', refreshToken:'refresh', serviceRoleKey:'service-role' },
  githubPrivateKey:'top-level-forbidden',
  supabaseRefreshToken:'top-level-refresh'
};
const clean = sanitizeDurableSettings(dirty);
assert.equal(clean.auth.licenseKey, 'LD2.allowed');
assert.equal(clean.github.authMode, 'github_app');
assert.equal(clean.github.token, '');
assert.equal(clean.github.owner, 'acme');
assert.equal(clean.github.privateKey, undefined);
assert.equal(clean.github.installationToken, undefined);
assert.equal(clean.supabase.projectRef, 'abcdefghijklmnopqrst');
assert.equal(clean.supabase.anonKey, '');
assert.equal(clean.supabase.managementToken, '');
assert.equal(clean.supabase.clientSecret, undefined);
assert.equal(clean.supabase.refreshToken, undefined);
assert.equal(clean.supabase.serviceRoleKey, undefined);
assert.equal(clean.githubPrivateKey, undefined);
assert.equal(clean.supabaseRefreshToken, undefined);

// Exercise the actual chrome.storage.local store with injected/legacy secrets.
const localData = {};
globalThis.chrome = {
  storage:{ local:{
    async get(key) { return { [key]:localData[key] }; },
    async set(value) { Object.assign(localData, value); }
  } }
};
const { saveSettings, getSettings } = await import(`../storage/settings-store.js?closeout=${Date.now()}`);
await saveSettings(dirty);
assert.equal(localData.ld2_settings.github.token, '');
assert.equal(localData.ld2_settings.github.privateKey, undefined);
assert.equal(localData.ld2_settings.supabase.refreshToken, undefined);
assert.equal(localData.ld2_settings.supabase.clientSecret, undefined);
localData.ld2_settings.github.privateKey = 'legacy-pem';
localData.ld2_settings.supabase.refreshToken = 'legacy-refresh';
await getSettings();
assert.equal(localData.ld2_settings.github.privateKey, undefined);
assert.equal(localData.ld2_settings.supabase.refreshToken, undefined);

const manifest = JSON.parse(read('manifest.json'));
const firstScript = manifest.content_scripts.find(entry => entry.run_at === 'document_start');
assert.ok(firstScript?.js?.includes('content/integration-callback-bridge.js'));

const callbackBridge = read('content/integration-callback-bridge.js');
const callbackRuntime = read('background/integration-callback-runtime.js');
const workerEntry = read('background/service-worker-entry.js');
assert.ok(callbackBridge.includes('ld2_integration_callback'));
assert.ok(callbackBridge.includes('LD2_INTEGRATION_CALLBACK_COMPLETE'));
assert.ok(callbackBridge.includes('replaceChildren'));
assert.ok(!callbackBridge.includes('document.body.innerHTML'));
assert.ok(callbackRuntime.includes("url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev')"));
assert.ok(callbackRuntime.includes('chrome.tabs.remove(tabId)'));
assert.ok(workerEntry.includes('installIntegrationCallbackRuntime'));

const githubEdge = read('supabase/functions/ld-github-app/index.ts');
const supabaseEdge = read('supabase/functions/ld-supabase-oauth/index.ts');
assert.ok(githubEdge.includes('normalizeRsaPrivateKeyToPkcs8Der'));
assert.ok(githubEdge.includes('CALLBACK_SURFACE = "https://lovable.dev/"'));
assert.ok(githubEdge.includes('callbackRedirect("connected")'));
assert.ok(!githubEdge.includes('Content-Type": "text/html'));
assert.ok(!githubEdge.includes('successPage('));
assert.ok(supabaseEdge.includes('CALLBACK_SURFACE = "https://lovable.dev/"'));
assert.ok(supabaseEdge.includes('canonicalScope'));
assert.ok(supabaseEdge.includes('granted_scope: grantedScope'));
assert.ok(supabaseEdge.includes('callbackRedirect("connected", { count: projects.length })'));
assert.ok(!supabaseEdge.includes('Content-Type": "text/html'));
assert.ok(!supabaseEdge.includes('successPage('));
assert.ok(supabaseEdge.indexOf('await storeSecret(sb, String(connection.refresh_secret_name), String(data.refresh_token)') < supabaseEdge.indexOf('return {\n    accessToken'));

// Existing UI mapping path must remain one authoritative mapping system.
const integrationsUi = read('ui/integrations-v49.js');
assert.ok(integrationsUi.includes('patch.projectMappings = { [projectId()]'));
assert.ok(integrationsUi.includes("await supabase('project_test', { project_ref:project.ref })"));
assert.ok(integrationsUi.includes('patch.supabaseMappings = { [projectId()]:selected }'));

console.log('Build70 production closeout contract OK');
