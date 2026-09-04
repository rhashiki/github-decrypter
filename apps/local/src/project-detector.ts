import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROJECT_DETECTION_SCHEMA,
  type ProjectDetectionConfidence,
  type ProjectDetectionResult,
  type ProjectFramework,
  type ProjectPackageManager,
  type WorkspaceId,
} from '@github-decrypter/workspace';
import type { EventBus } from '@github-decrypter/shared';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { WorkspaceManager } from './workspace-manager.js';

export const MAX_PACKAGE_JSON_BYTES = 1_048_576 as const;

export interface ProjectDetectionStatus {
  readonly ready: boolean;
  readonly detections: number;
  readonly rootOnly: true;
  readonly readOnly: true;
  readonly filesystemMutation: false;
  readonly networkAccess: false;
  readonly gitAuthority: false;
  readonly externalTransport: false;
}

export interface ProjectDetectorOptions {
  readonly workspaces: WorkspaceManager;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

type PackageJson = Record<string, unknown>;

type PackageManagerDetection = {
  readonly manager: ProjectPackageManager;
  readonly evidence: string[];
  readonly conflict: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function knownManager(value: string): Exclude<ProjectPackageManager, 'unknown'> | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'pnpm' || normalized === 'npm' || normalized === 'yarn' || normalized === 'bun') return normalized;
  return null;
}

function dependencyNames(packageJson: PackageJson | null): Set<string> {
  const names = new Set<string>();
  if (!packageJson) return names;
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = packageJson[key];
    if (!isRecord(section)) continue;
    for (const name of Object.keys(section)) names.add(name);
  }
  return names;
}

function detectFramework(dependencies: Set<string>, hasIndexHtml: boolean): { framework: ProjectFramework; evidence: string[] } {
  if (dependencies.has('next')) return { framework: 'next', evidence: ['dependency:next'] };
  if (dependencies.has('astro')) return { framework: 'astro', evidence: ['dependency:astro'] };
  if (dependencies.has('@sveltejs/kit')) return { framework: 'svelte', evidence: ['dependency:@sveltejs/kit'] };
  if (dependencies.has('svelte')) return { framework: 'svelte', evidence: ['dependency:svelte'] };
  if (dependencies.has('vue')) return { framework: 'vue', evidence: ['dependency:vue'] };
  if (dependencies.has('react')) return { framework: 'react', evidence: ['dependency:react'] };
  if (dependencies.has('vite')) return { framework: 'vite', evidence: ['dependency:vite'] };
  if (hasIndexHtml) return { framework: 'vanilla', evidence: ['file:index.html'] };
  return { framework: 'unknown', evidence: [] };
}

function detectDevScript(packageJson: PackageJson | null): string | null {
  if (!packageJson || !isRecord(packageJson.scripts)) return null;
  if (typeof packageJson.scripts.dev === 'string' && packageJson.scripts.dev.trim()) return 'dev';
  if (typeof packageJson.scripts.start === 'string' && packageJson.scripts.start.trim()) return 'start';
  return null;
}

function commandFor(manager: ProjectPackageManager, script: string | null): string | null {
  if (!script || manager === 'unknown') return null;
  if (manager === 'pnpm') return script === 'start' ? 'pnpm start' : `pnpm ${script}`;
  if (manager === 'npm') return script === 'start' ? 'npm start' : `npm run ${script}`;
  if (manager === 'yarn') return script === 'start' ? 'yarn start' : `yarn ${script}`;
  return `bun run ${script}`;
}

function confidenceFor(
  packageJsonPresent: boolean,
  manager: ProjectPackageManager,
  framework: ProjectFramework,
  conflict: boolean,
): ProjectDetectionConfidence {
  if (conflict) return manager !== 'unknown' || framework !== 'unknown' ? 'medium' : 'low';
  const score = Number(packageJsonPresent) + Number(manager !== 'unknown') + Number(framework !== 'unknown');
  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

export class ProjectDetector {
  readonly #workspaces: WorkspaceManager;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  #ready = false;
  #detections = 0;

  constructor(options: ProjectDetectorOptions) {
    this.#workspaces = options.workspaces;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  async initialize(): Promise<ProjectDetectionStatus> {
    if (!this.#workspaces.status().ready) throw new Error('Project Detection requires Workspace Manager readiness.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.project-detection.ready', {
      detections: status.detections,
      rootOnly: true,
      readOnly: true,
      filesystemMutation: false,
      networkAccess: false,
      gitAuthority: false,
      externalTransport: false,
    });
    return status;
  }

  shutdown(): void {
    this.#ready = false;
  }

  status(): ProjectDetectionStatus {
    return Object.freeze({
      ready: this.#ready,
      detections: this.#detections,
      rootOnly: true,
      readOnly: true,
      filesystemMutation: false,
      networkAccess: false,
      gitAuthority: false,
      externalTransport: false,
    });
  }

  async detect(workspaceId: WorkspaceId): Promise<ProjectDetectionResult> {
    this.#assertReady();
    const workspace = this.#workspaces.get(workspaceId);
    if (!workspace) throw new Error(`Unknown workspace ${workspaceId}.`);
    this.#workspaces.resolveExistingPath(workspaceId, '');

    const packageJsonPath = this.#resolveIfPresent(workspaceId, workspace.rootPath, 'package.json');
    const packageJson = packageJsonPath ? this.#readPackageJson(packageJsonPath) : null;
    const packageJsonPresent = packageJson !== null;
    const packageManager = this.#detectPackageManager(workspaceId, workspace.rootPath, packageJson);
    const hasIndexHtml = this.#resolveIfPresent(workspaceId, workspace.rootPath, 'index.html') !== null;
    const framework = detectFramework(dependencyNames(packageJson), hasIndexHtml);
    const devScript = detectDevScript(packageJson);
    const detectedAt = this.#now();
    const result: ProjectDetectionResult = Object.freeze({
      schema: PROJECT_DETECTION_SCHEMA,
      workspaceId,
      detectedAt,
      packageJsonPresent,
      packageManager: packageManager.manager,
      framework: framework.framework,
      devScript,
      devCommand: commandFor(packageManager.manager, devScript),
      confidence: confidenceFor(packageJsonPresent, packageManager.manager, framework.framework, packageManager.conflict),
      evidence: Object.freeze([...packageManager.evidence, ...framework.evidence]),
      readOnly: true,
    });
    this.#detections += 1;
    await this.#eventBus?.publish('gd.local.project.detected', {
      workspaceId,
      packageJsonPresent: result.packageJsonPresent,
      packageManager: result.packageManager,
      framework: result.framework,
      confidence: result.confidence,
      detectedAt,
    });
    return result;
  }

  #detectPackageManager(workspaceId: WorkspaceId, rootPath: string, packageJson: PackageJson | null): PackageManagerDetection {
    const evidence: string[] = [];
    let declared: Exclude<ProjectPackageManager, 'unknown'> | null = null;
    if (typeof packageJson?.packageManager === 'string') {
      const raw = packageJson.packageManager.trim();
      const separator = raw.indexOf('@');
      const name = separator > 0 ? raw.slice(0, separator) : raw;
      declared = knownManager(name);
      if (declared) evidence.push(`packageManager:${declared}`);
    }

    const lockfiles: ReadonlyArray<readonly [string, Exclude<ProjectPackageManager, 'unknown'>]> = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['package-lock.json', 'npm'],
      ['npm-shrinkwrap.json', 'npm'],
      ['yarn.lock', 'yarn'],
      ['bun.lock', 'bun'],
      ['bun.lockb', 'bun'],
    ];
    const lockManagers = new Set<Exclude<ProjectPackageManager, 'unknown'>>();
    for (const [file, manager] of lockfiles) {
      if (this.#resolveIfPresent(workspaceId, rootPath, file)) {
        lockManagers.add(manager);
        evidence.push(`lockfile:${file}`);
      }
    }

    if (declared) {
      const conflict = [...lockManagers].some((manager) => manager !== declared);
      return { manager: declared, evidence, conflict };
    }
    if (lockManagers.size === 1) return { manager: [...lockManagers][0]!, evidence, conflict: false };
    return { manager: 'unknown', evidence, conflict: lockManagers.size > 1 };
  }

  #resolveIfPresent(workspaceId: WorkspaceId, rootPath: string, relativePath: string): string | null {
    const candidate = join(rootPath, relativePath);
    if (!existsSync(candidate)) return null;
    return this.#workspaces.resolveExistingPath(workspaceId, relativePath);
  }

  #readPackageJson(path: string): PackageJson {
    const stat = statSync(path);
    if (!stat.isFile()) throw new TypeError('package.json must resolve to a regular file.');
    if (stat.size > MAX_PACKAGE_JSON_BYTES) throw new RangeError(`package.json exceeds ${MAX_PACKAGE_JSON_BYTES} bytes.`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`Unable to parse package.json: ${error instanceof Error ? error.message : 'invalid JSON'}`);
    }
    if (!isRecord(parsed)) throw new TypeError('package.json must contain a JSON object.');
    return parsed;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Project Detection is not ready.');
  }
}

export function createProjectDetector(options: ProjectDetectorOptions): ProjectDetector {
  return new ProjectDetector(options);
}
