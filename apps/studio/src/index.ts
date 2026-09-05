import { PROTOCOL_SCHEMA, type PeerRole } from '@github-decrypter/protocol';
import {
  DESIGN_SYSTEM_BUILD,
  DESIGN_SYSTEM_ID,
  DESIGN_SYSTEM_SCHEMA,
  IDE_LAYOUT_BUILD,
  IDE_LAYOUT_SCHEMA,
} from '@github-decrypter/ui';
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
  designSystem: DESIGN_SYSTEM_ID,
  designSystemSchema: DESIGN_SYSTEM_SCHEMA,
  designSystemBuild: DESIGN_SYSTEM_BUILD,
  ideLayoutSchema: IDE_LAYOUT_SCHEMA,
  ideLayoutBuild: IDE_LAYOUT_BUILD,
  layoutStatePersistence: false as const,
  role: 'Client-only React Studio with installable PWA shell, unified design system and structural IDE workbench. Feature panels remain owned by later Builds.',
});
