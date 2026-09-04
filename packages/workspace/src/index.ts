export const packageIdentity = '@github-decrypter/workspace' as const;
export const WORKSPACE_SCHEMA = 'gd-workspace/1' as const;

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

export function asWorkspaceId(value: string): WorkspaceId {
  if (!/^gd_ws_[0-9a-f-]{36}$/i.test(value)) {
    throw new TypeError('Workspace IDs must use the gd_ws_<uuid> format.');
  }
  return value as WorkspaceId;
}
