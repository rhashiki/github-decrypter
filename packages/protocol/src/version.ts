export const PROTOCOL_FAMILY = 'github-decrypter' as const;
export const PROTOCOL_VERSION = 1 as const;
export const PROTOCOL_SCHEMA = 'gd-protocol/1' as const;
export const SUPPORTED_PROTOCOL_VERSIONS = [PROTOCOL_VERSION] as const;

export type ProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export function isSupportedProtocolVersion(value: unknown): value is ProtocolVersion {
  return typeof value === 'number' && SUPPORTED_PROTOCOL_VERSIONS.includes(value as ProtocolVersion);
}

export function selectProtocolVersion(
  local: readonly number[],
  remote: readonly number[],
): ProtocolVersion | null {
  const common = local
    .filter((version) => remote.includes(version))
    .filter(isSupportedProtocolVersion)
    .sort((a, b) => b - a);

  return common[0] ?? null;
}
