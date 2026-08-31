import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('ui/multi-agent-runtime-v74.js','utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
const runtimePackage = JSON.parse(fs.readFileSync('release/runtime-package.json','utf8'));
const config = fs.readFileSync('settings/config.js','utf8');

assert.equal(manifest.version,'2.6.76');
assert.equal(runtimePackage.candidate,'2.6.76');
assert.match(config,/export const VERSION = '2\.6\.76'/);

// Regression root cause: Build74 used a MutationObserver over document.documentElement
// with subtree:true, causing work on virtually every Lovable SPA DOM mutation.
assert.doesNotMatch(ui,/new\s+MutationObserver\s*\(/);
assert.doesNotMatch(ui,/observe\s*\(\s*document\.documentElement\s*,\s*\{[^}]*subtree\s*:\s*true/s);

// Mounting must remain bounded and event-driven rather than a perpetual scanner.
assert.match(ui,/MOUNT_RETRY_DELAYS/);
assert.match(ui,/ld2:ui-mounted/);
assert.match(ui,/globalDomObserver:false/);
assert.match(ui,/mountRetryIndex>=MOUNT_RETRY_DELAYS\.length-1/);

console.log('v2.6.76 main-thread stability: ok');
