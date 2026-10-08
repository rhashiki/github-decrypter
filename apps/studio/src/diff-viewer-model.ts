export const DIFF_VIEWER_BUILD = 74 as const;
export const DIFF_VIEWER_SCHEMA = 'gd-diff-viewer/1' as const;
export const DIFF_VIEWER_MAX_CHARACTERS = 100_000;
export const DIFF_VIEWER_MAX_LINES = 800;
export const DIFF_VIEWER_MAX_HUNKS = 64;

export type DiffRowKind = 'context' | 'added' | 'removed';
export interface DiffRow {
  readonly kind: DiffRowKind;
  readonly oldLine: number | null;
  readonly newLine: number | null;
  readonly text: string;
}
export interface DiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly rows: readonly DiffRow[];
}
export interface DiffResult {
  readonly schema: typeof DIFF_VIEWER_SCHEMA;
  readonly build: typeof DIFF_VIEWER_BUILD;
  readonly unchanged: boolean;
  readonly added: number;
  readonly removed: number;
  readonly originalLines: number;
  readonly modifiedLines: number;
  readonly totalHunks: number;
  readonly truncated: boolean;
  readonly hunks: readonly DiffHunk[];
  readonly authority: 'explicit-user-text-only';
  readonly repositoryAccess: false;
  readonly mutationAuthority: false;
}

function boundedLines(source: string, side: string): string[] {
  if (typeof source !== 'string' || source.length > DIFF_VIEWER_MAX_CHARACTERS) {
    throw new RangeError(side + ' source exceeds the 100,000-character diff limit.');
  }
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > DIFF_VIEWER_MAX_LINES) {
    throw new RangeError(side + ' source exceeds the 800-line diff limit.');
  }
  return lines;
}

/**
 * Bounded deterministic LCS, computed in memory only over explicitly supplied
 * texts. No repository, network, filesystem or mutation authority.
 */
export function compareExplicitTexts(
  before: string,
  after: string,
  options: Readonly<{ context?: number; maxHunks?: number }> = {},
): DiffResult {
  const oldLines = boundedLines(before, 'Original');
  const newLines = boundedLines(after, 'Modified');
  const context = options.context ?? 3;
  const maxHunks = options.maxHunks ?? DIFF_VIEWER_MAX_HUNKS;
  if (!Number.isInteger(context) || context < 0 || context > 12) {
    throw new RangeError('Diff context must be between zero and twelve lines.');
  }
  if (!Number.isInteger(maxHunks) || maxHunks < 1 || maxHunks > DIFF_VIEWER_MAX_HUNKS) {
    throw new RangeError('Diff hunk limit is invalid.');
  }
  const n = oldLines.length;
  const m = newLines.length;
  const stride = m + 1;
  const lcs = new Uint16Array((n + 1) * stride);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const at = i * stride + j;
      lcs[at] = oldLines[i] === newLines[j]
        ? 1 + lcs[(i + 1) * stride + j + 1]!
        : Math.max(lcs[(i + 1) * stride + j]!, lcs[i * stride + j + 1]!);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      rows.push({ kind: 'context', oldLine: i + 1, newLine: j + 1, text: oldLines[i]! });
      i++; j++;
    } else if (i < n && (j === m || lcs[(i + 1) * stride + j]! >= lcs[i * stride + j + 1]!)) {
      rows.push({ kind: 'removed', oldLine: i + 1, newLine: null, text: oldLines[i]! });
      removed++; i++;
    } else {
      rows.push({ kind: 'added', oldLine: null, newLine: j + 1, text: newLines[j]! });
      added++; j++;
    }
  }
  const ranges: { start: number; end: number }[] = [];
  for (let k = 0; k < rows.length; k++) {
    if (rows[k]!.kind === 'context') continue;
    const start = Math.max(0, k - context);
    const end = Math.min(rows.length, k + context + 1);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous.end) previous.end = Math.max(end, previous.end);
    else ranges.push({ start, end });
  }
  const oldPrefix = new Uint16Array(rows.length + 1);
  const newPrefix = new Uint16Array(rows.length + 1);
  for (let k = 0; k < rows.length; k++) {
    oldPrefix[k + 1] = oldPrefix[k]! + (rows[k]!.oldLine === null ? 0 : 1);
    newPrefix[k + 1] = newPrefix[k]! + (rows[k]!.newLine === null ? 0 : 1);
  }
  const hunks = ranges.slice(0, maxHunks).map(({ start, end }) => {
    const oldCount = oldPrefix[end]! - oldPrefix[start]!;
    const newCount = newPrefix[end]! - newPrefix[start]!;
    return Object.freeze({
      oldStart: oldPrefix[start]! + (oldCount ? 1 : 0),
      oldCount,
      newStart: newPrefix[start]! + (newCount ? 1 : 0),
      newCount,
      rows: Object.freeze(rows.slice(start, end)),
    });
  });
  return Object.freeze({
    schema: DIFF_VIEWER_SCHEMA,
    build: DIFF_VIEWER_BUILD,
    unchanged: added === 0 && removed === 0,
    added, removed,
    originalLines: n, modifiedLines: m,
    totalHunks: ranges.length,
    truncated: ranges.length > maxHunks,
    hunks: Object.freeze(hunks),
    authority: 'explicit-user-text-only',
    repositoryAccess: false,
    mutationAuthority: false,
  });
}

/** Unified text is an exportable preview, not a patch application request. */
export function unifiedDiffPreview(result: DiffResult, oldLabel = 'original', newLabel = 'modified'): string {
  const safeLabel = (value: string) => value.replace(/[\r\n\t]/g, ' ').slice(0, 100);
  const lines = ['--- ' + safeLabel(oldLabel), '+++ ' + safeLabel(newLabel)];
  for (const hunk of result.hunks) {
    lines.push('@@ -' + hunk.oldStart + ',' + hunk.oldCount
      + ' +' + hunk.newStart + ',' + hunk.newCount + ' @@');
    for (const row of hunk.rows) {
      lines.push((row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' ') + row.text);
    }
  }
  if (result.truncated) lines.push('# Preview truncated: ' + result.totalHunks + ' hunks; ' + result.hunks.length + ' shown.');
  return lines.join('\n');
}
