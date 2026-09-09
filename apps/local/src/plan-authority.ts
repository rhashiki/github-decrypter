import { PLAN_AUTHORITY_SCHEMA, PLAN_MODE, type PlanAuthorityRecord } from '@github-decrypter/plan/authority';
import { CAPABILITIES, type Capability, type CapabilityRequirement } from './capability-security.js';

export const PLAN_RUNTIME_AUTHORITY_BUILD = 48 as const;
export const PLAN_RUNTIME_GUARD_SCHEMA = 'gd-plan-runtime-guard/1' as const;
export const PLAN_MUTATING_CAPABILITIES = Object.freeze([
  'WRITE',
  'EXECUTE',
  'DATABASE_WRITE',
  'GIT_WRITE',
  'DESTRUCTIVE',
] as const satisfies readonly Capability[]);

export interface PlanRuntimeGuardInput {
  readonly plan: PlanAuthorityRecord;
  readonly requirements: readonly CapabilityRequirement[];
}

export interface PlanRuntimeGuardDecision {
  readonly schema: typeof PLAN_RUNTIME_GUARD_SCHEMA;
  readonly mode: typeof PLAN_MODE;
  readonly planId: string;
  readonly readOnly: true;
  readonly allowed: boolean;
  readonly blockedCapabilities: readonly Capability[];
  readonly buildTransitionAuthorized: false;
  readonly toolExecutionAuthorized: false;
}

function assertPlan(value: unknown): asserts value is PlanAuthorityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('PLAN runtime guard requires a Plan Authority record.');
  const row = value as Record<string, unknown>;
  if (row.schema !== PLAN_AUTHORITY_SCHEMA || row.mode !== PLAN_MODE || row.readOnly !== true
      || row.runtimeReadOnlyRequired !== true || row.planAuthority !== true
      || row.buildTransitionAuthorized !== false || row.toolExecution !== false || row.execution !== false) {
    throw new TypeError('PLAN runtime guard requires a canonical read-only Plan Authority record.');
  }
  if (typeof row.id !== 'string' || !/^plan-[0-9a-f]{16}$/.test(row.id)) {
    throw new TypeError('PLAN runtime guard plan identity is invalid.');
  }
}

function assertRequirement(value: unknown, index: number): asserts value is CapabilityRequirement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`PLAN runtime capability requirement ${index + 1} is invalid.`);
  const row = value as Record<string, unknown>;
  if (typeof row.capability !== 'string' || !(CAPABILITIES as readonly string[]).includes(row.capability)
      || typeof row.resource !== 'string' || !row.resource.startsWith('gd://')) {
    throw new TypeError(`PLAN runtime capability requirement ${index + 1} is invalid.`);
  }
}

function asInput(value: unknown): PlanRuntimeGuardInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('PLAN runtime guard input must be an object.');
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 2 || keys[0] !== 'plan' || keys[1] !== 'requirements') {
    throw new TypeError('PLAN runtime guard input accepts only plan and requirements fields in canonical order.');
  }
  assertPlan(row.plan);
  if (!Array.isArray(row.requirements)) throw new TypeError('PLAN runtime guard requirements must be an array.');
  row.requirements.forEach((requirement, index) => assertRequirement(requirement, index));
  return { plan: row.plan, requirements: row.requirements };
}

export function evaluatePlanReadOnly(input: PlanRuntimeGuardInput): PlanRuntimeGuardDecision {
  const { plan, requirements } = asInput(input);
  const blocked = Object.freeze([
    ...new Set(
      requirements
        .map((requirement) => requirement.capability)
        .filter((capability): capability is Capability => (PLAN_MUTATING_CAPABILITIES as readonly Capability[]).includes(capability)),
    ),
  ]);
  return Object.freeze({
    schema: PLAN_RUNTIME_GUARD_SCHEMA,
    mode: PLAN_MODE,
    planId: plan.id,
    readOnly: true,
    allowed: blocked.length === 0,
    blockedCapabilities: blocked,
    buildTransitionAuthorized: false,
    toolExecutionAuthorized: false,
  });
}

export function assertPlanReadOnly(input: PlanRuntimeGuardInput): PlanRuntimeGuardDecision {
  const decision = evaluatePlanReadOnly(input);
  if (!decision.allowed) {
    throw new Error(`PLAN is read-only; blocked capabilities: ${decision.blockedCapabilities.join(', ')}.`);
  }
  return decision;
}
