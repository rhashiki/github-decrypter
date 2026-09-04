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

// 3. Historical Studio gate must still prove React/Vite would have been rejected before Build 27.
// Build 27 legitimately owns main.tsx now, so replay the policy at Build 26 instead of deleting real Studio files.
const policyPath = path.join(root, 'architecture.guardian.json');
const policyOriginal = fs.readFileSync(policyPath, 'utf8');
try {
  const policy = JSON.parse(policyOriginal);
  policy.currentBuild = 26;
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  runGuardianExpecting('AG061');
} finally {
  fs.writeFileSync(policyPath, policyOriginal);
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
