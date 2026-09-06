import { asPeerId, PROTOCOL_SCHEMA, type ProtocolPeer } from '@github-decrypter/protocol';
import { randomUUID } from 'node:crypto';

export const LOCAL_RUNTIME_BUILD = 35 as const;
export const LOCAL_RUNTIME_VERSION = '0.0.35' as const;
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
  'human-ai-change-tracking','explicit-ai-change-boundaries','path-level-change-attribution',
  'change-provenance-digests','fail-closed-change-origin',
  'github-app','github-app-jwt','github-installation-token','github-webhook-hmac',
  'github-installation-metadata','github-webhook-replay-metadata','no-github-token-persistence',
  'github-provider','github-repository-discovery','github-repository-metadata','github-branch-discovery',
  'github-provider-read-only','github-provider-installation-scoped','no-github-provider-response-cache',
  'environment-doctor','environment-doctor-read-only','environment-doctor-metadata-only',
  'local-ai-runtime','local-ai-provider-discovery','local-ai-model-discovery','capability-gated-ai-execution',
  'local-ai-construction-only-adapters','no-local-ai-prompt-persistence','no-local-ai-response-persistence',
  'no-external-ai-execution','no-ai-network-authority','no-ai-secret-authority','no-ai-automatic-routing',
  'local-ai-installer','local-ai-installer-discovery','capability-gated-model-installation','conditional-network-installation',
  'ollama-compatible-installer-family','vllm-compatible-installer-family','custom-local-installer-family',
  'no-arbitrary-model-source-url','no-installer-secret-authority','no-installer-state-persistence',
  'no-model-removal','no-model-update','no-model-default-selection','no-installer-automatic-routing',
] as const;

export function createLocalRuntimePeer(): ProtocolPeer {
  return { id: asPeerId(`gd_peer_local_${randomUUID()}`), role: 'local-runtime', product: 'github-decrypter', productVersion: LOCAL_RUNTIME_VERSION };
}

export const localRuntimeIdentity = Object.freeze({
  id: 'local', packageName: '@github-decrypter/local', product: 'GitHub Decrypter',
  build: LOCAL_RUNTIME_BUILD, version: LOCAL_RUNTIME_VERSION,
  protocolRole: 'local-runtime' as const, protocolSchema: PROTOCOL_SCHEMA,
  authority: 'Independent local daemon lifecycle, durable execution, capability security, encrypted Secrets Vault, one-shot Approval Transactions, append-only Audit Ledger, local Workspace Manager, read-only Project Detection, capability-gated Git Runtime, explicit Human vs AI Change Tracking, GitHub App authentication/webhook trust, installation-scoped read-only GitHub Provider, read-only metadata-only Environment Doctor, capability-gated local-only AI execution, and explicit local model installation through construction-time provider-neutral installer adapters with conditional network authority; model management and routing remain later authorities.',
});