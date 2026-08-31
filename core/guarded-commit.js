import { GitAdapter } from '../github/git-adapter.js';
import { prepareShadowBuild, applyShadowBuild } from './shadow-build.js';
import { runRegressionSentinel } from './regression-sentinel.js';
import { runValidationGate } from './validation-gate.js';
import {
  createCheckpoint,
  markCheckpointPublished,
  markCheckpointAborted,
  verifyPublishedCheckpoint,
  autoRollbackIfDefinitiveFailure
} from './checkpoint-manager.js';

const INSTALLED = Symbol.for('ld2.guardedCommit.installed');
const LAST_REFS = Symbol.for('ld2.guardedCommit.lastRefs');
const ACCOUNT_WRITE_GUARD = Symbol.for('ld2.accountIntegration.writeGuard');

function rememberRef(adapter, branch, ref) {
  const sha = String(ref?.object?.sha || '');
  if (!sha) return;
  if (!adapter[LAST_REFS]) adapter[LAST_REFS] = new Map();
  adapter[LAST_REFS].set(String(branch || adapter.branch || 'main'), sha);
}

async function assertAccountWriteGuard(adapter, branch, options = {}) {
  const guard = globalThis[ACCOUNT_WRITE_GUARD];
  if (typeof guard !== 'function') {
    const error = new Error('ACCOUNT_INTEGRATION_GUARD_UNAVAILABLE');
    error.code = 'ACCOUNT_INTEGRATION_GUARD_UNAVAILABLE';
    throw error;
  }
  return guard({
    owner: String(adapter.owner || ''),
    repo: String(adapter.repo || ''),
    branch: String(branch || adapter.branch || 'main'),
    projectId: String(options.projectId || ''),
    fileCount: Array.isArray(options.files) ? options.files.length : 0
  });
}

export function installGuardedCommit() {
  const proto = GitAdapter.prototype;
  if (proto[INSTALLED]) return false;

  const originalGetRef = proto.getRef;
  const originalAtomicCommit = proto.atomicCommit;

  proto.getRef = async function guardedGetRef(branch = this.branch) {
    const resolvedBranch = String(branch || this.branch || 'main');
    const ref = await originalGetRef.call(this, resolvedBranch);
    rememberRef(this, resolvedBranch, ref);
    return ref;
  };

  proto.atomicCommit = async function guardedAtomicCommit(options = {}) {
    const createBranch = options.createBranch !== undefined ? Boolean(options.createBranch) : true;
    const createPr = options.createPr !== undefined ? Boolean(options.createPr) : true;
    const branch = String(options.baseBranch || this.branch || 'main');

    // Build70 account gate is mandatory for every mutating Git path, including
    // legacy branch/PR flows. UI state or a previously-issued approval is never
    // treated as authority for account connectivity.
    await assertAccountWriteGuard(this, branch, options);

    // Preserve legacy branch/PR behavior only after the account gate passes.
    // The authoritative Lovable Decrypter Build/Approve path uses false/false.
    if (createBranch || createPr) return originalAtomicCommit.call(this, options);

    let expectedHeadSha = this[LAST_REFS]?.get(branch) || '';
    if (!expectedHeadSha) {
      const ref = await originalGetRef.call(this, branch);
      expectedHeadSha = String(ref?.object?.sha || '');
      rememberRef(this, branch, ref);
    }
    if (!expectedHeadSha) throw new Error(`GUARDED_COMMIT_BASE_REF_MISSING: ${branch}`);

    const bundle = {
      command: 'authoritative guarded commit',
      baseHeadSha: expectedHeadSha,
      github: { owner: this.owner, repo: this.repo, branch },
      plan: {
        files: Array.isArray(options.files) ? options.files : [],
        commit_message: options.message || 'chore: apply Lovable Decrypter changes',
        summary: options.message || 'Lovable Decrypter changes'
      }
    };

    const shadow = await prepareShadowBuild({ adapter: this, bundle });
    const regressionSentinel = await runRegressionSentinel({ adapter: this, bundle, shadow });
    const validationGate = await runValidationGate({ adapter: this, bundle, shadow });
    const checkpoint = await createCheckpoint({ adapter: this, bundle, shadow });
    let published = false;

    try {
      const result = await applyShadowBuild({ adapter: this, shadow });
      published = true;
      await markCheckpointPublished(checkpoint, result.commitSha || shadow.commitSha);

      let postPublishVerification = null;
      try {
        postPublishVerification = await verifyPublishedCheckpoint({
          adapter: this,
          checkpoint: { ...checkpoint, appliedCommitSha: result.commitSha || shadow.commitSha },
          expectedCommitSha: result.commitSha || shadow.commitSha
        });
      } catch (error) {
        // Falha de rede/leitura não é evidência suficiente para desfazer um commit válido.
        postPublishVerification = {
          ok: false,
          definitive: false,
          reason: 'verification-unavailable',
          message: error?.message || String(error)
        };
      }

      let automaticRollback = { rolledBack: false, verification: postPublishVerification };
      if (!postPublishVerification.ok && postPublishVerification.definitive) {
        automaticRollback = await autoRollbackIfDefinitiveFailure({
          adapter: this,
          checkpoint: { ...checkpoint, appliedCommitSha: result.commitSha || shadow.commitSha },
          verification: postPublishVerification
        });
        const error = new Error(`POST_PUBLISH_VERIFICATION_FAILED: publicação revertida automaticamente (${postPublishVerification.reason}).`);
        error.code = 'POST_PUBLISH_ROLLED_BACK';
        error.checkpoint = checkpoint;
        error.rollback = automaticRollback;
        throw error;
      }

      return {
        ...result,
        guarded: true,
        accountIntegrationGuarded: true,
        checkpoint: {
          id: checkpoint.id,
          baseHeadSha: checkpoint.baseHeadSha,
          baseTreeSha: checkpoint.baseTreeSha,
          appliedCommitSha: result.commitSha || shadow.commitSha,
          postPublishVerification,
          automaticRollback
        },
        shadow: {
          ...(result.shadow || {}),
          commitSha: shadow.commitSha,
          regressionSentinel,
          validationGate
        }
      };
    } catch (error) {
      if (!published) await markCheckpointAborted(checkpoint, error).catch(() => null);
      throw error;
    }
  };

  Object.defineProperty(proto, INSTALLED, { value: true, configurable: false, enumerable: false });
  return true;
}
