import { GitAdapter } from '../github/git-adapter.js';
import { prepareShadowBuild, applyShadowBuild } from './shadow-build.js';
import { runRegressionSentinel } from './regression-sentinel.js';

const INSTALLED = Symbol.for('ld2.guardedCommit.installed');
const LAST_REFS = Symbol.for('ld2.guardedCommit.lastRefs');

function rememberRef(adapter, branch, ref) {
  const sha = String(ref?.object?.sha || '');
  if (!sha) return;
  if (!adapter[LAST_REFS]) adapter[LAST_REFS] = new Map();
  adapter[LAST_REFS].set(String(branch || adapter.branch || 'main'), sha);
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

    // Preserve legacy branch/PR behavior for flows that explicitly request it.
    // The authoritative Lovable Decrypter Build/Approve path uses false/false.
    if (createBranch || createPr) return originalAtomicCommit.call(this, options);

    const branch = String(options.baseBranch || this.branch || 'main');
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
    const result = await applyShadowBuild({ adapter: this, shadow });

    return {
      ...result,
      guarded: true,
      shadow: {
        ...(result.shadow || {}),
        commitSha: shadow.commitSha,
        regressionSentinel
      }
    };
  };

  Object.defineProperty(proto, INSTALLED, { value: true, configurable: false, enumerable: false });
  return true;
}
