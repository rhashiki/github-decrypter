export const LOCAL_RUNTIME_STATES = [
  'idle',
  'starting',
  'running',
  'stopping',
  'stopped',
  'failed',
] as const;

export type LocalRuntimeState = (typeof LOCAL_RUNTIME_STATES)[number];

export type LocalRuntimeLifecyclePayload = {
  readonly previous: LocalRuntimeState;
  readonly current: LocalRuntimeState;
  readonly reason: string | null;
};

export type LocalRuntimeEventCatalog = {
  readonly 'gd.local.lifecycle': LocalRuntimeLifecyclePayload;
};

export function isLocalRuntimeState(value: unknown): value is LocalRuntimeState {
  return typeof value === 'string' && LOCAL_RUNTIME_STATES.includes(value as LocalRuntimeState);
}
