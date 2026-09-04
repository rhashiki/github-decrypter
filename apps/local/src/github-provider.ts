import type { EventBus } from '@github-decrypter/shared';
import { normalizeGitHubInstallationId } from '@github-decrypter/github-app';
import {
  GITHUB_PROVIDER_OPERATIONS,
  GITHUB_PROVIDER_SCHEMA,
  normalizeGitHubBranchName,
  normalizeGitHubOwner,
  normalizeGitHubProviderPage,
  normalizeGitHubProviderPerPage,
  normalizeGitHubRepositoryName,
  type GitHubBranchesPage,
  type GitHubBranchSummary,
  type GitHubProviderOperation,
  type GitHubRepositoriesPage,
  type GitHubRepositoryIdentity,
  type GitHubRepositoryResult,
  type GitHubRepositorySummary,
} from '@github-decrypter/github-provider';
import type { CapabilitySecurityAuthority, CapabilityToken } from './capability-security.js';
import {
  GITHUB_API_BASE_URL,
  GITHUB_API_VERSION,
  type GitHubAppRuntime,
} from './github-app-runtime.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { OfflineExecutionCoordinator } from './offline-execution.js';

export const GITHUB_PROVIDER_INSTALLATIONS_RESOURCE = 'gd://github-provider/installations' as const;

export interface GitHubProviderStatus {
  readonly ready: boolean;
  readonly configured: boolean;
  readonly apiBaseUrl: typeof GITHUB_API_BASE_URL;
  readonly apiVersion: typeof GITHUB_API_VERSION;
  readonly operations: readonly GitHubProviderOperation[];
  readonly readOnly: true;
  readonly installationScoped: true;
  readonly installationTokenPersistence: false;
  readonly responsePersistence: false;
  readonly genericRequestApi: false;
  readonly collaborationMutation: false;
}

export interface GitHubProviderAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
  readonly installationId: number;
}

export interface ListGitHubRepositoriesRequest extends GitHubProviderAuthorization {
  readonly page?: number;
  readonly perPage?: number;
}

export interface GetGitHubRepositoryRequest extends GitHubProviderAuthorization {
  readonly owner: string;
  readonly repo: string;
}

export interface ListGitHubBranchesRequest extends GetGitHubRepositoryRequest {
  readonly page?: number;
  readonly perPage?: number;
}

export interface GitHubProviderOptions {
  readonly capabilities: CapabilitySecurityAuthority;
  readonly offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly githubApp: GitHubAppRuntime;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`GitHub returned invalid ${label}.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`GitHub returned invalid ${label}.`);
  return value;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || Number(normalized) < 0) throw new Error(`GitHub returned invalid ${label}.`);
  return normalized as number;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`GitHub returned invalid ${label}.`);
  return value;
}

function isoOrNull(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = text(value, label);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`GitHub returned invalid ${label}.`);
  return new Date(parsed).toISOString();
}

function trustedRepositoryUrl(value: unknown, label: string): string {
  const raw = text(value, label);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`GitHub returned invalid ${label}.`); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password) {
    throw new Error(`GitHub returned untrusted ${label}.`);
  }
  return parsed.toString();
}

function repositoryIdentity(owner: string, name: string): GitHubRepositoryIdentity {
  const normalizedOwner = normalizeGitHubOwner(owner);
  const normalizedName = normalizeGitHubRepositoryName(name);
  return Object.freeze({
    owner: normalizedOwner,
    name: normalizedName,
    fullName: `${normalizedOwner}/${normalizedName}`,
  });
}

function repositoryFromApi(value: unknown): GitHubRepositorySummary {
  const row = asRecord(value, 'repository payload');
  const ownerRow = asRecord(row.owner, 'repository owner');
  const identity = repositoryIdentity(text(ownerRow.login, 'repository owner login'), text(row.name, 'repository name'));
  const fullName = text(row.full_name, 'repository full_name');
  if (fullName.toLowerCase() !== identity.fullName.toLowerCase()) throw new Error('GitHub repository identity is inconsistent.');
  const defaultBranchValue = row.default_branch;
  const defaultBranch = defaultBranchValue === null || defaultBranchValue === undefined || defaultBranchValue === ''
    ? null
    : normalizeGitHubBranchName(text(defaultBranchValue, 'repository default_branch'));
  return Object.freeze({
    ...identity,
    id: integer(row.id, 'repository id'),
    nodeId: text(row.node_id, 'repository node_id'),
    private: bool(row.private, 'repository private flag'),
    fork: bool(row.fork, 'repository fork flag'),
    archived: bool(row.archived, 'repository archived flag'),
    disabled: bool(row.disabled, 'repository disabled flag'),
    defaultBranch,
    htmlUrl: trustedRepositoryUrl(row.html_url, 'repository html_url'),
    cloneUrl: trustedRepositoryUrl(row.clone_url, 'repository clone_url'),
    updatedAt: isoOrNull(row.updated_at, 'repository updated_at'),
  });
}

function branchFromApi(value: unknown): GitHubBranchSummary {
  const row = asRecord(value, 'branch payload');
  const commit = asRecord(row.commit, 'branch commit');
  const sha = text(commit.sha, 'branch commit sha');
  if (!/^[a-f0-9]{40,64}$/i.test(sha)) throw new Error('GitHub returned invalid branch commit sha.');
  return Object.freeze({
    name: normalizeGitHubBranchName(text(row.name, 'branch name')),
    commitSha: sha.toLowerCase(),
    protected: bool(row.protected, 'branch protected flag'),
  });
}

function providerInstallationResource(installationId: number): string {
  return `${GITHUB_PROVIDER_INSTALLATIONS_RESOURCE}/${installationId}`;
}

function providerRepositoriesResource(installationId: number): string {
  return `${providerInstallationResource(installationId)}/repositories`;
}

function providerRepositoryResource(installationId: number, owner: string, repo: string): string {
  return `${providerRepositoriesResource(installationId)}/${owner}/${repo}`;
}

export class GitHubProvider {
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly #githubApp: GitHubAppRuntime;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #fetch: typeof fetch;
  readonly #now: () => string;
  #ready = false;

  constructor(options: GitHubProviderOptions) {
    this.#capabilities = options.capabilities;
    this.#offline = options.offline;
    this.#githubApp = options.githubApp;
    this.#eventBus = options.eventBus;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): GitHubProviderStatus {
    return Object.freeze({
      ready: this.#ready,
      configured: this.#githubApp.status().configured,
      apiBaseUrl: GITHUB_API_BASE_URL,
      apiVersion: GITHUB_API_VERSION,
      operations: Object.freeze([...GITHUB_PROVIDER_OPERATIONS]),
      readOnly: true,
      installationScoped: true,
      installationTokenPersistence: false,
      responsePersistence: false,
      genericRequestApi: false,
      collaborationMutation: false,
    });
  }

  async initialize(): Promise<GitHubProviderStatus> {
    if (!this.#capabilities.status().ready) throw new Error('GitHub Provider requires Capability Security to be ready.');
    if (!this.#offline.status().ready) throw new Error('GitHub Provider requires Offline Execution to be ready.');
    if (!this.#githubApp.status().ready) throw new Error('GitHub Provider requires GitHub App Runtime to be ready.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.github-provider.ready', {
      configured: status.configured,
      operations: [...status.operations],
      readOnly: true,
      installationTokenPersistence: false,
      responsePersistence: false,
      genericRequestApi: false,
    });
    return status;
  }

  async listRepositories(request: ListGitHubRepositoriesRequest): Promise<GitHubRepositoriesPage> {
    this.#assertReady();
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const page = normalizeGitHubProviderPage(request.page);
    const perPage = normalizeGitHubProviderPerPage(request.perPage);
    const resource = providerRepositoriesResource(installationId);
    const installationToken = await this.#authorizeAndCreateInstallationToken(request, resource);
    const body = asRecord(await this.#getJson(
      `/installation/repositories?per_page=${perPage}&page=${page}`,
      installationToken,
    ), 'installation repositories response');
    const rows = body.repositories;
    if (!Array.isArray(rows)) throw new Error('GitHub returned invalid installation repositories list.');
    const repositories = Object.freeze(rows.map(repositoryFromApi));
    const totalCount = integer(body.total_count, 'installation repositories total_count');
    const result = Object.freeze({
      schema: GITHUB_PROVIDER_SCHEMA,
      installationId,
      page,
      perPage,
      totalCount,
      hasMore: (page - 1) * perPage + repositories.length < totalCount,
      repositories,
    });
    await this.#publishOperation('repositories.list', installationId, 'success', repositories.length);
    return result;
  }

  async getRepository(request: GetGitHubRepositoryRequest): Promise<GitHubRepositoryResult> {
    this.#assertReady();
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const owner = normalizeGitHubOwner(request.owner);
    const repo = normalizeGitHubRepositoryName(request.repo);
    const resource = providerRepositoryResource(installationId, owner, repo);
    const installationToken = await this.#authorizeAndCreateInstallationToken(request, resource);
    const repository = repositoryFromApi(await this.#getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      installationToken,
    ));
    if (repository.owner.toLowerCase() !== owner.toLowerCase() || repository.name.toLowerCase() !== repo.toLowerCase()) {
      throw new Error('GitHub returned a repository other than the authorized target.');
    }
    await this.#publishOperation('repository.get', installationId, 'success', 1);
    return Object.freeze({ schema: GITHUB_PROVIDER_SCHEMA, installationId, repository });
  }

  async listBranches(request: ListGitHubBranchesRequest): Promise<GitHubBranchesPage> {
    this.#assertReady();
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const owner = normalizeGitHubOwner(request.owner);
    const repo = normalizeGitHubRepositoryName(request.repo);
    const page = normalizeGitHubProviderPage(request.page);
    const perPage = normalizeGitHubProviderPerPage(request.perPage);
    const resource = `${providerRepositoryResource(installationId, owner, repo)}/branches`;
    const installationToken = await this.#authorizeAndCreateInstallationToken(request, resource);
    const body = await this.#getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`,
      installationToken,
    );
    if (!Array.isArray(body)) throw new Error('GitHub returned invalid branches list.');
    const branches = Object.freeze(body.map(branchFromApi));
    await this.#publishOperation('branches.list', installationId, 'success', branches.length);
    return Object.freeze({
      schema: GITHUB_PROVIDER_SCHEMA,
      installationId,
      repository: repositoryIdentity(owner, repo),
      page,
      perPage,
      hasMore: branches.length === perPage,
      branches,
    });
  }

  shutdown(): void { this.#ready = false; }

  async #authorizeAndCreateInstallationToken(
    request: GitHubProviderAuthorization,
    resource: string,
  ): Promise<string> {
    const installationId = normalizeGitHubInstallationId(request.installationId);
    const connectivity = this.#offline.status().connectivity;
    if (connectivity !== 'online') {
      throw new Error(`GitHub Provider requires online connectivity; current state is ${connectivity}.`);
    }
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [
        { capability: 'READ', resource },
        { capability: 'NETWORK', resource },
      ],
    }, request.token);
    const installations = await this.#githubApp.listInstallations({ jobId: request.jobId, token: request.token });
    const installation = installations.find((candidate) => candidate.installationId === installationId);
    if (!installation) throw new Error(`GitHub installation ${installationId} is not registered locally.`);
    if (installation.state !== 'active') throw new Error(`GitHub installation ${installationId} is suspended.`);
    const token = await this.#githubApp.createInstallationAccessToken({
      jobId: request.jobId,
      token: request.token,
      installationId,
    });
    return token.token;
  }

  async #getJson(path: string, installationToken: string): Promise<unknown> {
    if (!path.startsWith('/') || path.startsWith('//') || /\s/.test(path)) throw new TypeError('GitHub Provider path is invalid.');
    const response = await this.#fetch(`${GITHUB_API_BASE_URL}${path}`, {
      method: 'GET',
      redirect: 'error',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${installationToken}`,
        'x-github-api-version': GITHUB_API_VERSION,
        'user-agent': 'github-decrypter-local-runtime/0.0.24',
      },
    });
    if (!response.ok) throw new Error(`GitHub Provider request failed with HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('GitHub Provider expected a JSON response.');
    }
    return response.json() as Promise<unknown>;
  }

  async #publishOperation(
    operation: GitHubProviderOperation,
    installationId: number,
    outcome: 'success' | 'failure',
    itemCount: number,
  ): Promise<void> {
    await this.#eventBus?.publish('gd.local.github-provider.operation', {
      operation,
      installationId,
      outcome,
      itemCount,
      occurredAt: this.#now(),
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('GitHub Provider is not ready.');
  }
}

export function createGitHubProvider(options: GitHubProviderOptions): GitHubProvider {
  return new GitHubProvider(options);
}
