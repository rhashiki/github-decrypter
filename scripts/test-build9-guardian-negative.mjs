import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardian = path.join(root, 'scripts/architecture-guardian.mjs');

function runGuardianExpecting(code) {
  const result = spawnSync(process.execPath, [guardian], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0, `Guardian unexpectedly accepted injected violation ${code}.\n${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes(code), `Guardian failed, but did not report expected ${code}.\n${result.stdout}\n${result.stderr}`);
}

// 1. Environment-neutral protocol must reject browser authority.
const protocolProbe = path.join(root, 'packages/protocol/src/__guardian_negative_probe.ts');
try {
  fs.writeFileSync(protocolProbe, 'export const leakedBrowserAuthority = window.location.href;\n');
  runGuardianExpecting('AG032');
} finally {
  fs.rmSync(protocolProbe, { force: true });
}

// 2. Workflow write authority must remain explicit and allowlisted.
const workflow = path.join(root, '.github/workflows/build9-architecture-guardian.yml');
const workflowOriginal = fs.readFileSync(workflow, 'utf8');
try {
  const mutated = workflowOriginal.replace('contents: read', 'contents: write');
  assert.notEqual(mutated, workflowOriginal, 'workflow fixture did not contain read-only contents permission');
  fs.writeFileSync(workflow, mutated);
  runGuardianExpecting('AG070');
} finally {
  fs.writeFileSync(workflow, workflowOriginal);
}

// 3. Studio React entry point is phase-gated until Build 27.
const prematureStudio = path.join(root, 'apps/studio/src/main.tsx');
assert.ok(!fs.existsSync(prematureStudio), 'negative fixture requires main.tsx to be absent before Build 27');
try {
  fs.writeFileSync(prematureStudio, 'export {};\n');
  runGuardianExpecting('AG061');
} finally {
  fs.rmSync(prematureStudio, { force: true });
}

// The real tree must still pass after all probes are restored.
const final = spawnSync(process.execPath, [guardian], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(final.status, 0, `Guardian did not recover after negative probes.\n${final.stdout}\n${final.stderr}`);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build9-guardian-negative/1',
  rejected: ['AG032', 'AG070', 'AG061'],
  restoredTreePasses: true,
}, null, 2));
