import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';
import { STUDIO_BUILD, STUDIO_LAUNCH_SCHEMA, STUDIO_VERSION } from './studio-context.js';

const protocolRole: PeerRole = 'studio';

export * from './studio-context.js';
export { StudioApp } from './App.js';

export const appIdentity = Object.freeze({
  id: 'studio',
  packageName: '@github-decrypter/studio',
  protocolRole,
  protocolSchema: PROTOCOL_SCHEMA,
  launchSchema: STUDIO_LAUNCH_SCHEMA,
  build: STUDIO_BUILD,
  version: STUDIO_VERSION,
  framework: 'React 19' as const,
  bundler: 'Vite 8' as const,
  role: 'Client-only React Studio foundation. PWA, unified design system and IDE layout remain Builds 28–30.',
});
