import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';

const protocolRole: PeerRole = 'extension';

export const GITHUB_EXTENSION_BUILD = 26 as const;
export const GITHUB_EXTENSION_VERSION = '0.0.26' as const;
export const GITHUB_EXTENSION_BRIDGE_SCHEMA = 'gd-extension-bridge/1' as const;
export const GITHUB_EXTENSION_ALLOWED_ORIGIN = 'https://github.com' as const;
export const GITHUB_EXTENSION_LAUNCHER_PAGE = 'apps/extension/browser/launcher.html' as const;
export const GITHUB_EXTENSION_MESSAGE_TYPES = [
  'gd.extension.hello',
  'gd.extension.page-context',
  'gd.extension.repository-context',
  'gd.extension.open-repository',
  'gd.extension.launcher-status',
] as const;

export type GitHubExtensionMessageType = (typeof GITHUB_EXTENSION_MESSAGE_TYPES)[number];

export interface GitHubExtensionPageContext {
  readonly schema: typeof GITHUB_EXTENSION_BRIDGE_SCHEMA;
  readonly type: 'gd.extension.page-context';
  readonly origin: typeof GITHUB_EXTENSION_ALLOWED_ORIGIN;
  readonly pathname: string;
  readonly observedAt: string;
}

export interface GitHubRepositoryIdentity {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly url: string;
}

export interface GitHubExtensionRepositoryContext extends Omit<GitHubExtensionPageContext, 'type'> {
  readonly type: 'gd.extension.repository-context';
  readonly repository: GitHubRepositoryIdentity;
}

export interface GitHubExtensionOpenRepository {
  readonly schema: typeof GITHUB_EXTENSION_BRIDGE_SCHEMA;
  readonly type: 'gd.extension.open-repository';
  readonly origin: typeof GITHUB_EXTENSION_ALLOWED_ORIGIN;
  readonly pathname: string;
  readonly repository: GitHubRepositoryIdentity;
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
  readonly repositoryLauncher: true;
  readonly connection: 'extension-bridge';
  readonly studioReady: false;
  readonly networkAuthority: false;
  readonly durableExecution: false;
}

const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const RESERVED_TOP_LEVEL = new Set([
  'about', 'apps', 'collections', 'contact', 'copilot', 'codespaces', 'enterprise',
  'events', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace',
  'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search',
  'security', 'settings', 'site', 'sponsors', 'signup', 'topics', 'trending', 'users',
]);

export function normalizeGitHubExtensionPageUrl(value: string): Pick<GitHubExtensionPageContext, 'origin' | 'pathname'> {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password) {
    throw new TypeError('GitHub Extension page URL must use the canonical https://github.com origin.');
  }
  if (parsed.pathname.length > 2_048 || /[\u0000-\u001f\u007f]/.test(parsed.pathname)) {
    throw new TypeError('GitHub Extension pathname is invalid.');
  }
  return Object.freeze({ origin: GITHUB_EXTENSION_ALLOWED_ORIGIN, pathname: parsed.pathname || '/' });
}

export function normalizeGitHubRepositoryIdentity(owner: string, name: string): GitHubRepositoryIdentity {
  const normalizedOwner = owner.trim();
  const normalizedName = name.trim();
  if (!REPOSITORY_PART.test(normalizedOwner) || !REPOSITORY_PART.test(normalizedName)) {
    throw new TypeError('GitHub repository owner/name is invalid.');
  }
  if (RESERVED_TOP_LEVEL.has(normalizedOwner.toLowerCase())) {
    throw new TypeError('GitHub repository owner is a reserved top-level route.');
  }
  const fullName = `${normalizedOwner}/${normalizedName}`;
  return Object.freeze({
    owner: normalizedOwner,
    name: normalizedName,
    fullName,
    url: `${GITHUB_EXTENSION_ALLOWED_ORIGIN}/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedName)}`,
  });
}

export function detectGitHubRepositoryFromPage(value: string, canonicalRepositoryNwo: string | null): GitHubRepositoryIdentity | null {
  const page = normalizeGitHubExtensionPageUrl(value);
  if (!canonicalRepositoryNwo) return null;
  const segments = page.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const nwo = canonicalRepositoryNwo.trim().split('/');
  if (nwo.length !== 2 || nwo[0] !== segments[0] || nwo[1] !== segments[1]) return null;
  try { return normalizeGitHubRepositoryIdentity(nwo[0]!, nwo[1]!); }
  catch { return null; }
}

export const appIdentity = Object.freeze({
  id: 'extension',
  packageName: '@github-decrypter/extension',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  bridgeSchema: GITHUB_EXTENSION_BRIDGE_SCHEMA,
  build: GITHUB_EXTENSION_BUILD,
  version: GITHUB_EXTENSION_VERSION,
  role: 'Lightweight GitHub Chrome bridge with fail-closed repository detection, repository FAB and extension-owned launcher handoff. React Studio begins in Build 27.',
});
