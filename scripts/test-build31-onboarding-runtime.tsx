import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingFlow } from '../apps/studio/src/OnboardingFlow.js';
import {
  ADAPTIVE_USER_PROFILE_SCHEMA,
  createAdaptiveUserProfile,
  describeAdaptiveExperience,
  ONBOARDING_BUILD,
} from '../apps/studio/src/onboarding-profile.js';

assert.equal(ONBOARDING_BUILD, 31);
assert.equal(ADAPTIVE_USER_PROFILE_SCHEMA, 'gd-adaptive-user-profile/1');

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

let completed = false;
const markup = renderToStaticMarkup(<OnboardingFlow onComplete={() => { completed = true; }} />);
assert.equal(completed, false, 'Static rendering must not complete onboarding or create side effects.');
assert.match(markup, /Onboarding/);
assert.match(markup, /How familiar are you with building software\?/);
assert.match(markup, /I am starting from zero/);
assert.match(markup, /I build software regularly/);
assert.match(markup, /No permissions are derived from these answers/);
assert.doesNotMatch(markup, /API key|capability grant|Scope Lock|database migration/i);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build31-onboarding-runtime/1',
  build: ONBOARDING_BUILD,
  profileSchema: ADAPTIVE_USER_PROFILE_SCHEMA,
  immutableProfile: true,
  beginnerExperience: beginnerExperience,
  experiencedExperience: experiencedExperience,
  staticRenderSideEffects: false,
  persistence: false,
  securityAuthority: false,
}, null, 2));
