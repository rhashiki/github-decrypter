import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const config = fs.readFileSync('settings/config.js', 'utf8');
const coreSource = fs.readFileSync('content/project-recovery-doctor-core.js', 'utf8');
const runtimeSource = fs.readFileSync('content/project-recovery-doctor.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/ld-project-state/index.ts', 'utf8');

const [major, minor, patch] = String(manifest.version || '').split('.').map(Number);
assert.equal(`${major}.${minor}`, '2.4');
assert.ok(patch >= 28, `Build 28 regression contract requires patch >= 28; received ${manifest.version}`);
assert.match(config, /export const VERSION = '2\.4\.\d+'/);
assert.match(config, /TRUST_PROTOCOL_VERSION = '2\.4\.21'/);

const boot = manifest.content_scripts[0].js;
const graphIndex = boot.indexOf('content/unified-project-state-graph.js');
const coreIndex = boot.indexOf('content/project-recovery-doctor-core.js');
const doctorIndex = boot.indexOf('content/project-recovery-doctor.js');
const intelIndex = boot.indexOf('content/project-intelligence.js');
assert.ok(graphIndex >= 0 && coreIndex > graphIndex && doctorIndex > coreIndex && intelIndex > doctorIndex);
assert.ok(manifest.content_scripts[0].css.includes('ui/recovery-doctor.css'));

assert.match(runtimeSource, /Project Recovery Doctor/i);
assert.match(runtimeSource, /Auto Repair · Build 30/);
assert.match(runtimeSource, /projectStateInspect/);
assert.match(runtimeSource, /storageMetadataOnly: true/);
assert.match(runtimeSource, /allowSensitive: false/);
assert.match(runtimeSource, /arbitrários/);
assert.doesNotMatch(runtimeSource, /new\s+MutationObserver/);
assert.doesNotMatch(runtimeSource, /window\.fetch\s*=|globalThis\.fetch\s*=|XMLHttpRequest\.prototype|navigator\.sendBeacon\s*=/);

assert.match(edge, /from storage\.buckets/i);
assert.match(edge, /from storage\.objects/i);
assert.match(edge, /storage_metadata_read: true/);
assert.match(edge, /storage_object_bytes_read: false/);
assert.match(edge, /secret_values_read: false/);
assert.match(edge, /writes: false/);
assert.doesNotMatch(edge, /from storage\.objects[\s\S]*delete/i);

const context = { window: {}, URL, console };
context.window.window = context.window;
vm.runInNewContext(coreSource, context, { filename: 'project-recovery-doctor-core.js' });
const core = context.window.LovableDecrypterProjectRecoveryDoctorCore;
assert.ok(core);

const files = [
  { path: 'src/App.tsx', size: 850 },
  { path: 'src/logo.png', size: 100 },
  { path: 'supabase/functions/checkout/index.ts', size: 300 },
  { path: 'supabase/migrations/20260801000000_init.sql', size: 100 }
];

const contents = {
  'src/App.tsx': `
    import logo from './logo.png';
    import MissingPage from './MissingPage';
    export function App() {
      const login = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://app.example.com/auth/callback' }});
      const p = supabase.from('profiles').select('*');
      const o = supabase.from('orders').select('*');
      const rpc = supabase.rpc('create_order');
      const checkout = supabase.functions.invoke('checkout');
      const logos = supabase.storage.from('logos');
      return <><Route path="/checkout" element={<MissingPage/>}/><img src="/brand/missing-logo.png"/><img src={logo}/></>;
    }`,
  'supabase/functions/checkout/index.ts': `
    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const url = "https://api.mercadopago.com/checkout/preferences";
    export { token, url };`,
  'supabase/migrations/20260801000000_init.sql': 'create table profiles(id uuid primary key);'
};

const graph = {
  backend: { state: 'consistent', refs: ['abcdefghijklmnopqrst'] },
  files: {
    entries: [
      { path: 'src/App.tsx', lovable: { exists: true }, github: { exists: true } },
      { path: 'src/logo.png', lovable: { exists: true }, github: { exists: true } },
      { path: 'supabase/functions/checkout/index.ts', lovable: { exists: true }, github: { exists: true } },
      { path: 'supabase/migrations/20260801000000_init.sql', lovable: { exists: true }, github: { exists: true } }
    ]
  },
  database: {
    relations: [{ relation_name: 'profiles' }],
    routines: [{ routine_name: 'create_order' }]
  },
  migrations: { missing: ['20260802000000'], remoteOnly: [] },
  edgeFunctions: { deployed: [] },
  storage: {
    buckets: [{ id: 'logos', name: 'logos', public: true }],
    objects: [{ bucket_id: 'logos', name: 'missing-logo.png', mime_type: 'image/png', size: 1200 }]
  },
  auth: {
    site_url: 'https://old.example.com',
    uri_allow_list: ['https://old.example.com/auth/callback'],
    google: { enabled: false, client_id_present: false, client_secret_present: false }
  },
  secretNames: []
};

const facts = core.extractFileFacts('src/App.tsx', contents['src/App.tsx']);
assert.ok(facts.routes.includes('/checkout'));
assert.ok(facts.tables.includes('profiles'));
assert.ok(facts.tables.includes('orders'));
assert.ok(facts.edgeInvokes.includes('checkout'));
assert.ok(facts.storageBuckets.includes('logos'));
assert.ok(facts.oauthProviders.includes('google'));

const report = core.analyze({ files, contents, graph });
assert.equal(report.schema, 'ld-project-recovery-report/1');
assert.equal(report.status, 'broken');
assert.equal(report.guarantees.readOnly, true);
assert.equal(report.guarantees.automaticRepair, false);
assert.equal(report.guarantees.secretValuesIncluded, false);
assert.equal(report.guarantees.arbitraryRemoteAssetFetch, false);
assert.ok(report.routes.includes('/checkout'));
assert.ok(report.dependencies.missingTables.includes('orders'));
assert.ok(report.dependencies.missingFunctions.includes('checkout'));
assert.ok(report.dependencies.missingImports.some(item => item.specifier === './MissingPage'));
assert.ok(report.oauth.googleUsed);
assert.ok(report.mercadoPago.detected);
assert.ok(report.mercadoPago.missingSecretNames.includes('MERCADOPAGO_ACCESS_TOKEN'));
assert.ok(report.assets.some(asset => asset.reference === '/brand/missing-logo.png' && asset.state === 'missing' && asset.recovery?.type === 'supabase_storage_candidate'));
assert.equal(report.portability.portable, false);
assert.ok(report.issues.some(item => item.category === 'oauth' && item.severity === 'critical'));
assert.ok(report.issues.some(item => item.category === 'migrations'));
assert.ok(report.plan.some(item => item.area === 'assets'));
assert.ok(report.plan.some(item => item.area === 'validation'));

const remote = core.parseSupabaseStorageUrl('https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/logos/company.png');
assert.equal(remote.bucket, 'logos');
assert.equal(remote.object, 'company.png');

console.log(JSON.stringify({
  ok: true,
  build: 28,
  current_version: manifest.version,
  report_schema: report.schema,
  status: report.status,
  critical: report.counts.critical,
  high: report.counts.high,
  missing_assets: report.portability.assetCounts.missing,
  recoverable_assets: report.portability.assetCounts.recoverable,
  automatic_repair: false,
  secret_values_exposed: false
}, null, 2));
