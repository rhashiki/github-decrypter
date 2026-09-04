export const STUDIO_PWA_SERVICE_WORKER = './service-worker.js' as const;
export const STUDIO_PWA_SCOPE = './' as const;

export interface StudioPwaRegistrationResult {
  readonly supported: boolean;
  readonly registered: boolean;
}

export async function registerStudioPwa(): Promise<StudioPwaRegistrationResult> {
  if (!('serviceWorker' in navigator)) {
    return Object.freeze({ supported: false, registered: false });
  }

  try {
    await navigator.serviceWorker.register(STUDIO_PWA_SERVICE_WORKER, {
      scope: STUDIO_PWA_SCOPE,
      updateViaCache: 'none',
    });
    return Object.freeze({ supported: true, registered: true });
  } catch {
    return Object.freeze({ supported: true, registered: false });
  }
}
