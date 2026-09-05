import { Badge, Button, Card, SectionHeading, Stack, Status } from '@github-decrypter/ui';
import { useState } from 'react';
import {
  createAdaptiveUserProfile,
  EXPLANATION_DEPTH_OPTIONS,
  LEARNING_INTENT_OPTIONS,
  OBJECTIVE_OPTIONS,
  TECHNICAL_LEVEL_OPTIONS,
  type AdaptiveUserProfile,
  type AdaptiveUserProfileInput,
} from './onboarding-profile.js';

type StepKey = keyof AdaptiveUserProfileInput;

interface Choice {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

interface OnboardingStep {
  readonly key: StepKey;
  readonly eyebrow: string;
  readonly question: string;
  readonly helper: string;
  readonly options: readonly Choice[];
}

const ONBOARDING_STEPS: readonly OnboardingStep[] = Object.freeze([
  {
    key: 'technicalLevel',
    eyebrow: 'First, your starting point',
    question: 'How familiar are you with building software?',
    helper: 'There is no better answer. This only changes how the Studio explains things to you.',
    options: TECHNICAL_LEVEL_OPTIONS,
  },
  {
    key: 'objective',
    eyebrow: 'What you are here to build',
    question: 'What will you mainly use GitHub Decrypter for?',
    helper: 'This gives the product context about the kind of outcomes you care about.',
    options: OBJECTIVE_OPTIONS,
  },
  {
    key: 'learningIntent',
    eyebrow: 'Learning is optional',
    question: 'How much do you want to learn while we build?',
    helper: 'You can focus entirely on shipping, learn along the way, or use the project as a deeper learning experience.',
    options: LEARNING_INTENT_OPTIONS,
  },
  {
    key: 'explanationDepth',
    eyebrow: 'How we should communicate',
    question: 'How detailed should explanations usually be?',
    helper: 'This affects presentation only. It never changes what the system is allowed to do.',
    options: EXPLANATION_DEPTH_OPTIONS,
  },
]);

export interface OnboardingFlowProps {
  readonly onComplete: (profile: AdaptiveUserProfile) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<AdaptiveUserProfileInput>>({});
  const step = ONBOARDING_STEPS[stepIndex]!;
  const selectedValue = answers[step.key];

  function choose(value: string) {
    const nextAnswers = { ...answers, [step.key]: value } as Partial<AdaptiveUserProfileInput>;
    setAnswers(nextAnswers);

    if (stepIndex === ONBOARDING_STEPS.length - 1) {
      onComplete(createAdaptiveUserProfile(nextAnswers as AdaptiveUserProfileInput));
      return;
    }

    setStepIndex((current) => current + 1);
  }

  return (
    <Card className="studio-onboarding" role="region" aria-labelledby="onboarding-question">
      <Stack gap="lg">
        <div className="studio-onboarding-progress" aria-live="polite">
          <Badge tone="accent">Onboarding · {stepIndex + 1}/{ONBOARDING_STEPS.length}</Badge>
          <span>Adaptive User Profile · session foundation</span>
        </div>

        <SectionHeading eyebrow={step.eyebrow}>
          <h1 id="onboarding-question">{step.question}</h1>
        </SectionHeading>

        <p className="studio-onboarding-helper">{step.helper}</p>

        <div className="studio-onboarding-options" role="list" aria-label={step.question}>
          {step.options.map((option) => (
            <button
              className="studio-onboarding-option"
              data-selected={selectedValue === option.value ? 'true' : 'false'}
              key={option.value}
              type="button"
              role="listitem"
              onClick={() => choose(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>

        <div className="studio-onboarding-footer">
          <Status tone="neutral" label="No permissions are derived from these answers" />
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={() => setStepIndex((current) => current - 1)}>
              Back
            </Button>
          ) : null}
        </div>
      </Stack>
    </Card>
  );
}
