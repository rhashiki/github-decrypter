import { useState, type ChangeEvent } from 'react';
import {
  compareExplicitTexts,
  unifiedDiffPreview,
  DIFF_VIEWER_MAX_CHARACTERS,
  type DiffResult,
} from './diff-viewer-model.js';

type Side = 'original' | 'modified';
const initialOriginal = "export function greet(name: string) {\n  return 'Hello, ' + name;\n}\n";
const initialModified = "export function greet(name: string) {\n  return 'Welcome, ' + name;\n}\n";

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message.slice(0, 240) : 'Comparison failed.';
}

export function DiffViewer() {
  const [original, setOriginal] = useState(initialOriginal);
  const [modified, setModified] = useState(initialModified);
  const [originalLabel, setOriginalLabel] = useState('original.ts');
  const [modifiedLabel, setModifiedLabel] = useState('modified.ts');
  const [context, setContext] = useState(3);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  function change(side: Side, value: string) {
    if (side === 'original') setOriginal(value); else setModified(value);
    setResult(null); setError(null);
  }
  function compare() {
    try {
      const computed = compareExplicitTexts(original, modified, { context });
      setResult(computed); setError(null);
    } catch (cause) {
      setResult(null); setError(message(cause));
    }
  }
  async function selectFile(side: Side, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || busy) return;
    setBusy(true); setResult(null); setError(null);
    try {
      if (file.size > 400000) throw new RangeError('Selected file exceeds 400 KB.');
      if (!/\.(?:[cm]?[jt]s|[jt]sx|json|css|html|md|txt)$/i.test(file.name)) {
        throw new TypeError('Select a text, code, Markdown, JSON, CSS or HTML file.');
      }
      const content = await file.text();
      if (content.length > DIFF_VIEWER_MAX_CHARACTERS || content.includes('\0')) {
        throw new RangeError('Selected file exceeds the text limit or contains binary data.');
      }
      change(side, content);
      if (side === 'original') setOriginalLabel(file.name.slice(0, 100));
      else setModifiedLabel(file.name.slice(0, 100));
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  function swapSides() {
    setOriginal(modified); setModified(original);
    setOriginalLabel(modifiedLabel); setModifiedLabel(originalLabel);
    setResult(null); setError(null);
  }
  function reset() {
    setOriginal(''); setModified(''); setOriginalLabel('original'); setModifiedLabel('modified');
    setResult(null); setError(null);
  }
  const textPreview = result ? unifiedDiffPreview(result, originalLabel, modifiedLabel) : '';
  return (
    <section className="diffv" aria-labelledby="diffv-title">
      <header className="diffv-heading">
        <div>
          <small>Build 74 · Comparison workspace</small>
          <h1 id="diffv-title">Diff Viewer</h1>
          <p>Compare two explicitly supplied local texts. Nothing is uploaded, saved, applied or committed.</p>
        </div>
        <span className="diffv-readonly">READ ONLY</span>
      </header>
      <div className="diffv-toolbar">
        <label htmlFor="diffv-context">Context lines</label>
        <select id="diffv-context" value={context} onChange={e => { setContext(Number(e.target.value)); setResult(null); }}>
          <option value={0}>0</option><option value={3}>3</option><option value={6}>6</option><option value={12}>12</option>
        </select>
        <button type="button" onClick={swapSides} disabled={busy}>Swap sides</button>
        <button type="button" onClick={reset} disabled={busy}>Clear</button>
        <button className="diffv-primary" type="button" onClick={compare} disabled={busy}>Compare texts</button>
      </div>
      <div className="diffv-inputs">
        {(['original', 'modified'] as const).map(side => {
          const label = side === 'original' ? originalLabel : modifiedLabel;
          const content = side === 'original' ? original : modified;
          return (
            <div className="diffv-side" key={side}>
              <div className="diffv-side-heading">
                <label htmlFor={'diffv-' + side}>{side === 'original' ? 'Original' : 'Modified'}</label>
                <label className="diffv-file">
                  Choose text file
                  <input aria-label={'Choose ' + side + ' local file'} type="file" accept=".js,.jsx,.mjs,.cjs,.ts,.tsx,.mts,.cts,.json,.css,.html,.md,.txt,text/plain"
                    onChange={e => { void selectFile(side, e); }} disabled={busy} />
                </label>
              </div>
              <div className="diffv-name" title={label}>{label}</div>
              <textarea id={'diffv-' + side} spellCheck={false} value={content}
                maxLength={DIFF_VIEWER_MAX_CHARACTERS + 1}
                onChange={e => change(side, e.target.value)}
                aria-label={side === 'original' ? 'Original text' : 'Modified text'}
              />
              <div className="diffv-count">{content.length.toLocaleString()} / {DIFF_VIEWER_MAX_CHARACTERS.toLocaleString()} characters</div>
            </div>
          );
        })}
      </div>
      {error && <div className="diffv-error" role="alert">{error}</div>}
      {result && (
        <div className="diffv-results" aria-live="polite">
          <div className="diffv-summary">
            <strong>{result.unchanged ? 'No changes' : result.totalHunks + ' change groups'}</strong>
            <span className="diffv-add">+{result.added} added</span>
            <span className="diffv-del">−{result.removed} removed</span>
            <span>{result.originalLines} → {result.modifiedLines} lines</span>
          </div>
          {result.truncated && <div className="diffv-error" role="status">Showing only {result.hunks.length} of {result.totalHunks} groups. This preview is incomplete.</div>}
          {result.unchanged && <p className="diffv-unchanged">The supplied texts have no line changes.</p>}
          {!result.unchanged && (
            <div className="diffv-hunks" aria-label="Unified changes">
              {result.hunks.map((hunk, index) => (
                <div className="diffv-hunk" key={index}>
                  <div className="diffv-hunk-head">
                    {'@@ -' + hunk.oldStart + ',' + hunk.oldCount + ' +' + hunk.newStart + ',' + hunk.newCount + ' @@'}
                  </div>
                  <div className="diffv-lines">
                    {hunk.rows.map((row, rowIndex) => (
                      <div className={'diffv-row diffv-' + row.kind} key={rowIndex}>
                        <span className="diffv-lineno">{row.oldLine ?? ''}</span>
                        <span className="diffv-lineno">{row.newLine ?? ''}</span>
                        <span className="diffv-marker">{row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}</span>
                        <code>{row.text || ' '}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <details className="diffv-export">
            <summary>View unified text preview</summary>
            <textarea readOnly aria-label="Unified diff preview" value={textPreview} rows={Math.min(20, Math.max(4, textPreview.split('\n').length))} />
            <small>Read-only display. Truncated previews are not complete patches.</small>
          </details>
        </div>
      )}
    </section>
  );
}
