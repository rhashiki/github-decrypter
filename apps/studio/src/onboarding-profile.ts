export const ONBOARDING_BUILD = 31 as const;
export const ADAPTIVE_USER_PROFILE_SCHEMA = 'gd-adaptive-user-profile/1' as const;

export const TECHNICAL_LEVEL_OPTIONS = Object.freeze([
  { value: 'none', label: 'I am starting from zero', description: 'Keep the first steps clear and avoid assuming programming knowledge.' },
  { value: 'enthusiast', label: 'I explore technology and learn by doing', description: 'Use practical explanations and introduce technical ideas when they help.' },
  { value: 'basic', label: 'I know the basics', description: 'Skip the very first concepts and explain unfamiliar implementation details.' },
  { value: 'experienced', label: 'I build software regularly', description: 'Prefer concise technical language and expose advanced details when useful.' },
  { value: 'recent-graduate', label: 'I recently graduated in a technical field', description: 'Connect theory to real project decisions without over-explaining fundamentals.' },
  { value: 'student', label: 'I am studying now', description: 'Teach through the project while keeping progress practical.' },
] as const);

export const OBJECTIVE_OPTIONS = Object.freeze([
  { value: 'personal', label: 'Personal projects', description: 'I am building for myself, experimentation or a personal goal.' },
  { value: 'company', label: 'Work at a company', description: 'I am building or maintaining software as part of my work.' },
  { value: 'business', label: 'My own business', description: 'I am creating software for a product, service or business I operate.' },
  { value: 'other', label: 'Something else', description: 'My main use does not fit the other options.' },
] as const);

export const LEARNING_INTENT_OPTIONS = Object.freeze([
  { value: 'build-only', label: 'Focus on building', description: 'Keep educational detail minimal unless I ask for it.' },
  { value: 'learn-while-building', label: 'Teach me as we build', description: 'Explain useful concepts in context without interrupting progress.' },
  { value: 'learning-focused', label: 'I want to learn deeply', description: 'Use the project as an opportunity to explain concepts and decisions in more depth.' },
] as const);

export const EXPLANATION_DEPTH_OPTIONS = Object.freeze([
  { value: 'simple', label: 'Simple and direct', description: 'Lead with plain language and only introduce implementation details when necessary.' },
  { value: 'balanced', label: 'Balanced', description: 'Mix plain-language reasoning with the technical details that matter.' },
  { value: 'technical', label: 'Technical and concise', description: 'Prefer implementation terminology, tradeoffs and precise engineering detail.' },
] as const);

type OptionValue<T extends readonly { value: string }[]> = T[number]['value'];

export type TechnicalLevel = OptionValue<typeof TECHNICAL_LEVEL_OPTIONS>;
export type UsageObjective = OptionValue<typeof OBJECTIVE_OPTIONS>;
export type LearningIntent = OptionValue<typeof LEARNING_INTENT_OPTIONS>;
export type ExplanationDepth = OptionValue<typeof EXPLANATION_DEPTH_OPTIONS>;

export interface AdaptiveUserProfileInput {
  readonly technicalLevel: TechnicalLevel;
  readonly objective: UsageObjective;
  readonly learningIntent: LearningIntent;
  readonly explanationDepth: ExplanationDepth;
}

export interface AdaptiveUserProfile extends AdaptiveUserProfileInput {
  readonly schema: typeof ADAPTIVE_USER_PROFILE_SCHEMA;
  readonly revision: 1;
}

export interface AdaptiveExperienceSummary {
  readonly headline: string;
  readonly explanationStyle: string;
  readonly learningStyle: string;
}

const technicalLevels = new Set<string>(TECHNICAL_LEVEL_OPTIONS.map((option) => option.value));
const objectives = new Set<string>(OBJECTIVE_OPTIONS.map((option) => option.value));
const learningIntents = new Set<string>(LEARNING_INTENT_OPTIONS.map((option) => option.value));
const explanationDepths = new Set<string>(EXPLANATION_DEPTH_OPTIONS.map((option) => option.value));

export function createAdaptiveUserProfile(input: AdaptiveUserProfileInput): AdaptiveUserProfile {
  if (!technicalLevels.has(input.technicalLevel)) throw new TypeError('Technical level preference is invalid.');
  if (!objectives.has(input.objective)) throw new TypeError('Usage objective preference is invalid.');
  if (!learningIntents.has(input.learningIntent)) throw new TypeError('Learning intent preference is invalid.');
  if (!explanationDepths.has(input.explanationDepth)) throw new TypeError('Explanation depth preference is invalid.');

  return Object.freeze({
    schema: ADAPTIVE_USER_PROFILE_SCHEMA,
    revision: 1,
    technicalLevel: input.technicalLevel,
    objective: input.objective,
    learningIntent: input.learningIntent,
    explanationDepth: input.explanationDepth,
  });
}

export function describeAdaptiveExperience(profile: AdaptiveUserProfile): AdaptiveExperienceSummary {
  const headline = profile.technicalLevel === 'experienced'
    ? 'Technical details can stay close to the surface.'
    : profile.technicalLevel === 'none'
      ? 'The Studio will avoid assuming programming knowledge.'
      : 'The Studio will match explanations to your current comfort level.';

  const explanationStyle = profile.explanationDepth === 'technical'
    ? 'Technical and concise'
    : profile.explanationDepth === 'simple'
      ? 'Simple and direct'
      : 'Balanced';

  const learningStyle = profile.learningIntent === 'build-only'
    ? 'Build first; explain when asked'
    : profile.learningIntent === 'learning-focused'
      ? 'Learning-focused while building'
      : 'Teach useful concepts as we build';

  return Object.freeze({ headline, explanationStyle, learningStyle });
}
