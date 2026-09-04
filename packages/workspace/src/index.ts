export const packageIdentity = '@github-decrypter/workspace' as const;
export const WORKSPACE_SCHEMA = 'gd-workspace/1' as const;
export const PROJECT_DETECTION_SCHEMA = 'gd-project-detection/1' as const;

export const PROJECT_PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun', 'unknown'] as const;
export type ProjectPackageManager = (typeof PROJECT_PACKAGE_MANAGERS)[number];

export const PROJECT_FRAMEWORKS = ['next', 'astro', 'react', 'vue', 'svelte', 'vite', 'vanilla', 'unknown'] as const;
export type ProjectFramework = (typeof PROJECT_FRAMEWORKS)[number];

export const PROJECT_DETECTION_CONFIDENCE = ['high', 'medium', 'low'] as const;
export type ProjectDetectionConfidence = (typeof PROJECT_DETECTION_CONFIDENCE)[number];

declare const workspaceIdBrand: unique symbol;
export type WorkspaceId = string & { readonly [workspaceIdBrand]: 'workspace-id' };

export interface WorkspaceDescriptor {
  readonly schema: typeof WORKSPACE_SCHEMA;
  readonly id: WorkspaceId;
  readonly rootPath: string;
  readonly displayName: string;
  readonly registeredAt: string;
  readonly lastOpenedAt: string | null;
}

export interface ProjectDetectionResult {
  readonly schema: typeof PROJECT_DETECTION_SCHEMA;
  readonly workspaceId: WorkspaceId;
  readonly detectedAt: string;
  readonly packageJsonPresent: boolean;
  readonly packageManager: ProjectPackageManager;
  readonly framework: ProjectFramework;
  readonly devScript: string | null;
  readonly devCommand: string | null;
  readonly confidence: ProjectDetectionConfidence;
  readonly evidence: readonly string[];
  readonly readOnly: true;
}

export function asWorkspaceId(value: string): WorkspaceId {
  if (!/^gd_ws_[0-9a-f-]{36}$/i.test(value)) {
    throw new TypeError('Workspace IDs must use the gd_ws_<uuid> format.');
  }
  return value as WorkspaceId;
}
