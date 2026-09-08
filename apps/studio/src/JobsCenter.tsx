import { Badge, Button, Card, SectionHeading, Stack, Status } from '@github-decrypter/ui';
import type {
  JobsCenterAction,
  JobsCenterDetailView,
  JobsCenterJobView,
  JobsCenterListView,
  JobsCenterState,
} from '@github-decrypter/protocol';
import { useEffect, useState } from 'react';
import {
  requestJobsCenterControl,
  requestJobsCenterDetail,
  requestJobsCenterList,
} from './jobs-center-client.js';

const STATE_LABELS: Readonly<Record<JobsCenterState, string>> = Object.freeze({
  queued: 'Queued',
  running: 'Running',
  checkpointed: 'Checkpointed',
  waiting: 'Waiting',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
});

const ACTION_LABELS: Readonly<Record<JobsCenterAction, string>> = Object.freeze({
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel',
  retry: 'Retry',
});

function jobStatus(job: JobsCenterJobView): string {
  if (job.pauseRequested) return 'Pause requested';
  if (job.cancelRequested) return 'Cancel requested';
  return STATE_LABELS[job.state];
}

export function JobsCenter() {
  const [list, setList] = useState<JobsCenterListView | null>(null);
  const [detail, setDetail] = useState<JobsCenterDetailView | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<JobsCenterAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(selectedJobId = detail?.job.id): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const nextList = await requestJobsCenterList();
      setList(nextList);
      if (selectedJobId && nextList.jobs.some((job) => job.id === selectedJobId)) {
        setDetail(await requestJobsCenterDetail(selectedJobId));
      } else {
        setDetail(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Jobs Center could not reach the Local Runtime.');
    } finally {
      setLoading(false);
    }
  }

  async function selectJob(jobId: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setDetail(await requestJobsCenterDetail(jobId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Job detail is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  async function control(action: JobsCenterAction): Promise<void> {
    if (!detail) return;
    setActing(action);
    setError(null);
    try {
      await requestJobsCenterControl(detail.job.id, action);
      await refresh(detail.job.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Job control was rejected.');
    } finally {
      setActing(null);
    }
  }

  useEffect(() => {
    void refresh(undefined);
    // The surface mounts only after an explicit Jobs Center navigation action.
    // No interval or background polling is installed.
  }, []);

  return (
    <section className="studio-jobs-center" aria-labelledby="jobs-center-title">
      <Stack gap="lg">
        <div className="studio-jobs-header">
          <SectionHeading eyebrow="Build 47 · Local Runtime">
            <h1 id="jobs-center-title">Jobs Center</h1>
          </SectionHeading>
          <Button variant="ghost" disabled={loading || acting !== null} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        <p>
          Inspect the durable local queue and request safe lifecycle controls. Job payloads, lease tokens,
          worker identities and raw checkpoint/result/error content are not exposed to the Studio.
        </p>

        {error ? <Status tone="warning" label={error} /> : null}

        <div className="studio-jobs-summary" aria-label="Jobs summary">
          <Card><span>Total</span><strong>{list?.total ?? '—'}</strong></Card>
          <Card><span>Active</span><strong>{list?.nonTerminal ?? '—'}</strong></Card>
          <Card><span>Running</span><strong>{list?.counts.running ?? '—'}</strong></Card>
          <Card><span>Failed</span><strong>{list?.counts.failed ?? '—'}</strong></Card>
        </div>

        <div className="studio-jobs-layout">
          <Card className="studio-jobs-list" role="region" aria-label="Durable jobs">
            <div className="studio-jobs-section-heading">
              <strong>Queue</strong>
              <Badge>{list ? `${list.jobs.length} jobs` : 'Loading'}</Badge>
            </div>
            {list?.jobs.length === 0 ? <p className="studio-jobs-empty">No durable jobs yet.</p> : null}
            {list?.jobs.map((job) => (
              <button
                type="button"
                className={`studio-job-row${detail?.job.id === job.id ? ' is-selected' : ''}`}
                key={job.id}
                onClick={() => void selectJob(job.id)}
              >
                <span className="studio-job-row-main">
                  <strong>{job.kind}</strong>
                  <span>{job.id}</span>
                </span>
                <span className={`studio-job-state state-${job.state}`}>{jobStatus(job)}</span>
              </button>
            ))}
          </Card>

          <Card className="studio-job-detail" role="region" aria-label="Selected job detail">
            {!detail ? (
              <div className="studio-jobs-empty">
                <strong>Select a job</strong>
                <span>State transitions and allowed controls will appear here.</span>
              </div>
            ) : (
              <Stack gap="md">
                <div className="studio-jobs-section-heading">
                  <div>
                    <strong>{detail.job.kind}</strong>
                    <span>{detail.job.id}</span>
                  </div>
                  <Badge>{jobStatus(detail.job)}</Badge>
                </div>

                <dl className="studio-job-metadata">
                  <div><dt>Attempts</dt><dd>{detail.job.attemptCount} / {detail.job.maxAttempts}</dd></div>
                  <div><dt>Priority</dt><dd>{detail.job.priority}</dd></div>
                  <div><dt>Queue order</dt><dd>{detail.job.queueOrder}</dd></div>
                  <div><dt>Worker</dt><dd>{detail.job.workerAssigned ? 'Assigned' : 'Not assigned'}</dd></div>
                  <div><dt>Checkpoint</dt><dd>{detail.job.hasCheckpoint ? 'Available' : 'None'}</dd></div>
                  <div><dt>Error</dt><dd>{detail.job.hasError ? 'Recorded' : 'None'}</dd></div>
                </dl>

                <div className="studio-job-actions" aria-label="Allowed job controls">
                  {detail.job.allowedActions.length === 0 ? <span>No lifecycle controls available.</span> : null}
                  {detail.job.allowedActions.map((action) => (
                    <Button
                      key={action}
                      variant={action === 'cancel' ? 'ghost' : 'secondary'}
                      disabled={acting !== null}
                      onClick={() => void control(action)}
                    >
                      {acting === action ? `${ACTION_LABELS[action]}…` : ACTION_LABELS[action]}
                    </Button>
                  ))}
                </div>

                <div className="studio-job-transitions">
                  <strong>State history</strong>
                  {detail.transitions.map((transition) => (
                    <div key={transition.id}>
                      <span>{transition.fromState ?? 'created'} → {transition.toState}</span>
                      <time dateTime={transition.occurredAt}>{new Date(transition.occurredAt).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              </Stack>
            )}
          </Card>
        </div>
      </Stack>
    </section>
  );
}
