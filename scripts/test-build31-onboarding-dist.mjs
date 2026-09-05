import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'apps/studio/dist');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'architecture.guardian.json'), 'utf8'));
assert.ok(fs.existsSync(dist), 'Studio dist is missing; run the Vite build first.');

function collect(directory, extension) {
  const output = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile() && entry.name.endsWith(extension)) output.push(absolute);
    }
  }
  return output.sort();
}

const js = collect(dist, '.js')
  .filter((file) => !file.endsWith('service-worker.js'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const css = collect(dist, '.css').map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const serviceWorker = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');

for (const marker of [
  'gd-adaptive-user-profile/1',
  'How familiar are you with building software?',
  'What will you mainly use GitHub Decrypter for?',
  'How much do you want to learn while we build?',
  'How detailed should explanations usually be?',
  'Retake onboarding',
]) assert.ok(js.includes(marker), `Built Studio bundle is missing onboarding marker: ${marker}`);

assert.ok(css.includes('.studio-onboarding-option'), 'Built CSS is missing onboarding choice styling.');
assert.ok(css.includes('.studio-profile-summary'), 'Built CSS is missing adaptive profile summary styling.');
assert.ok(serviceWorker.includes(`gd-studio-shell-v${policy.currentBuild}`), 'PWA shell cache is not aligned with the current Studio Build.');
assert.doesNotMatch(js, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
if (policy.currentBuild === 31) {
  assert.doesNotMatch(js, /127\.0\.0\.1:43110|localhost:43110/);
} else if (policy.currentBuild >= 32) {
  assert.ok(js.includes('127.0.0.1:43110/v1/environment-doctor'), 'Later Environment Doctor transport is missing from the current bundle.');
}

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build31-onboarding-dist/2',
  owningBuild: 31,
  currentBuild: policy.currentBuild,
  profileSchemaPresent: true,
  conversationalQuestionsPresent: true,
  onboardingCssPresent: true,
  pwaCacheAligned: true,
  browserPersistenceMarkers: false,
  laterEnvironmentDoctorAllowed: policy.currentBuild >= 32,
}, null, 2));
