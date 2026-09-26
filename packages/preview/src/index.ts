export const packageIdentity = '@github-decrypter/preview' as const;
export const PREVIEW_RUNTIME_BUILD = 68 as const;
export const PREVIEW_RUNTIME_SCHEMA = 'gd-preview-runtime/1' as const;
export const PREVIEW_SESSION_SCHEMA = 'gd-preview-session/1' as const;
export const PREVIEW_TAB_SCHEMA = 'gd-preview-tab/1' as const;
export const PREVIEW_PAGE_STATE_SCHEMA = 'gd-preview-page-state/1' as const;
export const VISUAL_EVIDENCE_SCHEMA = 'gd-visual-evidence/1' as const;
export const PREVIEW_TRANSFER_SCHEMA = 'gd-preview-transfer/1' as const;

export const PREVIEW_MAX_SESSIONS = 8 as const;
export const PREVIEW_MAX_TABS_PER_SESSION = 16 as const;
export const PREVIEW_MAX_INLINE_BYTES = 16 * 1024 * 1024 as const;
export const PREVIEW_MAX_SELECTOR_LENGTH = 1024 as const;
export const PREVIEW_MAX_URL_LENGTH = 4096 as const;
export const PREVIEW_DEFAULT_TIMEOUT_MS = 15_000 as const;
export const PREVIEW_MAX_TIMEOUT_MS = 60_000 as const;

export const PREVIEW_CAPTURE_FORMATS = Object.freeze(['png', 'jpeg', 'webp'] as const);
export const PREVIEW_CAPTURE_MODES = Object.freeze(['viewport', 'full-page', 'selector'] as const);
export const PREVIEW_VIEWPORT_PRESETS = Object.freeze({
  desktop: Object.freeze({ width: 1440, height: 900, deviceScaleFactor: 1 }),
  tablet: Object.freeze({ width: 1024, height: 1366, deviceScaleFactor: 1 }),
  mobile: Object.freeze({ width: 390, height: 844, deviceScaleFactor: 1 }),
} as const);

export type PreviewCaptureFormat = (typeof PREVIEW_CAPTURE_FORMATS)[number];
export type PreviewCaptureMode = (typeof PREVIEW_CAPTURE_MODES)[number];
export type PreviewViewportPreset = keyof typeof PREVIEW_VIEWPORT_PRESETS;

export interface PreviewViewport {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
}

export interface PreviewSessionDescriptor {
  readonly schema: typeof PREVIEW_SESSION_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly id: string;
  readonly status: 'ready';
  readonly browserFamily: 'chromium';
  readonly browserExecutable: string;
  readonly isolatedProfile: true;
  readonly profilePersistence: false;
  readonly createdAt: string;
  readonly viewport: PreviewViewport;
  readonly tabIds: readonly string[];
  readonly toolRuntimeRequired: true;
  readonly scopeLockRequiredForMutation: true;
  readonly deterministicCleanup: true;
}

export interface PreviewTabDescriptor {
  readonly schema: typeof PREVIEW_TAB_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly id: string;
  readonly sessionId: string;
  readonly status: 'open';
  readonly url: string;
  readonly title: string;
  readonly createdAt: string;
}

export interface PreviewPageState {
  readonly schema: typeof PREVIEW_PAGE_STATE_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly sessionId: string;
  readonly tabId: string;
  readonly url: string;
  readonly title: string;
  readonly readyState: string;
  readonly viewport: PreviewViewport;
  readonly document: {
    readonly width: number;
    readonly height: number;
    readonly scrollX: number;
    readonly scrollY: number;
  };
  readonly accessibilityNodeCount: number;
  readonly capturedAt: string;
  readonly readOnlyEvidence: true;
  readonly arbitraryScriptExecution: false;
}

export interface VisualEvidenceRequest {
  readonly mode: PreviewCaptureMode;
  readonly format: PreviewCaptureFormat;
  readonly selector?: string;
  readonly quality?: number;
  readonly darkMode?: boolean;
  readonly timeoutMs?: number;
}

export interface VisualEvidence {
  readonly schema: typeof VISUAL_EVIDENCE_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly sessionId: string;
  readonly tabId: string;
  readonly url: string;
  readonly mode: PreviewCaptureMode;
  readonly format: PreviewCaptureFormat;
  readonly selector: string | null;
  readonly viewport: PreviewViewport;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly dataBase64: string;
  readonly capturedAt: string;
  readonly readOnly: true;
  readonly inline: true;
  readonly persisted: false;
  readonly interactionAuthority: false;
  readonly validationAuthority: false;
}

export interface PreviewUploadInput {
  readonly selector: string;
  readonly fileName: string;
  readonly mediaType: string;
  readonly dataBase64: string;
}

export interface PreviewUploadResult {
  readonly schema: typeof PREVIEW_TRANSFER_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly direction: 'upload';
  readonly sessionId: string;
  readonly tabId: string;
  readonly selector: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly temporaryOnly: true;
  readonly persistedToProject: false;
}

export interface PreviewDownloadInput {
  readonly selector: string;
  readonly timeoutMs?: number;
}

export interface PreviewDownloadResult {
  readonly schema: typeof PREVIEW_TRANSFER_SCHEMA;
  readonly build: typeof PREVIEW_RUNTIME_BUILD;
  readonly direction: 'download';
  readonly sessionId: string;
  readonly tabId: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly dataBase64: string;
  readonly temporaryOnly: true;
  readonly persistedToProject: false;
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new TypeError(label + ' is invalid.');
  }
  return Number(value);
}

export function normalizePreviewTimeout(value: unknown): number {
  if (value === undefined) return PREVIEW_DEFAULT_TIMEOUT_MS;
  return boundedInteger(value, 'Preview timeout', 100, PREVIEW_MAX_TIMEOUT_MS);
}

export function normalizePreviewSelector(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Preview selector must be a string.');
  const selector = value.trim();
  if (!selector || selector.length > PREVIEW_MAX_SELECTOR_LENGTH || /[\u0000-\u001f\u007f]/.test(selector)) {
    throw new TypeError('Preview selector is invalid.');
  }
  return selector;
}

export function normalizePreviewUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Preview URL must be a string.');
  const raw = value.trim();
  if (!raw || raw.length > PREVIEW_MAX_URL_LENGTH) throw new TypeError('Preview URL is invalid.');
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new TypeError('Preview URL is invalid.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('Preview URL must use http or https.');
  }
  if (parsed.username || parsed.password) throw new TypeError('Preview URL must not embed credentials.');
  return parsed.toString();
}

export function previewUrlScopeResource(value: unknown): string {
  return 'preview-url:' + normalizePreviewUrl(value);
}
export function previewBrowserScopeResource(): string {
  return 'preview-browser:session';
}
export function previewTabScopeResource(): string {
  return 'preview-browser:tab';
}
export function previewUploadScopeResource(selector: unknown): string {
  return 'preview-upload:' + normalizePreviewSelector(selector);
}
export function previewDownloadScopeResource(selector: unknown): string {
  return 'preview-download:' + normalizePreviewSelector(selector);
}

export function normalizePreviewViewport(value: unknown): PreviewViewport {
  if (typeof value === 'string' && value in PREVIEW_VIEWPORT_PRESETS) {
    return PREVIEW_VIEWPORT_PRESETS[value as PreviewViewportPreset];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Preview viewport must be a preset or object.');
  }
  const row = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['deviceScaleFactor','height','width'])) {
    throw new TypeError('Preview viewport accepts only width, height and deviceScaleFactor.');
  }
  return Object.freeze({
    width: boundedInteger(row.width, 'Preview viewport width', 240, 7680),
    height: boundedInteger(row.height, 'Preview viewport height', 240, 7680),
    deviceScaleFactor: boundedInteger(row.deviceScaleFactor, 'Preview deviceScaleFactor', 1, 4),
  });
}

export function normalizeVisualEvidenceRequest(value: unknown): VisualEvidenceRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Visual Evidence request must be an object.');
  const row = value as Record<string, unknown>;
  const mode = row.mode;
  const format = row.format;
  if (!(PREVIEW_CAPTURE_MODES as readonly unknown[]).includes(mode)) throw new TypeError('Visual Evidence mode is invalid.');
  if (!(PREVIEW_CAPTURE_FORMATS as readonly unknown[]).includes(format)) throw new TypeError('Visual Evidence format is invalid.');
  const selector = mode === 'selector' ? normalizePreviewSelector(row.selector) : undefined;
  if (mode !== 'selector' && row.selector !== undefined) throw new TypeError('Visual Evidence selector is only valid in selector mode.');
  let quality: number | undefined;
  if (format === 'jpeg' || format === 'webp') {
    quality = row.quality === undefined ? 90 : boundedInteger(row.quality, 'Visual Evidence quality', 1, 100);
  } else if (row.quality !== undefined) {
    throw new TypeError('PNG Visual Evidence does not accept quality.');
  }
  if (row.darkMode !== undefined && typeof row.darkMode !== 'boolean') throw new TypeError('Visual Evidence darkMode must be boolean.');
  const timeoutMs = normalizePreviewTimeout(row.timeoutMs);
  return Object.freeze({
    mode: mode as PreviewCaptureMode,
    format: format as PreviewCaptureFormat,
    ...(selector ? { selector } : {}),
    ...(quality === undefined ? {} : { quality }),
    ...(row.darkMode === undefined ? {} : { darkMode: row.darkMode }),
    timeoutMs,
  });
}

export function decodePreviewInlineData(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new TypeError('Preview inline payload must be canonical base64.');
  }
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > PREVIEW_MAX_INLINE_BYTES) throw new RangeError('Preview inline payload exceeds the byte limit.');
  return bytes;
}
