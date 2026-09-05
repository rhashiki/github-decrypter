import {
  assertEnvironmentDoctorReport,
  type EnvironmentDoctorReport,
} from '@github-decrypter/protocol';

export const ENVIRONMENT_DOCTOR_ENDPOINT = 'http://127.0.0.1:43110/v1/environment-doctor' as const;
export const ENVIRONMENT_DOCTOR_TIMEOUT_MS = 3000 as const;

export interface EnvironmentDoctorClientOptions {
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

export async function requestEnvironmentDoctorReport(
  options: EnvironmentDoctorClientOptions = {},
): Promise<EnvironmentDoctorReport> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? ENVIRONMENT_DOCTOR_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => controller.abort('Environment Doctor request timed out.'), timeoutMs);
  const forwardAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const init: LoopbackRequestInit = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      targetAddressSpace: 'loopback',
      headers: { accept: 'application/json' },
    };
    const response = options.fetchImpl
      ? await options.fetchImpl(ENVIRONMENT_DOCTOR_ENDPOINT, init)
      : await defaultLoopbackFetch(ENVIRONMENT_DOCTOR_ENDPOINT, init);
    if (!response.ok) throw new Error(`Local Runtime returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    assertEnvironmentDoctorReport(payload);
    return payload;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}
