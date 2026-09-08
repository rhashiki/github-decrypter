import type { DurableJobEngine } from './job-engine.js';
import {
  asDurableJobId,
  type DurableJobId,
  type DurableJobRecord,
  type DurableJobState,
  type DurableJobTransition,
} from './job-types.js';

export const JOBS_CENTER_BUILD = 47 as const;
export const JOBS_CENTER_JOB_SCHEMA = 'gd-jobs-center-job/1' as const;
export const JOBS_CENTER_LIST_SCHEMA = 'gd-jobs-center-list/1' as const;
export const JOBS_CENTER_DETAIL_SCHEMA = 'gd-jobs-center-detail/1' as const;
export const JOBS_CENTER_CONTROL_SCHEMA = 'gd-jobs-center-control/1' as const;
export const JOBS_CENTER_ACTIONS = ['pause', 'resume', 'cancel', 'retry'] as const;

export type JobsCenterAction = (typeof JOBS_CENTER_ACTIONS)[number];

export interface JobsCenterJobView {
  readonly schema: typeof JOBS_CENTER_JOB_SCHEMA;
  readonly id: DurableJobId;
  readonly kind: string;
  readonly state: DurableJobState;
  readonly priority: number;
  readonly queueOrder: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly pauseRequested: boolean;
  readonly cancelRequested: boolean;
  readonly workerAssigned: boolean;
  readonly hasCheckpoint: boolean;
  readonly hasResult: boolean;
  readonly hasError: boolean;
  readonly allowedActions: readonly JobsCenterAction[];
}

export interface JobsCenterTransitionView {
  readonly id: number;
  readonly fromState: DurableJobState | null;
  readonly toState: DurableJobState;
  readonly occurredAt: string;
}

export interface JobsCenterListView {
  readonly schema: typeof JOBS_CENTER_LIST_SCHEMA;
  readonly jobs: readonly JobsCenterJobView[];
  readonly total: number;
  readonly nonTerminal: number;
  readonly expiredLeases: number;
  readonly counts: Readonly<Record<DurableJobState, number>>;
  readonly payloadExposed: false;
  readonly leaseTokenExposed: false;
}

export interface JobsCenterDetailView {
  readonly schema: typeof JOBS_CENTER_DETAIL_SCHEMA;
  readonly job: JobsCenterJobView;
  readonly dependencies: readonly DurableJobId[];
  readonly transitions: readonly JobsCenterTransitionView[];
  readonly payloadExposed: false;
  readonly checkpointContentExposed: false;
  readonly resultContentExposed: false;
  readonly errorContentExposed: false;
  readonly workerIdentityExposed: false;
  readonly leaseTokenExposed: false;
}

export interface JobsCenterControlInput {
  readonly jobId: string;
  readonly action: JobsCenterAction;
}

export interface JobsCenterControlResult {
  readonly schema: typeof JOBS_CENTER_CONTROL_SCHEMA;
  readonly action: JobsCenterAction;
  readonly job: JobsCenterJobView;
}

export interface JobsCenterOptions {
  readonly jobs: DurableJobEngine;
}

function allowedActions(job: DurableJobRecord): readonly JobsCenterAction[] {
  const actions: JobsCenterAction[] = [];
  if (job.state === 'queued' || job.state === 'running') {
    actions.push('pause', 'cancel');
  } else if (job.state === 'checkpointed' || job.state === 'waiting' || job.state === 'paused') {
    actions.push('resume', 'cancel');
  } else if (job.state === 'failed' && job.attemptCount < job.maxAttempts) {
    actions.push('retry');
  }
  return Object.freeze(actions);
}

function projectJob(job: DurableJobRecord): JobsCenterJobView {
  return Object.freeze({
    schema: JOBS_CENTER_JOB_SCHEMA,
    id: job.id,
    kind: job.kind,
    state: job.state,
    priority: job.priority,
    queueOrder: job.queueOrder,
    availableAt: job.availableAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    pauseRequested: job.pauseRequested,
    cancelRequested: job.cancelRequested,
    workerAssigned: job.workerId !== null,
    hasCheckpoint: job.checkpoint !== null,
    hasResult: job.result !== null,
    hasError: job.error !== null,
    allowedActions: allowedActions(job),
  });
}

function projectTransition(transition: DurableJobTransition): JobsCenterTransitionView {
  return Object.freeze({
    id: transition.id,
    fromState: transition.fromState,
    toState: transition.toState,
    occurredAt: transition.occurredAt,
  });
}

export class JobsCenter {
  readonly #jobs: DurableJobEngine;

  constructor(options: JobsCenterOptions) {
    this.#jobs = options.jobs;
  }

  list(): JobsCenterListView {
    const summary = this.#jobs.summary();
    const jobs = Object.freeze(this.#jobs.listJobs().map(projectJob));
    return Object.freeze({
      schema: JOBS_CENTER_LIST_SCHEMA,
      jobs,
      total: summary.total,
      nonTerminal: summary.nonTerminal,
      expiredLeases: summary.expiredLeases,
      counts: Object.freeze({ ...summary.counts }),
      payloadExposed: false,
      leaseTokenExposed: false,
    });
  }

  get(jobId: string): JobsCenterDetailView | undefined {
    const id = asDurableJobId(jobId);
    const job = this.#jobs.getJob(id);
    if (!job) return undefined;
    return Object.freeze({
      schema: JOBS_CENTER_DETAIL_SCHEMA,
      job: projectJob(job),
      dependencies: Object.freeze([...this.#jobs.listDependencies(id)]),
      transitions: Object.freeze(this.#jobs.listTransitions(id).map(projectTransition)),
      payloadExposed: false,
      checkpointContentExposed: false,
      resultContentExposed: false,
      errorContentExposed: false,
      workerIdentityExposed: false,
      leaseTokenExposed: false,
    });
  }

  async control(input: JobsCenterControlInput): Promise<JobsCenterControlResult> {
    if (!input || typeof input !== 'object') throw new TypeError('Jobs Center control input must be an object.');
    if (!JOBS_CENTER_ACTIONS.includes(input.action)) throw new TypeError('Jobs Center action is not allowed.');
    const id = asDurableJobId(input.jobId);
    const current = this.#jobs.getJob(id);
    if (!current) throw new Error(`Durable job not found: ${id}`);
    if (!allowedActions(current).includes(input.action)) {
      throw new Error(`Jobs Center action ${input.action} is not allowed from state ${current.state}.`);
    }

    let next: DurableJobRecord;
    switch (input.action) {
      case 'pause':
        next = await this.#jobs.requestPause(id, 'Jobs Center pause requested by user');
        break;
      case 'resume':
        next = await this.#jobs.resume(id, undefined, 'Jobs Center resume requested by user');
        break;
      case 'cancel':
        next = await this.#jobs.requestCancel(id, 'Jobs Center cancel requested by user');
        break;
      case 'retry':
        next = await this.#jobs.retry(id, undefined, 'Jobs Center retry requested by user');
        break;
    }

    return Object.freeze({
      schema: JOBS_CENTER_CONTROL_SCHEMA,
      action: input.action,
      job: projectJob(next),
    });
  }
}

export function createJobsCenter(options: JobsCenterOptions): JobsCenter {
  return new JobsCenter(options);
}
