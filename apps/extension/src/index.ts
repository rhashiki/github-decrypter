import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';

const protocolRole: PeerRole = 'extension';

export const GITHUB_EXTENSION_BUILD = 25 as const;
export const GITHUB_EXTENSION_VERSION = '0.0.25' as const;
export const GITHUB_EXTENSION_BRIDGE_SCHEMA = 'gd-extension-bridge/1' as const;
export const GITHUB_EXTENSION_ALLOWED_ORIGIN = 'https://github.com' as const;
export const GITHUB_EXTENSION_MESSAGE_TYPES = [
  'gd.extension.hello',
  'gd.extension.page-context',
] as const;

export type GitHubExtensionMessageType = (typeof GITHUB_EXTENSION_MESSAGE_TYPES)[number];

export interface GitHubExtensionPageContext {
  readonly schema: typeof GITHUB_EXTENSION_BRIDGE_SCHEMA;
  readonly type: 'gd.extension.page-context';
  readonly origin: typeof GITHUB_EXTENSION_ALLOWED_ORIGIN;
  readonly pathname: string;
  readonly observedAt: string;
}

export interface GitHubExtensionHello {
  readonly schema: typeof GITHUB_EXTENSION_BRIDGE_SCHEMA;
  readonly type: 'gd.extension.hello';
}

export interface GitHubExtensionHelloResponse {
  readonly schema: typeof GITHUB_EXTENSION_BRIDGE_SCHEMA;
  readonly ok: true;
  readonly build: typeof GITHUB_EXTENSION_BUILD;
  readonly version: typeof GITHUB_EXTENSION_VERSION;
  readonly role: 'lightweight-github-bridge';
  readonly repositoryLauncher: false;
  readonly networkAuthority: false;
  readonly durableExecution: false;
}

export function normalizeGitHubExtensionPageUrl(value: string): Pick<GitHubExtensionPageContext, 'origin' | 'pathname'> {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password) {
    throw new TypeError('GitHub Extension page URL must use the canonical https://github.com origin.');
  }
  if (parsed.pathname.length > 2_048 || /[\u0000-\u001f\u007f]/.test(parsed.pathname)) {
    throw new TypeError('GitHub Extension pathname is invalid.');
  }
  return Object.freeze({
    origin: GITHUB_EXTENSION_ALLOWED_ORIGIN,
    pathname: parsed.pathname || '/',
  });
}

export const appIdentity = Object.freeze({
  id: 'extension',
  packageName: '@github-decrypter/extension',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  bridgeSchema: GITHUB_EXTENSION_BRIDGE_SCHEMA,
  build: GITHUB_EXTENSION_BUILD,
  version: GITHUB_EXTENSION_VERSION,
  role: 'Lightweight GitHub Chrome launcher/bridge foundation. Repository detection, FAB and Open in GitHub Decrypter arrive in Build 26.',
});
