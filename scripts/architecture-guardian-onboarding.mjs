import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const exists = (relative) => fs.existsSync(path.join(root, relative));
const policy = JSON.parse(read('architecture.guardian.json'));
const rule = policy.adaptiveProfileAuthority;
const violations = [];

if (!rule || policy.currentBuild < 31 || rule.minimumBuild !== 31 || policy.phaseGates?.onboardingBuild !== 31) {
  violations.push({ code: 'AG290', message: 'Build 31 Onboarding / Adaptive User Profile authority is missing or inactive.' });
} else {
  const profile = read('apps/studio/src/onboarding-profile.ts');
  for (const marker of [
    "ONBOARDING_BUILD = 31",
    "ADAPTIVE_USER_PROFILE_SCHEMA = 'gd-adaptive-user-profile/1'",
    'TECHNICAL_LEVEL_OPTIONS',
    'OBJECTIVE_OPTIONS',
    'LEARNING_INTENT_OPTIONS',
    'EXPLANATION_DEPTH_OPTIONS',
    'technicalLevel:',
    'objective:',
    'learningIntent:',
    'explanationDepth:',
    'createAdaptiveUserProfile',
    'Object.freeze',
    'describeAdaptiveExperience',
  ]) if (!profile.includes(marker)) violations.push({ code: 'AG291', message: 'Adaptive User Profile contract is incomplete.', detail: marker });
  for (const forbidden of [
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bfetch\s*\(/,
    /\bWebSocket\b/, /\bXMLHttpRequest\b/, /@github-decrypter\/(?:local|github-provider|github-app)/,
  ]) if (forbidden.test(profile)) violations.push({ code: 'AG291', message: 'Adaptive profile contract crossed persistence, network or privileged runtime authority.', detail: String(forbidden) });

  const flow = read('apps/studio/src/OnboardingFlow.tsx');
  for (const marker of [
    'ONBOARDING_STEPS',
    "key: 'technicalLevel'",
    "key: 'objective'",
    "key: 'learningIntent'",
    "key: 'explanationDepth'",
    'How familiar are you with building software?',
    'What will you mainly use GitHub Decrypter for?',
    'How much do you want to learn while we build?',
    'How detailed should explanations usually be?',
    'Onboarding ·',
    'onComplete(createAdaptiveUserProfile',
    'Back',
  ]) if (!flow.includes(marker)) violations.push({ code: 'AG292', message: 'Conversational onboarding flow is incomplete.', detail: marker });

  const app = read('apps/studio/src/App.tsx');
  for (const marker of [
    'useState<AdaptiveUserProfile | null>(null)',
    '<OnboardingFlow onComplete={setProfile}',
    'describeAdaptiveExperience(profile)',
    'Adaptive User Profile active for this session',
    'Retake onboarding',
    "Profile: {profile ? 'session only' : 'not initialized'}",
  ]) if (!app.includes(marker)) violations.push({ code: 'AG293', message: 'Studio onboarding integration is incomplete.', detail: marker });

  const surface = [profile, flow, app].join('\n');
  for (const forbidden of [
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bfetch\s*\(/,
    /\bWebSocket\b/, /\bXMLHttpRequest\b/, /127\.0\.0\.1:43110|localhost:43110/,
    /@github-decrypter\/(?:local|github-provider|github-app)/,
  ]) if (forbidden.test(surface)) violations.push({ code: 'AG294', message: 'Build 31 onboarding crossed browser persistence, network or Local Runtime authority.', detail: String(forbidden) });

  if (
    rule.profilePersistence !== false
    || rule.sessionOnly !== true
    || rule.persistenceOwner !== 'local-runtime'
    || rule.securityAuthority !== false
    || rule.capabilitySource !== false
    || rule.permissionSource !== false
    || rule.approvalSource !== false
    || rule.scopeSource !== false
  ) violations.push({ code: 'AG295', message: 'Adaptive User Profile was allowed to become persistent frontend state or a security authority source.' });

  if (
    rule.ownerRoot !== 'apps/studio'
    || rule.schema !== 'gd-adaptive-user-profile/1'
    || rule.conversationalOnboarding !== true
    || JSON.stringify(rule.requiredPreferences) !== JSON.stringify(['technicalLevel','objective','learningIntent','explanationDepth'])
    || rule.beginnerSafeLanguage !== true
    || rule.userCanRetake !== true
    || rule.networkAuthority !== false
    || rule.storageAuthority !== false
    || rule.localRuntimeTransport !== false
    || rule.externalTransport !== false
  ) violations.push({ code: 'AG296', message: 'Machine-readable Build 31 onboarding authority was broadened or weakened.' });

  if (
    rule.environmentDoctorBuild !== 32
    || rule.aiProviderBuild !== 33
    || rule.learningModeBuild !== 108
    || rule.mentorEngineBuild !== 108
    || rule.adaptiveLearning !== false
    || rule.mentorEngine !== false
    || rule.aiExecution !== false
    || exists('apps/studio/src/EnvironmentDoctor.tsx')
    || exists('apps/studio/src/environment-doctor.tsx')
    || exists('apps/studio/src/Mentor.tsx')
  ) violations.push({ code: 'AG297', message: 'Build 31 crossed into Environment Doctor, AI or Mentor/Learning Mode authority.' });

  let rootPackage = null;
  let studioPackage = null;
  try { rootPackage = JSON.parse(read('package.json')); } catch {}
  try { studioPackage = JSON.parse(read('apps/studio/package.json')); } catch {}
  const identity = read('apps/studio/src/index.ts');
  const context = read('apps/studio/src/studio-context.ts');
  const vite = read('apps/studio/vite.config.ts');
  if (
    rootPackage?.version !== '0.0.31'
    || studioPackage?.version !== '0.0.31'
    || !context.includes('STUDIO_BUILD = 31')
    || !context.includes("STUDIO_VERSION = '0.0.31'")
    || !identity.includes('onboardingBuild: ONBOARDING_BUILD')
    || !identity.includes('adaptiveUserProfileSchema: ADAPTIVE_USER_PROFILE_SCHEMA')
    || !identity.includes('adaptiveProfilePersistence: false')
    || !identity.includes('adaptiveProfileSecurityAuthority: false')
    || !vite.includes("PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v31`")
    || policy.studioAuthority?.onboarding !== true
    || policy.studioAuthority?.adaptiveUserProfile !== true
    || policy.studioAuthority?.adaptiveProfilePersistence !== false
  ) violations.push({ code: 'AG298', message: 'Build 31 identity/version/PWA/Studio authority integration is inconsistent.' });

  for (const required of [
    'apps/studio/src/onboarding-profile.ts',
    'apps/studio/src/OnboardingFlow.tsx',
    'docs/architecture/ONBOARDING_ADAPTIVE_PROFILE.md',
    'docs/builds/BUILD_31_ONBOARDING.md',
    'scripts/architecture-guardian-onboarding.mjs',
    'scripts/test-build31-onboarding.mjs',
    'scripts/test-build31-onboarding-runtime.tsx',
    'scripts/test-build31-onboarding-dist.mjs',
    'scripts/test-build31-onboarding-guardian-negative.mjs',
    'scripts/tsconfig.build31-tests.json',
    '.github/workflows/build31-onboarding.yml',
  ]) if (!exists(required)) violations.push({ code: 'AG299', message: 'Required Build 31 artifact is missing.', detail: required });
}

console.log(JSON.stringify({
  ok: violations.length === 0,
  schema: 'gd-architecture-guardian-onboarding-report/1',
  currentBuild: policy.currentBuild,
  profileSchema: rule?.schema ?? null,
  conversationalOnboarding: rule?.conversationalOnboarding ?? null,
  sessionOnly: rule?.sessionOnly ?? null,
  securityAuthority: rule?.securityAuthority ?? null,
  violations,
}, null, 2));
if (violations.length) process.exit(1);
