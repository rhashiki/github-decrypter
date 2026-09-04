import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';
import { STUDIO_BUILD, STUDIO_LAUNCH_SCHEMA, STUDIO_VERSION } from './studio-context.js';

const protocolRole: PeerRole = 'studio';

export * from './studio-context.js';
export * from './pwa.js';
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
  pwa: true as const,
  offlineAppShell: true as const,
  role: 'Client-only React Studio with installable same-origin PWA app shell. Unified design system and IDE layout remain Builds 29–30.',
});
