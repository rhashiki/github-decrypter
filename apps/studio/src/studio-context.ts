export const STUDIO_BUILD = 32 as const;
export const STUDIO_VERSION = '0.0.32' as const;
export const STUDIO_LAUNCH_SCHEMA = 'gd-studio-launch/1' as const;

const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const RESERVED_TOP_LEVEL = new Set([
  'about', 'apps', 'collections', 'contact', 'copilot', 'codespaces', 'enterprise',
  'events', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace',
  'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search',
  'security', 'settings', 'site', 'sponsors', 'signup', 'topics', 'trending', 'users',
]);

export interface StudioRepositoryContext {
  readonly schema: typeof STUDIO_LAUNCH_SCHEMA;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly githubUrl: string;
}

export type StudioLaunchContext =
  | { readonly kind: 'empty' }
  | { readonly kind: 'repository'; readonly repository: StudioRepositoryContext }
  | { readonly kind: 'invalid'; readonly reason: string };

function normalizePart(value: string | null, label: string): string {
  if (value === null) throw new TypeError(`${label} is missing.`);
  const normalized = value.trim();
  if (!REPOSITORY_PART.test(normalized)) throw new TypeError(`${label} is invalid.`);
  return normalized;
}

export function createStudioRepositoryContext(owner: string, name: string): StudioRepositoryContext {
  const normalizedOwner = normalizePart(owner, 'Repository owner');
  const normalizedName = normalizePart(name, 'Repository name');
  if (RESERVED_TOP_LEVEL.has(normalizedOwner.toLowerCase())) {
    throw new TypeError('Repository owner is a reserved GitHub top-level route.');
  }
  const fullName = `${normalizedOwner}/${normalizedName}`;
  return Object.freeze({
    schema: STUDIO_LAUNCH_SCHEMA,
    owner: normalizedOwner,
    name: normalizedName,
    fullName,
    githubUrl: `https://github.com/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedName)}`,
  });
}

export function parseStudioLaunchContext(search: string): StudioLaunchContext {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const keys = [...params.keys()];
  if (keys.length === 0) return Object.freeze({ kind: 'empty' });

  const allowed = new Set(['owner', 'repo']);
  if (keys.some((key) => !allowed.has(key))) {
    return Object.freeze({ kind: 'invalid', reason: 'Unsupported launch parameter.' });
  }
  if (params.getAll('owner').length !== 1 || params.getAll('repo').length !== 1 || keys.length !== 2) {
    return Object.freeze({ kind: 'invalid', reason: 'Repository launch parameters must contain one owner and one repo.' });
  }

  try {
    return Object.freeze({
      kind: 'repository',
      repository: createStudioRepositoryContext(params.get('owner')!, params.get('repo')!),
    });
  } catch (error) {
    return Object.freeze({
      kind: 'invalid',
      reason: error instanceof Error ? error.message : 'Repository launch context is invalid.',
    });
  }
}
