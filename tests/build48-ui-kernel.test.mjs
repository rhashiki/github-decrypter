import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('release/runtime-package.json', 'utf8'));
const js = fs.readFileSync('ui/ui-kernel-v48.js', 'utf8');
const css = fs.readFileSync('ui/ui-kernel-v48.css', 'utf8');
const settings = fs.readFileSync('settings/config.js', 'utf8');
const app = manifest.content_scripts.find(item => Array.isArray(item.js) && item.js.includes('ui/ui-kernel-v48.js'));
const versionParts = value => String(value).split('.').map(Number);
const atLeast = (value, floor) => {
  const a=versionParts(value), b=versionParts(floor);
  for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x>y;}
  return true;
};

if (!app) throw new Error('Build48 kernel missing from manifest');
if (app.js.includes('ui/nexus-parity-v47.js')) throw new Error('Build47 launcher JS must be superseded');
if (!app.css.includes('ui/ui-kernel-v48.css')) throw new Error('Build48 CSS missing');
if (!atLeast(manifest.version,'2.5.48')) throw new Error(`unexpected manifest version ${manifest.version}`);
if (!settings.includes(`VERSION = '${manifest.version}'`)) throw new Error('settings version mismatch');
if (pkg.candidate !== manifest.version) throw new Error('runtime package candidate mismatch');

const basePerms = ['storage', 'tabs', 'downloads', 'unlimitedStorage', 'alarms'];
const expectedPerms = atLeast(manifest.version, '2.6.62') ? [...basePerms, 'identity'] : basePerms;
if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPerms)) throw new Error('permissions boundary changed');
if (atLeast(manifest.version, '2.6.62')) {
  const allowedOptionalHosts = ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'];
  if (JSON.stringify(manifest.optional_host_permissions || []) !== JSON.stringify(allowedOptionalHosts)) {
    throw new Error('Build62 optional MCP host permission boundary changed');
  }
  if (!app.js.includes('content/mcp-runtime-client.js')) throw new Error('identity permission requires Build62 MCP runtime client');
}
if (!js.includes('LovableDecrypterUIActions')) throw new Error('authoritative action registry missing');
if (!js.includes("register('workspace'")) throw new Error('workspace direct provider missing');
if (!js.includes("register('project-recovery'")) throw new Error('recovery direct provider missing');
if (!js.includes("register('operations'")) throw new Error('operations direct provider missing');
if (js.includes('ACTION_SELECTORS') || js.includes('findTarget(')) throw new Error('legacy DOM action routing detected');
if (js.includes('.click(')) throw new Error('hidden DOM click delegation detected in Build48 kernel');
if (js.includes('ld48-cascade-2') || js.includes('data-open>Abrir')) throw new Error('generic third-level Open cascade returned');
if (!js.includes('[data-minimize]')) throw new Error('minimize controller missing');
if (!css.includes('clamp(')) throw new Error('responsive typography missing');
if (!css.includes('conic-gradient')) throw new Error('approved FAB gradient missing');

console.log('Build48 UI kernel cumulative contract OK');
