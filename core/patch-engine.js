import { assertSafeRepoPath } from './utils.js';

function text(value) { return String(value ?? ''); }

export async function sha256Text(value = '') {
  const bytes = new TextEncoder().encode(text(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= source.length) {
    const index = source.indexOf(needle, from);
    if (index < 0) break;
    count += 1;
    from = index + Math.max(1, needle.length);
  }
  return count;
}

function replaceOccurrence(source, before, after, occurrence) {
  let from = 0;
  let current = 0;
  while (from <= source.length) {
    const index = source.indexOf(before, from);
    if (index < 0) break;
    current += 1;
    if (current === occurrence) return source.slice(0, index) + after + source.slice(index + before.length);
    from = index + Math.max(1, before.length);
  }
  return null;
}

export function normalizePatchPlan(plan = {}) {
  const patches = Array.isArray(plan?.patches) ? plan.patches : [];
  if (!patches.length) throw Object.assign(new Error('PATCH_PLAN_EMPTY'), { code: 'PATCH_PLAN_EMPTY' });
  return patches.map((patch, index) => {
    const path = assertSafeRepoPath(patch?.path || '');
    const edits = Array.isArray(patch?.edits) ? patch.edits : [];
    if (!edits.length) throw Object.assign(new Error(`PATCH_EDITS_EMPTY: ${path}`), { code: 'PATCH_EDITS_EMPTY', path, index });
    return {
      path,
      baseBlobSha: text(patch?.baseBlobSha).trim(),
      baseHash: text(patch?.baseHash).trim().toLowerCase(),
      edits: edits.map((edit, editIndex) => {
        const before = text(edit?.before);
        const after = text(edit?.after);
        const occurrence = edit?.occurrence == null ? null : Number(edit.occurrence);
        if (!before) throw Object.assign(new Error(`PATCH_EMPTY_MATCH: ${path}`), { code: 'PATCH_EMPTY_MATCH', path, editIndex });
        if (occurrence != null && (!Number.isInteger(occurrence) || occurrence < 1)) {
          throw Object.assign(new Error(`PATCH_OCCURRENCE_INVALID: ${path}`), { code: 'PATCH_OCCURRENCE_INVALID', path, editIndex });
        }
        return { before, after, occurrence };
      })
    };
  });
}

export async function applyTextPatch({ path = '', currentText = '', currentBlobSha = '', patch = {} } = {}) {
  const safePath = assertSafeRepoPath(path || patch?.path || '');
  const beforeText = text(currentText);
  const expectedBlobSha = text(patch?.baseBlobSha).trim();
  if (expectedBlobSha && expectedBlobSha !== text(currentBlobSha).trim()) {
    const error = new Error(`PATCH_STALE_BLOB: ${safePath}`);
    error.code = 'PATCH_STALE_BLOB';
    error.path = safePath;
    throw error;
  }

  const beforeHash = await sha256Text(beforeText);
  const expectedHash = text(patch?.baseHash).trim().toLowerCase();
  if (expectedHash && expectedHash !== beforeHash) {
    const error = new Error(`PATCH_STALE_CONTENT: ${safePath}`);
    error.code = 'PATCH_STALE_CONTENT';
    error.path = safePath;
    throw error;
  }

  let next = beforeText;
  const edits = Array.isArray(patch?.edits) ? patch.edits : [];
  if (!edits.length) {
    const error = new Error(`PATCH_EDITS_EMPTY: ${safePath}`);
    error.code = 'PATCH_EDITS_EMPTY';
    error.path = safePath;
    throw error;
  }

  for (let index = 0; index < edits.length; index += 1) {
    const edit = edits[index] || {};
    const before = text(edit.before);
    const after = text(edit.after);
    if (!before) {
      const error = new Error(`PATCH_EMPTY_MATCH: ${safePath}`);
      error.code = 'PATCH_EMPTY_MATCH';
      error.path = safePath;
      error.editIndex = index;
      throw error;
    }

    const matches = countOccurrences(next, before);
    if (!matches) {
      const error = new Error(`PATCH_MATCH_NOT_FOUND: ${safePath}`);
      error.code = 'PATCH_MATCH_NOT_FOUND';
      error.path = safePath;
      error.editIndex = index;
      throw error;
    }

    const occurrence = edit.occurrence == null ? null : Number(edit.occurrence);
    if (occurrence == null && matches !== 1) {
      const error = new Error(`PATCH_AMBIGUOUS_MATCH: ${safePath} (${matches})`);
      error.code = 'PATCH_AMBIGUOUS_MATCH';
      error.path = safePath;
      error.editIndex = index;
      error.matches = matches;
      throw error;
    }
    if (occurrence != null && (!Number.isInteger(occurrence) || occurrence < 1 || occurrence > matches)) {
      const error = new Error(`PATCH_OCCURRENCE_OUT_OF_RANGE: ${safePath}`);
      error.code = 'PATCH_OCCURRENCE_OUT_OF_RANGE';
      error.path = safePath;
      error.editIndex = index;
      error.matches = matches;
      throw error;
    }

    const selected = occurrence || 1;
    const replaced = replaceOccurrence(next, before, after, selected);
    if (replaced == null) {
      const error = new Error(`PATCH_APPLY_FAILED: ${safePath}`);
      error.code = 'PATCH_APPLY_FAILED';
      error.path = safePath;
      throw error;
    }
    next = replaced;
  }

  const afterHash = await sha256Text(next);
  const beforeLines = beforeText.split('\n').length;
  const afterLines = next.split('\n').length;
  return {
    path: safePath,
    content: next,
    changed: next !== beforeText,
    beforeHash,
    afterHash,
    beforeBlobSha: text(currentBlobSha).trim(),
    lineDelta: afterLines - beforeLines,
    editCount: edits.length
  };
}

export function changedWindow(before = '', after = '', maxLines = 18) {
  const oldLines = text(before).split('\n');
  const newLines = text(after).split('\n');
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start += 1;
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd -= 1; newEnd -= 1; }
  const limit = Math.max(4, Math.min(80, Number(maxLines || 18)));
  return {
    prefix: oldLines.slice(Math.max(0, start - 2), start),
    removed: oldLines.slice(start, Math.min(oldEnd + 1, start + limit)),
    added: newLines.slice(start, Math.min(newEnd + 1, start + limit)),
    suffix: newLines.slice(Math.max(start, newEnd + 1), Math.min(newLines.length, newEnd + 3)),
    truncated: oldEnd - start + 1 > limit || newEnd - start + 1 > limit
  };
}

export function renderPatchPreview(before = '', after = '', maxChars = 12000) {
  const part = changedWindow(before, after);
  const lines = [];
  part.prefix.forEach(line => lines.push(`  ${line}`));
  part.removed.forEach(line => lines.push(`- ${line}`));
  part.added.forEach(line => lines.push(`+ ${line}`));
  part.suffix.forEach(line => lines.push(`  ${line}`));
  if (part.truncated) lines.push('  … diff resumido …');
  return lines.join('\n').slice(0, Math.max(1000, Math.min(30000, Number(maxChars || 12000))));
}
