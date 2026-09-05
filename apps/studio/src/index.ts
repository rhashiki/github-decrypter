import {
  ENVIRONMENT_DOCTOR_BUILD,
  ENVIRONMENT_DOCTOR_SCHEMA,
  PROTOCOL_SCHEMA,
  type PeerRole,
} from '@github-decrypter/protocol';
import {
  DESIGN_SYSTEM_BUILD,
  DESIGN_SYSTEM_ID,
  DESIGN_SYSTEM_SCHEMA,
  IDE_LAYOUT_BUILD,
  IDE_LAYOUT_SCHEMA,
} from '@github-decrypter/ui';
import { ADAPTIVE_USER_PROFILE_SCHEMA, ONBOARDING_BUILD } from './onboarding-profile.js';
import { STUDIO_BUILD, STUDIO_LAUNCH_SCHEMA, STUDIO_VERSION } from './studio-context.js';

const protocolRole: PeerRole = 'studio';

export * from './studio-context.js';
export * from './pwa.js';
export * from './onboarding-profile.js';
export * from './environment-doctor-client.js';
export { OnboardingFlow } from './OnboardingFlow.js';
export { EnvironmentDoctor } from './EnvironmentDoctor.js';
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
  onboardingBuild: ONBOARDING_BUILD,
  adaptiveUserProfileSchema: ADAPTIVE_USER_PROFILE_SCHEMA,
  adaptiveProfilePersistence: false as const,
  adaptiveProfileSecurityAuthority: false as const,
  environmentDoctorBuild: ENVIRONMENT_DOCTOR_BUILD,
  environmentDoctorSchema: ENVIRONMENT_DOCTOR_SCHEMA,
  environmentDoctorUserInitiated: true as const,
  diagnosticLocalRuntimeTransport: true as const,
  genericLocalRuntimeTransport: false as const,
  layoutStatePersistence: false as const,
  role: 'Client-only React Studio with PWA shell, design system, IDE workbench, session-only adaptive onboarding and a user-initiated read-only loopback Environment Doctor. Privileged execution and persistence remain outside frontend authority.',
});
