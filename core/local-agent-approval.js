import { assertSafeRepoPath } from './utils.js';

export const LOCAL_AGENT_APPROVAL_SCHEMA = 'ld-local-agent-approval/1';
const WRITE_TOOLS = new Set(['repo.patch_apply', 'repo.write_file']);
const text = (value, max = 100000) => String(value ?? '').slice(0, max);

export function normalizeLocalAgentWriteProposal(tool = '', input = {}) {
  const name = String(tool || '').trim();
  if (!WRITE_TOOLS.has(name)) throw Object.assign(new Error('LOCAL_AGENT_WRITE_TOOL_NOT_ALLOWED'), { code: 'LOCAL_AGENT_WRITE_TOOL_NOT_ALLOWED' });
  const source = input && typeof input === 'object' ? input : {};
  if (name === 'repo.patch_apply') {
    const patches = (Array.isArray(source.patches) ? source.patches : []).slice(0, 30).map(patch => ({
      path: assertSafeRepoPath(patch?.path || ''),
      expectedBlobSha: text(patch?.expectedBlobSha || patch?.expected_blob_sha, 160).trim(),
      edits: (Array.isArray(patch?.edits) ? patch.edits : []).slice(0, 80).map(edit => ({
        search: text(edit?.search, 24000),
        replace: text(edit?.replace, 50000)
      }))
    }));
    if (!patches.length || patches.some(patch => !patch.edits.length)) throw Object.assign(new Error('LOCAL_AGENT_PATCH_PROPOSAL_INVALID'), { code: 'LOCAL_AGENT_PATCH_PROPOSAL_INVALID' });
    return {
      schema: LOCAL_AGENT_APPROVAL_SCHEMA,
      tool: name,
      input: {
        branch: text(source.branch || 'main', 240).trim() || 'main',
        message: text(source.message || 'chore: apply local agent patch', 240).trim(),
        patches
      }
    };
  }

  const path = assertSafeRepoPath(source.path || '');
  const action = ['create','update','delete'].includes(String(source.action || '').toLowerCase()) ? String(source.action).toLowerCase() : 'update';
  return {
    schema: LOCAL_AGENT_APPROVAL_SCHEMA,
    tool: name,
    input: {
      branch: text(source.branch || 'main', 240).trim() || 'main',
      path,
      action,
      expectedBlobSha: text(source.expectedBlobSha || source.expected_blob_sha, 160).trim(),
      content: action === 'delete' ? '' : text(source.content, 2_000_000),
      message: text(source.message || 'chore: apply local agent write', 240).trim()
    }
  };
}

export function localAgentProposalPaths(proposal = {}) {
  const normalized = normalizeLocalAgentWriteProposal(proposal?.tool, proposal?.input || {});
  if (normalized.tool === 'repo.patch_apply') return [...new Set(normalized.input.patches.map(patch => patch.path))];
  return [normalized.input.path];
}

export function localAgentProposalFiles(proposal = {}) {
  const normalized = normalizeLocalAgentWriteProposal(proposal?.tool, proposal?.input || {});
  if (normalized.tool === 'repo.patch_apply') {
    return normalized.input.patches.map(patch => ({ path: patch.path, action: 'update', edits: patch.edits }));
  }
  return [{ path: normalized.input.path, action: normalized.input.action, content: normalized.input.content }];
}

export async function localAgentProposalDigest(proposal = {}) {
  const normalized = normalizeLocalAgentWriteProposal(proposal?.tool, proposal?.input || {});
  const bytes = new TextEncoder().encode(JSON.stringify(normalized));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function localAgentProposalPublic(proposal = {}) {
  const normalized = normalizeLocalAgentWriteProposal(proposal?.tool, proposal?.input || {});
  return {
    schema: LOCAL_AGENT_APPROVAL_SCHEMA,
    tool: normalized.tool,
    paths: localAgentProposalPaths(normalized),
    action: normalized.tool === 'repo.patch_apply' ? 'patch' : normalized.input.action,
    patchCount: normalized.tool === 'repo.patch_apply' ? normalized.input.patches.length : 0,
    editCount: normalized.tool === 'repo.patch_apply' ? normalized.input.patches.reduce((total, patch) => total + patch.edits.length, 0) : 0,
    destructive: normalized.tool === 'repo.write_file' && normalized.input.action === 'delete'
  };
}

export { WRITE_TOOLS as LOCAL_AGENT_WRITE_TOOLS };
