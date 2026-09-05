import assert from 'node:assert/strict';
import {
  ADAPTIVE_USER_PROFILE_SCHEMA,
  createAdaptiveUserProfile,
  describeAdaptiveExperience,
  EXPLANATION_DEPTH_OPTIONS,
  LEARNING_INTENT_OPTIONS,
  OBJECTIVE_OPTIONS,
  ONBOARDING_BUILD,
  TECHNICAL_LEVEL_OPTIONS,
} from '../apps/studio/src/onboarding-profile.js';

assert.equal(ONBOARDING_BUILD, 31);
assert.equal(ADAPTIVE_USER_PROFILE_SCHEMA, 'gd-adaptive-user-profile/1');
assert.equal(TECHNICAL_LEVEL_OPTIONS.length, 6);
assert.equal(OBJECTIVE_OPTIONS.length, 4);
assert.equal(LEARNING_INTENT_OPTIONS.length, 3);
assert.equal(EXPLANATION_DEPTH_OPTIONS.length, 3);

const beginner = createAdaptiveUserProfile({
  technicalLevel: 'none',
  objective: 'personal',
  learningIntent: 'learn-while-building',
  explanationDepth: 'simple',
});
assert.equal(Object.isFrozen(beginner), true);
assert.equal(beginner.schema, 'gd-adaptive-user-profile/1');
assert.equal(beginner.revision, 1);
assert.equal(beginner.technicalLevel, 'none');
const beginnerExperience = describeAdaptiveExperience(beginner);
assert.equal(beginnerExperience.headline, 'The Studio will avoid assuming programming knowledge.');
assert.equal(beginnerExperience.explanationStyle, 'Simple and direct');
assert.equal(beginnerExperience.learningStyle, 'Teach useful concepts as we build');

const experienced = createAdaptiveUserProfile({
  technicalLevel: 'experienced',
  objective: 'company',
  learningIntent: 'build-only',
  explanationDepth: 'technical',
});
const experiencedExperience = describeAdaptiveExperience(experienced);
assert.equal(experiencedExperience.headline, 'Technical details can stay close to the surface.');
assert.equal(experiencedExperience.explanationStyle, 'Technical and concise');
assert.equal(experiencedExperience.learningStyle, 'Build first; explain when asked');

const learningFocused = createAdaptiveUserProfile({
  technicalLevel: 'student',
  objective: 'business',
  learningIntent: 'learning-focused',
  explanationDepth: 'balanced',
});
const learningExperience = describeAdaptiveExperience(learningFocused);
assert.equal(learningExperience.learningStyle, 'Learning-focused while building');
assert.equal(learningExperience.explanationStyle, 'Balanced');

for (const [field, value] of [
  ['technicalLevel', 'wizard'],
  ['objective', 'unknown'],
  ['learningIntent', 'always-teach'],
  ['explanationDepth', 'infinite'],
] as const) {
  const invalid = {
    technicalLevel: 'basic',
    objective: 'business',
    learningIntent: 'learn-while-building',
    explanationDepth: 'balanced',
    [field]: value,
  };
  assert.throws(() => createAdaptiveUserProfile(invalid as never), /preference is invalid/);
}

assert.equal(Object.isFrozen(beginnerExperience), true);
assert.equal(Object.isFrozen(experiencedExperience), true);
assert.equal(Object.isFrozen(learningExperience), true);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build31-onboarding-runtime/1',
  build: ONBOARDING_BUILD,
  profileSchema: ADAPTIVE_USER_PROFILE_SCHEMA,
  technicalLevelOptions: TECHNICAL_LEVEL_OPTIONS.map((option) => option.value),
  objectiveOptions: OBJECTIVE_OPTIONS.map((option) => option.value),
  learningIntentOptions: LEARNING_INTENT_OPTIONS.map((option) => option.value),
  explanationDepthOptions: EXPLANATION_DEPTH_OPTIONS.map((option) => option.value),
  immutableProfiles: true,
  deterministicExperienceSummary: true,
  invalidPreferencesRejected: true,
  persistence: false,
  securityAuthority: false,
}, null, 2));
