import {
  assertJobsCenterControlResult,
  assertJobsCenterDetailView,
  assertJobsCenterListView,
  type JobsCenterAction,
  type JobsCenterControlResult,
  type JobsCenterDetailView,
  type JobsCenterListView,
} from '@github-decrypter/protocol';

export const JOBS_CENTER_ENDPOINT = 'http://127.0.0.1:43110/v1/jobs' as const;
export const JOBS_CENTER_CLIENT_ID = 'gd-studio-jobs-center/1' as const;
export const JOBS_CENTER_TIMEOUT_MS = 3000 as const;

export interface JobsCenterClientOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

type LoopbackRequestInit = RequestInit & {
  readonly targetAddressSpace?: 'loopback';
};

async function defaultLoopbackFetch(input: RequestInfo | URL, init: LoopbackRequestInit): Promise<Response> {
  return fetch(input, init);
}

async function requestJson(
  endpoint: string,
  init: LoopbackRequestInit,
  options: JobsCenterClientOptions,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? JOBS_CENTER_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => controller.abort('Jobs Center request timed out.'), timeoutMs);
  const forwardAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const requestInit: LoopbackRequestInit = {
      ...init,
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      targetAddressSpace: 'loopback',
      headers: {
        accept: 'application/json',
        'x-github-decrypter-client': JOBS_CENTER_CLIENT_ID,
        ...init.headers,
      },
    };
    const response = options.fetchImpl
      ? await options.fetchImpl(endpoint, requestInit)
      : await defaultLoopbackFetch(endpoint, requestInit);
    if (!response.ok) {
      let message = `Local Runtime returned HTTP ${response.status}.`;
      try {
        const payload = await response.json() as { error?: { message?: unknown } };
        if (typeof payload?.error?.message === 'string') message = payload.error.message;
      } catch {
        // Preserve the HTTP status message when no canonical JSON error is available.
      }
      throw new Error(message);
    }
    return response.json() as Promise<unknown>;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function requestJobsCenterList(options: JobsCenterClientOptions = {}): Promise<JobsCenterListView> {
  const payload = await requestJson(JOBS_CENTER_ENDPOINT, { method: 'GET' }, options);
  assertJobsCenterListView(payload);
  return payload;
}

export async function requestJobsCenterDetail(
  jobId: string,
  options: JobsCenterClientOptions = {},
): Promise<JobsCenterDetailView> {
  const payload = await requestJson(`${JOBS_CENTER_ENDPOINT}/${encodeURIComponent(jobId)}`, { method: 'GET' }, options);
  assertJobsCenterDetailView(payload);
  return payload;
}

export async function requestJobsCenterControl(
  jobId: string,
  action: JobsCenterAction,
  options: JobsCenterClientOptions = {},
): Promise<JobsCenterControlResult> {
  const payload = await requestJson(
    `${JOBS_CENTER_ENDPOINT}/${encodeURIComponent(jobId)}/control`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    },
    options,
  );
  assertJobsCenterControlResult(payload);
  return payload;
}
