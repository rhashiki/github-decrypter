import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));

const policy = json('architecture.guardian.json');
const rootPackage = json('package.json');
const studioPackage = json('apps/studio/package.json');
const profile = read('apps/studio/src/onboarding-profile.ts');
const flow = read('apps/studio/src/OnboardingFlow.tsx');
const app = read('apps/studio/src/App.tsx');
const identity = read('apps/studio/src/index.ts');

assert.equal(policy.currentBuild, 31);
assert.equal(policy.phaseGates.onboardingBuild, 31);
assert.equal(rootPackage.version, '0.0.31');
assert.equal(studioPackage.version, '0.0.31');
assert.equal(policy.adaptiveProfileAuthority.schema, 'gd-adaptive-user-profile/1');
assert.equal(policy.adaptiveProfileAuthority.profilePersistence, false);
assert.equal(policy.adaptiveProfileAuthority.persistenceOwner, 'local-runtime');
assert.equal(policy.adaptiveProfileAuthority.securityAuthority, false);
assert.equal(policy.adaptiveProfileAuthority.capabilitySource, false);
assert.equal(policy.adaptiveProfileAuthority.permissionSource, false);
assert.equal(policy.studioAuthority.adaptiveProfilePersistence, false);
assert.equal(policy.studioAuthority.localRuntimeTransport, false);
assert.equal(policy.studioAuthority.storageAuthority, false);

for (const marker of [
  "ADAPTIVE_USER_PROFILE_SCHEMA = 'gd-adaptive-user-profile/1'",
  "value: 'none'",
  "value: 'enthusiast'",
  "value: 'basic'",
  "value: 'experienced'",
  "value: 'recent-graduate'",
  "value: 'student'",
  'createAdaptiveUserProfile',
  'describeAdaptiveExperience',
]) assert.ok(profile.includes(marker), `Missing adaptive profile marker: ${marker}`);

for (const marker of [
  'How familiar are you with building software?',
  'What will you mainly use GitHub Decrypter for?',
  'How much do you want to learn while we build?',
  'How detailed should explanations usually be?',
  'No permissions are derived from these answers',
]) assert.ok(flow.includes(marker), `Missing onboarding marker: ${marker}`);

assert.ok(app.includes('<OnboardingFlow onComplete={setProfile} />'));
assert.ok(app.includes('Retake onboarding'));
assert.ok(identity.includes('adaptiveProfilePersistence: false'));
assert.doesNotMatch([profile, flow, app].join('\n'), /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|127\.0\.0\.1:43110|localhost:43110/);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build31-onboarding-static/1',
  build: 31,
  adaptiveUserProfileSchema: policy.adaptiveProfileAuthority.schema,
  requiredPreferences: policy.adaptiveProfileAuthority.requiredPreferences,
  conversationalOnboarding: true,
  sessionOnly: true,
  browserPersistence: false,
  securityAuthority: false,
  localRuntimeTransport: false,
}, null, 2));
