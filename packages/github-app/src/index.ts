export const GITHUB_APP_SCHEMA = 'gd-github-app/1' as const;
export const GITHUB_APP_JWT_ALGORITHM = 'RS256' as const;
export const GITHUB_APP_JWT_MAX_TTL_SECONDS = 600 as const;
export const GITHUB_INSTALLATION_TOKEN_MAX_TTL_SECONDS = 3600 as const;
export const GITHUB_WEBHOOK_SIGNATURE_ALGORITHM = 'sha256' as const;
export const GITHUB_WEBHOOK_SIGNATURE_HEADER = 'x-hub-signature-256' as const;
export const GITHUB_WEBHOOK_DELIVERY_HEADER = 'x-github-delivery' as const;
export const GITHUB_WEBHOOK_EVENT_HEADER = 'x-github-event' as const;

export type GitHubInstallationState = 'active' | 'suspended';
export type GitHubRepositorySelection = 'all' | 'selected';

export interface GitHubAppConfigurationRecord {
  readonly schema: typeof GITHUB_APP_SCHEMA;
  readonly appId: string;
  readonly apiBaseUrl: string;
  readonly configuredAt: string;
  readonly updatedAt: string;
}

export interface GitHubAppInstallationRecord {
  readonly installationId: number;
  readonly accountLogin: string | null;
  readonly accountType: string | null;
  readonly repositorySelection: GitHubRepositorySelection | null;
  readonly state: GitHubInstallationState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly suspendedAt: string | null;
}

export interface GitHubAppJwt {
  readonly token: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly algorithm: typeof GITHUB_APP_JWT_ALGORITHM;
  readonly persistable: false;
}

export interface GitHubInstallationAccessToken {
  readonly installationId: number;
  readonly token: string;
  readonly expiresAt: string;
  readonly persistable: false;
}

export interface GitHubWebhookVerification {
  readonly valid: boolean;
  readonly duplicate: boolean;
  readonly deliveryId: string;
  readonly event: string;
  readonly algorithm: typeof GITHUB_WEBHOOK_SIGNATURE_ALGORITHM;
  readonly verifiedAt: string;
  readonly payloadPersistence: false;
}

export function normalizeGitHubAppId(value: string | number): string {
  const normalized = String(value).trim();
  if (!/^[1-9]\d*$/.test(normalized)) throw new TypeError('GitHub App ID must be a positive integer.');
  return normalized;
}

export function normalizeGitHubInstallationId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('GitHub installation ID must be a positive safe integer.');
  return value;
}

export function normalizeGitHubWebhookDeliveryId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /\s/.test(normalized)) {
    throw new TypeError('GitHub webhook delivery ID must be non-empty, whitespace-free and at most 200 characters.');
  }
  return normalized;
}

export function normalizeGitHubWebhookEvent(value: string): string {
  const normalized = value.trim();
  if (!/^[a-z0-9_]{1,100}$/i.test(normalized)) throw new TypeError('GitHub webhook event name is invalid.');
  return normalized;
}
