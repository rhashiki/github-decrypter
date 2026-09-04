import {
  GIT_RUNTIME_SCHEMA,
  type GitBranchesResult,
  type GitBranchSummary,
  type GitLogEntry,
  type GitLogResult,
  type GitMutationResult,
  type GitOperation,
  type GitStatusSnapshot,
  type GitTextResult,
} from '@github-decrypter/git';
import type { WorkspaceId } from '@github-decrypter/workspace';
import type { EventBus } from '@github-decrypter/shared';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { CapabilitySecurityAuthority } from './capability-security.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { OfflineExecutionCoordinator } from './offline-execution.js';
import type { WorkspaceManager } from './workspace-manager.js';

export interface GitRuntimeStatus {
  readonly ready: boolean;
  readonly available: boolean;
  readonly version: string | null;
  readonly operations: number;
  readonly shellExecution: false;
  readonly forcePush: false;
  readonly hardReset: false;
  readonly externalTransport: false;
}

export interface GitWriteAuthorization {
  readonly jobId: DurableJobId;
  readonly token: string;
}

export interface GitRuntimeOptions {
  readonly workspaces: WorkspaceManager;
  readonly capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'>;
  readonly offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

interface GitProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface GitRunOptions {
  readonly allowFailure?: boolean;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_REVISION_LENGTH = 256;
const MAX_REMOTE_NAME_LENGTH = 128;
const MAX_COMMIT_MESSAGE_LENGTH = 10_000;

function assertSafeRevision(value: string, label = 'Git revision'): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_REVISION_LENGTH) {
    throw new TypeError(`${label} must contain between 1 and ${MAX_REVISION_LENGTH} characters.`);
  }
  if (normalized.startsWith('-') || normalized.includes('\0') || /\s/.test(normalized) || normalized.includes('..')) {
    throw new TypeError(`${label} contains unsupported characters.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@{}~^:+-]*$/.test(normalized)) {
    throw new TypeError(`${label} contains unsupported characters.`);
  }
  return normalized;
}

function assertSafeBranchName(value: string): string {
  const normalized = assertSafeRevision(value, 'Git branch name');
  if (normalized === 'HEAD' || normalized.includes('@{') || /[~^:]/.test(normalized)) {
    throw new TypeError('Git branch name contains revision syntax.');
  }
  return normalized;
}

function assertSafeRemoteName(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_REMOTE_NAME_LENGTH) {
    throw new TypeError(`Git remote name must contain between 1 and ${MAX_REMOTE_NAME_LENGTH} characters.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    throw new TypeError('Git remote name contains unsupported characters.');
  }
  return normalized;
}

function assertSafeRemoteUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2_048 || /\s|\0/.test(normalized)) {
    throw new TypeError('Git remote URL is empty, too long or contains unsupported whitespace.');
  }

  if (/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+(?:\.git)?$/.test(normalized)) {
    return normalized;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError('Git remote URL must use HTTPS, SSH or SCP-like syntax.');
  }
  if (!['https:', 'ssh:'].includes(parsed.protocol)) {
    throw new TypeError('Git remote URL must use HTTPS or SSH.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('Git remote URL may not embed credentials, query strings or fragments.');
  }
  if (!parsed.hostname) throw new TypeError('Git remote URL must include a hostname.');
  return normalized;
}

function normalizePathspec(root: string, value: string): string {
  const requested = value.trim();
  if (!requested) throw new TypeError('Git pathspec must be non-empty.');
  if (requested.includes('\0') || isAbsolute(requested)) {
    throw new TypeError('Git pathspec must be a workspace-relative path.');
  }
  const target = resolve(root, requested);
  const relation = relative(root, target);
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error('Git pathspec escapes the registered workspace.');
  }
  return relation || '.';
}

function normalizePathspecs(root: string, values: readonly string[]): readonly string[] {
  if (values.length === 0) throw new TypeError('At least one Git pathspec is required.');
  return Object.freeze(values.map((value) => normalizePathspec(root, value)));
}

export function gitWorkspaceResource(workspaceId: WorkspaceId): string {
  return `gd://workspace/${workspaceId}/git`;
}

function parseVersion(stdout: string): string | null {
  const match = stdout.trim().match(/^git version\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function runGitProcess(
  cwd: string,
  args: readonly string[],
  options: GitRunOptions = {},
): Promise<GitProcessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  return new Promise<GitProcessResult>((resolvePromise, rejectPromise) => {
    const child = spawn('git', [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        LC_ALL: 'C',
        LANG: 'C',
      },
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    let overflow = false;
    let timedOut = false;

    let timer: NodeJS.Timeout;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    };

    const append = (target: Buffer[], chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > maxOutputBytes) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      target.push(buffer);
    };

    child.stdout.on('data', (chunk) => append(stdout, chunk));
    child.stderr.on('data', (chunk) => append(stderr, chunk));
    child.once('error', (error) => finishError(error));

    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (overflow) {
        rejectPromise(new Error(`Git output exceeded ${maxOutputBytes} bytes.`));
        return;
      }
      if (timedOut) {
        rejectPromise(new Error(`Git command exceeded ${timeoutMs} ms.`));
        return;
      }

      const result = Object.freeze({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
      if (result.code !== 0 && !options.allowFailure) {
        const message = result.stderr.trim().slice(0, 16_384) || `Git exited with code ${result.code}.`;
        rejectPromise(new Error(message));
        return;
      }
      resolvePromise(result);
    });
  });
}

function classifyStatus(stdout: string): {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicted: string[];
} {
  const staged = new Set<string>();
  const unstaged = new Set<string>();
  const untracked = new Set<string>();
  const conflicted = new Set<string>();

  for (const record of stdout.split('\0')) {
    if (!record) continue;
    const code = record.slice(0, 2);
    const path = record.length > 3 ? record.slice(3) : '';
    if (!path) continue;

    if (code === '??') {
      untracked.add(path);
      continue;
    }

    if (code.includes('U') || code === 'AA' || code === 'DD') conflicted.add(path);
    if (code[0] && code[0] !== ' ' && code[0] !== '?') staged.add(path);
    if (code[1] && code[1] !== ' ' && code[1] !== '?') unstaged.add(path);
  }

  return {
    staged: [...staged].sort(),
    unstaged: [...unstaged].sort(),
    untracked: [...untracked].sort(),
    conflicted: [...conflicted].sort(),
  };
}

export class GitRuntime {
  readonly #workspaces: WorkspaceManager;
  readonly #capabilities: Pick<CapabilitySecurityAuthority, 'assertAuthorized'>;
  readonly #offline: Pick<OfflineExecutionCoordinator, 'status'>;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxOutputBytes: number;
  #ready = false;
  #available = false;
  #version: string | null = null;
  #operations = 0;

  constructor(options: GitRuntimeOptions) {
    this.#workspaces = options.workspaces;
    this.#capabilities = options.capabilities;
    this.#offline = options.offline;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  }

  async initialize(): Promise<GitRuntimeStatus> {
    const probe = await runGitProcess(process.cwd(), ['--version'], {
      allowFailure: true,
      timeoutMs: Math.min(this.#timeoutMs, 5_000),
      maxOutputBytes: 64 * 1024,
    }).catch(() => null);
    this.#available = probe?.code === 0;
    this.#version = probe && probe.code === 0 ? parseVersion(probe.stdout) : null;
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.git.ready', {
      available: status.available,
      version: status.version,
      shellExecution: false,
      forcePush: false,
      hardReset: false,
      externalTransport: false,
    });
    return status;
  }

  shutdown(): void {
    this.#ready = false;
  }

  status(): GitRuntimeStatus {
    return Object.freeze({
      ready: this.#ready,
      available: this.#available,
      version: this.#version,
      operations: this.#operations,
      shellExecution: false,
      forcePush: false,
      hardReset: false,
      externalTransport: false,
    });
  }

  async statusSnapshot(workspaceId: WorkspaceId): Promise<GitStatusSnapshot> {
    const root = this.#workspaceRoot(workspaceId);
    const probe = await this.#run(workspaceId, 'status', ['rev-parse', '--is-inside-work-tree'], {
      allowFailure: true,
      root,
    });

    if (probe.code !== 0 || probe.stdout.trim() !== 'true') {
      return Object.freeze({
        schema: GIT_RUNTIME_SCHEMA,
        workspaceId,
        repository: false,
        branch: null,
        head: null,
        upstream: null,
        ahead: 0,
        behind: 0,
        staged: Object.freeze([]),
        unstaged: Object.freeze([]),
        untracked: Object.freeze([]),
        conflicted: Object.freeze([]),
        clean: true,
        observedAt: this.#now(),
      });
    }

    const [porcelain, branchResult, headResult, upstreamResult] = await Promise.all([
      this.#run(workspaceId, 'status', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'], { root }),
      this.#run(workspaceId, 'status', ['symbolic-ref', '--short', '-q', 'HEAD'], { root, allowFailure: true }),
      this.#run(workspaceId, 'status', ['rev-parse', '--verify', 'HEAD'], { root, allowFailure: true }),
      this.#run(workspaceId, 'status', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { root, allowFailure: true }),
    ]);

    const branch = branchResult.code === 0 ? branchResult.stdout.trim() || null : null;
    const head = headResult.code === 0 ? headResult.stdout.trim() || null : null;
    const upstream = upstreamResult.code === 0 ? upstreamResult.stdout.trim() || null : null;
    let ahead = 0;
    let behind = 0;

    if (head && upstream) {
      const counts = await this.#run(workspaceId, 'status', ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], {
        root,
        allowFailure: true,
      });
      if (counts.code === 0) {
        const [left, right] = counts.stdout.trim().split(/\s+/).map(Number);
        if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) {
          ahead = left;
          behind = right;
        }
      }
    }

    const classified = classifyStatus(porcelain.stdout);
    return Object.freeze({
      schema: GIT_RUNTIME_SCHEMA,
      workspaceId,
      repository: true,
      branch,
      head,
      upstream,
      ahead,
      behind,
      staged: Object.freeze(classified.staged),
      unstaged: Object.freeze(classified.unstaged),
      untracked: Object.freeze(classified.untracked),
      conflicted: Object.freeze(classified.conflicted),
      clean: classified.staged.length === 0
        && classified.unstaged.length === 0
        && classified.untracked.length === 0
        && classified.conflicted.length === 0,
      observedAt: this.#now(),
    });
  }

  async diff(
    workspaceId: WorkspaceId,
    options: { readonly staged?: boolean; readonly paths?: readonly string[] } = {},
  ): Promise<GitTextResult> {
    const root = this.#workspaceRoot(workspaceId);
    const args = ['diff', '--no-ext-diff', '--no-color'];
    if (options.staged) args.push('--cached');
    if (options.paths?.length) args.push('--', ...options.paths.map((path) => normalizePathspec(root, path)));
    const result = await this.#run(workspaceId, 'diff', args, { root });
    return Object.freeze({
      schema: GIT_RUNTIME_SCHEMA,
      workspaceId,
      operation: 'diff',
      text: result.stdout,
      observedAt: this.#now(),
    });
  }

  async log(workspaceId: WorkspaceId, maxCount = 50): Promise<GitLogResult> {
    if (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 500) {
      throw new RangeError('Git log maxCount must be between 1 and 500.');
    }
    const root = this.#workspaceRoot(workspaceId);
    const result = await this.#run(workspaceId, 'log', [
      'log',
      `--max-count=${maxCount}`,
      '--date=iso-strict',
      '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s',
    ], { root, allowFailure: true });

    if (result.code !== 0) {
      return Object.freeze({ schema: GIT_RUNTIME_SCHEMA, workspaceId, entries: Object.freeze([]), observedAt: this.#now() });
    }

    const entries: GitLogEntry[] = [];
    for (const line of result.stdout.split('\n')) {
      if (!line) continue;
      const [hash, parentsRaw = '', authorName = '', authorEmail = '', authoredAt = '', subject = ''] = line.split('\x1f');
      if (!hash) continue;
      entries.push(Object.freeze({
        hash,
        parents: Object.freeze(parentsRaw ? parentsRaw.split(' ').filter(Boolean) : []),
        authorName,
        authorEmail,
        authoredAt,
        subject,
      }));
    }
    return Object.freeze({ schema: GIT_RUNTIME_SCHEMA, workspaceId, entries: Object.freeze(entries), observedAt: this.#now() });
  }

  async branches(workspaceId: WorkspaceId): Promise<GitBranchesResult> {
    const root = this.#workspaceRoot(workspaceId);
    const result = await this.#run(workspaceId, 'branches', [
      'for-each-ref',
      '--format=%(refname:short)%09%(objectname)%09%(upstream:short)%09%(HEAD)',
      'refs/heads',
    ], { root, allowFailure: true });

    const branches: GitBranchSummary[] = [];
    if (result.code === 0) {
      for (const line of result.stdout.split('\n')) {
        if (!line) continue;
        const [name = '', head = '', upstream = '', current = ''] = line.split('\t');
        if (!name || !head) continue;
        branches.push(Object.freeze({
          name,
          head,
          upstream: upstream || null,
          current: current.trim() === '*',
        }));
      }
    }
    return Object.freeze({ schema: GIT_RUNTIME_SCHEMA, workspaceId, branches: Object.freeze(branches), observedAt: this.#now() });
  }

  async mergeBase(workspaceId: WorkspaceId, left: string, right: string): Promise<GitTextResult> {
    const root = this.#workspaceRoot(workspaceId);
    const result = await this.#run(workspaceId, 'merge-base', [
      'merge-base',
      assertSafeRevision(left, 'Left Git revision'),
      assertSafeRevision(right, 'Right Git revision'),
    ], { root });
    return Object.freeze({
      schema: GIT_RUNTIME_SCHEMA,
      workspaceId,
      operation: 'merge-base',
      text: result.stdout.trim(),
      observedAt: this.#now(),
    });
  }

  async blame(workspaceId: WorkspaceId, path: string): Promise<GitTextResult> {
    const root = this.#workspaceRoot(workspaceId);
    const result = await this.#run(workspaceId, 'blame', [
      'blame',
      '--line-porcelain',
      '--',
      normalizePathspec(root, path),
    ], { root });
    return Object.freeze({
      schema: GIT_RUNTIME_SCHEMA,
      workspaceId,
      operation: 'blame',
      text: result.stdout,
      observedAt: this.#now(),
    });
  }

  async clone(
    workspaceId: WorkspaceId,
    remoteUrl: string,
    authorization: GitWriteAuthorization,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    if (readdirSync(root).length !== 0) throw new Error('Git clone requires an empty registered workspace root.');
    await this.#authorizeMutation(workspaceId, authorization, true);
    const result = await this.#run(workspaceId, 'clone', [
      'clone',
      '--origin',
      'origin',
      assertSafeRemoteUrl(remoteUrl),
      '.',
    ], { root, mutating: true, network: true });
    return this.#mutation(workspaceId, 'clone', result);
  }

  async fetch(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
    remote = 'origin',
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, true);
    const result = await this.#run(workspaceId, 'fetch', ['fetch', assertSafeRemoteName(remote)], {
      root,
      mutating: true,
      network: true,
    });
    return this.#mutation(workspaceId, 'fetch', result);
  }

  async pull(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
    options: { readonly remote?: string; readonly branch?: string } = {},
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, true);
    const args = ['pull', '--ff-only', assertSafeRemoteName(options.remote ?? 'origin')];
    if (options.branch) args.push(assertSafeBranchName(options.branch));
    const result = await this.#run(workspaceId, 'pull', args, { root, mutating: true, network: true });
    return this.#mutation(workspaceId, 'pull', result);
  }

  async checkout(
    workspaceId: WorkspaceId,
    revision: string,
    authorization: GitWriteAuthorization,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, false);
    const result = await this.#run(workspaceId, 'checkout', [
      'checkout',
      '--quiet',
      assertSafeRevision(revision),
    ], { root, mutating: true });
    return this.#mutation(workspaceId, 'checkout', result);
  }

  async createBranch(
    workspaceId: WorkspaceId,
    name: string,
    authorization: GitWriteAuthorization,
    startPoint?: string,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, false);
    const args = ['checkout', '--quiet', '-b', assertSafeBranchName(name)];
    if (startPoint) args.push(assertSafeRevision(startPoint, 'Git branch start point'));
    const result = await this.#run(workspaceId, 'create-branch', args, { root, mutating: true });
    return this.#mutation(workspaceId, 'create-branch', result);
  }

  async commit(
    workspaceId: WorkspaceId,
    message: string,
    authorization: GitWriteAuthorization,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    const normalizedMessage = message.trim();
    if (!normalizedMessage || normalizedMessage.length > MAX_COMMIT_MESSAGE_LENGTH || normalizedMessage.includes('\0')) {
      throw new TypeError(`Git commit message must contain between 1 and ${MAX_COMMIT_MESSAGE_LENGTH} characters.`);
    }
    await this.#authorizeMutation(workspaceId, authorization, false);
    const result = await this.#run(workspaceId, 'commit', ['commit', '-m', normalizedMessage], { root, mutating: true });
    return this.#mutation(workspaceId, 'commit', result);
  }

  async push(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
    options: { readonly remote?: string; readonly branch?: string } = {},
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, true);
    const args = ['push', assertSafeRemoteName(options.remote ?? 'origin')];
    if (options.branch) args.push(assertSafeBranchName(options.branch));
    const result = await this.#run(workspaceId, 'push', args, { root, mutating: true, network: true });
    return this.#mutation(workspaceId, 'push', result);
  }

  async stashPush(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
    message?: string,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, false);
    const args = ['stash', 'push'];
    const normalizedMessage = message?.trim();
    if (normalizedMessage) {
      if (normalizedMessage.length > 1_000 || normalizedMessage.includes('\0')) throw new TypeError('Git stash message is invalid.');
      args.push('-m', normalizedMessage);
    }
    const result = await this.#run(workspaceId, 'stash-push', args, { root, mutating: true });
    return this.#mutation(workspaceId, 'stash-push', result);
  }

  async stashPop(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    await this.#authorizeMutation(workspaceId, authorization, false);
    const result = await this.#run(workspaceId, 'stash-pop', ['stash', 'pop'], { root, mutating: true });
    return this.#mutation(workspaceId, 'stash-pop', result);
  }

  async restore(
    workspaceId: WorkspaceId,
    paths: readonly string[],
    authorization: GitWriteAuthorization,
    options: { readonly staged?: boolean } = {},
  ): Promise<GitMutationResult> {
    const root = this.#workspaceRoot(workspaceId);
    const normalizedPaths = normalizePathspecs(root, paths);
    await this.#authorizeMutation(workspaceId, authorization, false);
    const args = ['restore'];
    if (options.staged) args.push('--staged');
    args.push('--', ...normalizedPaths);
    const result = await this.#run(workspaceId, 'restore', args, { root, mutating: true });
    return this.#mutation(workspaceId, 'restore', result);
  }

  async #authorizeMutation(
    workspaceId: WorkspaceId,
    authorization: GitWriteAuthorization,
    network: boolean,
  ): Promise<void> {
    if (!authorization?.jobId || !authorization.token) {
      throw new Error('Git mutation requires a job-bound capability token.');
    }
    if (network && this.#offline.status().connectivity !== 'online') {
      throw new Error('Git network operation requires Offline Execution connectivity state online.');
    }
    const resource = gitWorkspaceResource(workspaceId);
    await this.#capabilities.assertAuthorized({
      jobId: authorization.jobId,
      requirements: [
        { capability: 'GIT_WRITE', resource },
        ...(network ? [{ capability: 'NETWORK' as const, resource }] : []),
      ],
    }, authorization.token);
  }

  #workspaceRoot(workspaceId: WorkspaceId): string {
    this.#assertReady();
    this.#assertAvailable();
    return this.#workspaces.resolveExistingPath(workspaceId, '');
  }

  async #run(
    workspaceId: WorkspaceId,
    operation: GitOperation,
    args: readonly string[],
    options: GitRunOptions & { readonly root: string; readonly mutating?: boolean; readonly network?: boolean },
  ): Promise<GitProcessResult> {
    this.#assertReady();
    this.#assertAvailable();
    const occurredAt = this.#now();
    try {
      const result = await runGitProcess(options.root, args, {
        allowFailure: options.allowFailure,
        timeoutMs: options.timeoutMs ?? this.#timeoutMs,
        maxOutputBytes: options.maxOutputBytes ?? this.#maxOutputBytes,
      });
      this.#operations += 1;
      await this.#eventBus?.publish('gd.local.git.operation', {
        workspaceId,
        operation,
        mutating: options.mutating === true,
        network: options.network === true,
        outcome: result.code === 0 ? 'success' : 'failure',
        exitCode: result.code,
        occurredAt,
      });
      return result;
    } catch (error) {
      this.#operations += 1;
      await this.#eventBus?.publish('gd.local.git.operation', {
        workspaceId,
        operation,
        mutating: options.mutating === true,
        network: options.network === true,
        outcome: 'failure',
        exitCode: null,
        occurredAt,
      });
      throw error;
    }
  }

  #mutation(
    workspaceId: WorkspaceId,
    operation: GitMutationResult['operation'],
    result: GitProcessResult,
  ): GitMutationResult {
    return Object.freeze({
      schema: GIT_RUNTIME_SCHEMA,
      workspaceId,
      operation,
      changed: result.code === 0,
      output: `${result.stdout}${result.stderr}`.trim(),
      observedAt: this.#now(),
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Git Runtime is not ready.');
  }

  #assertAvailable(): void {
    if (!this.#available) throw new Error('Git executable is not available to the Local Runtime.');
  }
}

export function createGitRuntime(options: GitRuntimeOptions): GitRuntime {
  return new GitRuntime(options);
}
