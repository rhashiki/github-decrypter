import { asPeerId, PROTOCOL_SCHEMA, type ProtocolPeer } from '@github-decrypter/protocol';
import { randomUUID } from 'node:crypto';

export const LOCAL_RUNTIME_BUILD = 21 as const;
export const LOCAL_RUNTIME_VERSION = '0.0.21' as const;
export const LOCAL_RUNTIME_FEATURES = [
  'loopback-http','health','readiness','protocol-handshake','persistent-sqlite','schema-migrations',
  'durable-jobs','job-dependencies','job-leases','crash-recovery','runtime-sessions','lease-recovery',
  'offline-execution','connectivity-state','network-wait-resume','capability-security','deny-by-default',
  'scoped-capability-grants','secrets-vault','encrypted-secret-storage','capability-gated-secrets',
  'approval-transactions','one-shot-approval-receipts','payload-bound-approvals',
  'audit-ledger','append-only-audit','sha256-audit-chain','audit-integrity-verification',
  'workspace-manager','workspace-registry','workspace-path-boundary','workspace-realpath-containment',
  'project-detection','package-manager-detection','framework-detection','dev-command-detection','read-only-project-inspection',
  'git-runtime','git-status','git-diff','git-log','git-branches','git-merge-base','git-blame',
  'git-clone','git-fetch','git-pull','git-checkout','git-commit','git-push','git-stash','git-restore',
  'git-write-capability','network-gated-git','no-force-push','no-shell-git-execution',
] as const;

export function createLocalRuntimePeer(): ProtocolPeer {
  return { id: asPeerId(`gd_peer_local_${randomUUID()}`), role: 'local-runtime', product: 'github-decrypter', productVersion: LOCAL_RUNTIME_VERSION };
}

export const localRuntimeIdentity = Object.freeze({
  id: 'local', packageName: '@github-decrypter/local', product: 'GitHub Decrypter',
  build: LOCAL_RUNTIME_BUILD, version: LOCAL_RUNTIME_VERSION,
  protocolRole: 'local-runtime' as const, protocolSchema: PROTOCOL_SCHEMA,
  authority: 'Independent local daemon lifecycle, durable execution, capability security, encrypted Secrets Vault, one-shot Approval Transactions, append-only Audit Ledger, local Workspace Manager, read-only Project Detection and capability-gated Git Runtime.',
});
