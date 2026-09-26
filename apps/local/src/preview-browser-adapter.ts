import {
  PREVIEW_MAX_INLINE_BYTES,
  normalizePreviewTimeout,
  normalizePreviewUrl,
  normalizePreviewViewport,
  normalizeVisualEvidenceRequest,
  type PreviewDownloadResult,
  type PreviewPageState,
  type PreviewSessionDescriptor,
  type PreviewTabDescriptor,
  type PreviewUploadResult,
  type PreviewViewport,
  type VisualEvidence,
  type VisualEvidenceRequest,
} from '@github-decrypter/preview';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, delimiter, join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

export interface BrowserAdapterLaunchOptions {
  readonly profileDir: string;
  readonly viewport: PreviewViewport;
  readonly executablePath?: string;
  readonly now: () => string;
}

export interface BrowserAdapterSession {
  readonly descriptor: PreviewSessionDescriptor;
  openTab(url: string): Promise<PreviewTabDescriptor>;
  closeTab(tabId: string): Promise<void>;
  navigate(tabId: string, url: string, timeoutMs?: number): Promise<PreviewTabDescriptor>;
  pageState(tabId: string): Promise<PreviewPageState>;
  capture(tabId: string, request: VisualEvidenceRequest): Promise<VisualEvidence>;
  upload(tabId: string, selector: string, fileName: string, bytes: Uint8Array): Promise<PreviewUploadResult>;
  download(tabId: string, selector: string, timeoutMs?: number): Promise<PreviewDownloadResult>;
  close(): Promise<void>;
}

export interface PreviewBrowserAdapter {
  readonly family: 'chromium';
  launch(options: BrowserAdapterLaunchOptions): Promise<BrowserAdapterSession>;
}

interface TargetInfo {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly url: string;
  readonly webSocketDebuggerUrl?: string;
}

interface CdpResponse {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: { readonly code?: number; readonly message?: string };
}

interface WebSocketLike {
  readonly readyState: number;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (event: any) => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (event: any) => void): void;
  send(data: string): void;
  close(): void;
}

type WebSocketConstructor = new (url: string) => WebSocketLike;

class CdpClient {
  readonly #socket: WebSocketLike;
  #nextId = 1;
  readonly #pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  readonly #waiters = new Map<string, Set<{ resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>>();

  private constructor(socket: WebSocketLike) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => this.#message(event));
    socket.addEventListener('close', () => this.#rejectAll(new Error('CDP connection closed.')));
    socket.addEventListener('error', () => this.#rejectAll(new Error('CDP connection failed.')));
  }

  static async connect(url: string, timeoutMs = 5_000): Promise<CdpClient> {
    const Constructor = (globalThis as unknown as { WebSocket?: WebSocketConstructor }).WebSocket;
    if (typeof Constructor !== 'function') throw new Error('This Node runtime does not provide a WebSocket client.');
    const socket = new Constructor(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to CDP.')), timeoutMs);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Failed to connect to CDP.')); }, { once: true });
    });
    return new CdpClient(socket);
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.#nextId++;
    const promise = new Promise<unknown>((resolve, reject) => this.#pending.set(id, { resolve, reject }));
    this.#socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async waitFor(method: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters.get(method)?.delete(waiter);
        reject(new Error('Timed out waiting for CDP event ' + method + '.'));
      }, timeoutMs);
      const waiter = { resolve, reject, timer };
      const set = this.#waiters.get(method) ?? new Set();
      set.add(waiter);
      this.#waiters.set(method, set);
    });
  }

  close(): void {
    this.#socket.close();
    this.#rejectAll(new Error('CDP client closed.'));
  }

  #message(event: any): void {
    if (typeof event?.data !== 'string') return;
    let message: CdpResponse;
    try { message = JSON.parse(event.data) as CdpResponse; } catch { return; }
    if (typeof message.id === 'number') {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'CDP command failed.'));
      else pending.resolve(message.result);
      return;
    }
    if (message.method) {
      const waiters = this.#waiters.get(message.method);
      if (!waiters) return;
      this.#waiters.delete(message.method);
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve(message.params);
      }
    }
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    for (const waiters of this.#waiters.values()) {
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    }
    this.#waiters.clear();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function browserCandidates(): readonly string[] {
  const env = process.env.VORTEX_CHROMIUM_PATH?.trim();
  const pathEntries = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const platformNames = process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe', 'chromium.exe']
    : process.platform === 'darwin'
      ? ['Google Chrome', 'Chromium', 'Microsoft Edge']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const candidates = new Set<string>();
  if (env) candidates.add(env);
  for (const dir of pathEntries) for (const name of platformNames) candidates.add(join(dir, name));
  if (process.platform === 'win32') {
    for (const root of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean) as string[]) {
      candidates.add(join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.add(join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.add('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.add('/Applications/Chromium.app/Contents/MacOS/Chromium');
    candidates.add('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    for (const path of ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/snap/bin/chromium']) candidates.add(path);
  }
  return Object.freeze([...candidates]);
}

export function detectLocalChromiumExecutable(explicit?: string): string {
  const candidates = explicit ? [explicit] : browserCandidates();
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('No compatible local Chromium/Chrome executable was found. Set VORTEX_CHROMIUM_PATH explicitly.');
  }
  return found;
}

async function waitForDevToolsPort(profileDir: string, processHandle: ChildProcess, timeoutMs = 10_000): Promise<{ port: number; browserPath: string }> {
  const activePort = join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error('Chromium exited before exposing DevTools.');
    if (existsSync(activePort)) {
      const [portLine, browserPath = ''] = readFileSync(activePort, 'utf8').split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0 && port <= 65535) return { port, browserPath };
    }
    await sleep(50);
  }
  throw new Error('Timed out waiting for Chromium DevTools endpoint.');
}

async function fetchJson(origin: string, path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(origin + path, init);
  if (!response.ok) throw new Error('Chromium DevTools HTTP request failed with status ' + response.status + '.');
  return response.json();
}

async function fetchOk(origin: string, path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(origin + path, init);
  if (!response.ok) throw new Error('Chromium DevTools HTTP request failed with status ' + response.status + '.');
}

async function targetClient(origin: string, tabId: string): Promise<{ client: CdpClient; target: TargetInfo }> {
  const targets = await fetchJson(origin, '/json/list') as TargetInfo[];
  const target = targets.find((item) => item.id === tabId && item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('Preview tab is not available through CDP.');
  return { client: await CdpClient.connect(target.webSocketDebuggerUrl), target };
}

async function setViewport(client: CdpClient, viewport: PreviewViewport): Promise<void> {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.width <= 480,
  });
}

async function nodeForSelector(client: CdpClient, selector: string, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await client.send('DOM.getDocument', { depth: 1, pierce: true });
    const nodeId = Number((await client.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector })).nodeId ?? 0);
    if (nodeId > 0) return nodeId;
    await sleep(80);
  }
  throw new Error('Timed out waiting for selector: ' + selector);
}

function quadBounds(quad: readonly number[]): { x: number; y: number; width: number; height: number } {
  if (quad.length < 8) throw new Error('CDP returned an invalid element box.');
  const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!];
  const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function safeTransferName(value: string): string {
  const normalized = basename(value.trim()).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.length > 180) throw new TypeError('Preview transfer file name is invalid.');
  return normalized;
}

async function terminateProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    sleep(1_500).then(() => undefined),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

export function createChromiumCdpAdapter(): PreviewBrowserAdapter {
  return Object.freeze({
    family: 'chromium' as const,
    async launch(options: BrowserAdapterLaunchOptions): Promise<BrowserAdapterSession> {
      const executablePath = detectLocalChromiumExecutable(options.executablePath);
      const viewport = normalizePreviewViewport(options.viewport);
      mkdirSync(options.profileDir, { recursive: true });
      const downloadDir = join(options.profileDir, 'downloads');
      const uploadDir = join(options.profileDir, 'uploads');
      mkdirSync(downloadDir, { recursive: true });
      mkdirSync(uploadDir, { recursive: true });

      const child = spawn(executablePath, [
        '--headless=new',
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        '--user-data-dir=' + options.profileDir,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-sync',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-default-apps',
        '--metrics-recording-only',
        '--password-store=basic',
        '--use-mock-keychain',
        '--hide-scrollbars',
        'about:blank',
      ], { stdio: 'ignore', windowsHide: true });

      const endpoint = await waitForDevToolsPort(options.profileDir, child);
      const origin = 'http://127.0.0.1:' + endpoint.port;
      const sessionId = 'preview-session-' + randomUUID();
      const createdAt = options.now();
      const tabs = new Map<string, PreviewTabDescriptor>();
      let closed = false;

      const descriptor = (): PreviewSessionDescriptor => Object.freeze({
        schema: 'gd-preview-session/1',
        build: 68,
        id: sessionId,
        status: 'ready',
        browserFamily: 'chromium',
        browserExecutable: executablePath,
        isolatedProfile: true,
        profilePersistence: false,
        createdAt,
        viewport,
        tabIds: Object.freeze([...tabs.keys()].sort()),
        toolRuntimeRequired: true,
        scopeLockRequiredForMutation: true,
        deterministicCleanup: true,
      });

      async function openTab(urlValue: string): Promise<PreviewTabDescriptor> {
        if (closed) throw new Error('Preview browser session is closed.');
        const url = normalizePreviewUrl(urlValue);
        const target = await fetchJson(origin, '/json/new?' + encodeURIComponent(url), { method: 'PUT' }) as TargetInfo;
        if (!target.id) throw new Error('Chromium did not create a page target.');
        const pair = await targetClient(origin, target.id);
        try {
          await setViewport(pair.client, viewport);
          await pair.client.send('Page.enable');
        } finally {
          pair.client.close();
        }
        const tab = Object.freeze({
          schema: 'gd-preview-tab/1' as const,
          build: 68 as const,
          id: target.id,
          sessionId,
          status: 'open' as const,
          url,
          title: target.title ?? '',
          createdAt: options.now(),
        });
        tabs.set(tab.id, tab);
        return tab;
      }

      async function closeTab(tabId: string): Promise<void> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        await fetchOk(origin, '/json/close/' + encodeURIComponent(tabId));
        tabs.delete(tabId);
      }

      async function navigate(tabId: string, urlValue: string, timeoutValue?: number): Promise<PreviewTabDescriptor> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        const url = normalizePreviewUrl(urlValue);
        const timeoutMs = normalizePreviewTimeout(timeoutValue);
        const { client } = await targetClient(origin, tabId);
        try {
          await client.send('Page.enable');
          await setViewport(client, viewport);
          const load = client.waitFor('Page.loadEventFired', timeoutMs);
          const result = await client.send('Page.navigate', { url });
          if (result.errorText) throw new Error('Preview navigation failed: ' + result.errorText);
          await load;
          const state = await pageState(tabId);
          const tab = Object.freeze({
            schema: 'gd-preview-tab/1' as const,
            build: 68 as const,
            id: tabId,
            sessionId,
            status: 'open' as const,
            url: state.url,
            title: state.title,
            createdAt: tabs.get(tabId)!.createdAt,
          });
          tabs.set(tabId, tab);
          return tab;
        } finally {
          client.close();
        }
      }

      async function pageState(tabId: string): Promise<PreviewPageState> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        const { client } = await targetClient(origin, tabId);
        try {
          await client.send('Page.enable');
          await client.send('Runtime.enable');
          await setViewport(client, viewport);
          const evaluated = await client.send('Runtime.evaluate', {
            expression: "({url:location.href,title:document.title,readyState:document.readyState,scrollX:window.scrollX,scrollY:window.scrollY})",
            returnByValue: true,
            awaitPromise: false,
          });
          const value = evaluated?.result?.value ?? {};
          const metrics = await client.send('Page.getLayoutMetrics');
          const ax = await client.send('Accessibility.getFullAXTree', {});
          return Object.freeze({
            schema: 'gd-preview-page-state/1',
            build: 68,
            sessionId,
            tabId,
            url: normalizePreviewUrl(String(value.url ?? tabs.get(tabId)!.url)),
            title: String(value.title ?? ''),
            readyState: String(value.readyState ?? 'unknown'),
            viewport,
            document: Object.freeze({
              width: Math.max(0, Math.round(Number(metrics?.cssContentSize?.width ?? metrics?.contentSize?.width ?? viewport.width))),
              height: Math.max(0, Math.round(Number(metrics?.cssContentSize?.height ?? metrics?.contentSize?.height ?? viewport.height))),
              scrollX: Math.round(Number(value.scrollX ?? 0)),
              scrollY: Math.round(Number(value.scrollY ?? 0)),
            }),
            accessibilityNodeCount: Array.isArray(ax?.nodes) ? ax.nodes.length : 0,
            capturedAt: options.now(),
            readOnlyEvidence: true,
            arbitraryScriptExecution: false,
          });
        } finally {
          client.close();
        }
      }

      async function capture(tabId: string, rawRequest: VisualEvidenceRequest): Promise<VisualEvidence> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        const request = normalizeVisualEvidenceRequest(rawRequest);
        const { client } = await targetClient(origin, tabId);
        try {
          await client.send('Page.enable');
          await client.send('DOM.enable');
          await setViewport(client, viewport);
          await client.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: request.darkMode ? 'dark' : 'light' }],
          });
          let clip: { x: number; y: number; width: number; height: number; scale: number } | undefined;
          if (request.mode === 'full-page') {
            const metrics = await client.send('Page.getLayoutMetrics');
            const size = metrics?.cssContentSize ?? metrics?.contentSize;
            clip = { x: 0, y: 0, width: Number(size?.width ?? viewport.width), height: Number(size?.height ?? viewport.height), scale: 1 };
          } else if (request.mode === 'selector') {
            const nodeId = await nodeForSelector(client, request.selector!, request.timeoutMs!);
            const box = await client.send('DOM.getBoxModel', { nodeId });
            const bounds = quadBounds(box?.model?.border ?? box?.model?.content ?? []);
            clip = { ...bounds, scale: 1 };
          }
          const screenshot = await client.send('Page.captureScreenshot', {
            format: request.format,
            ...(request.quality === undefined ? {} : { quality: request.quality }),
            fromSurface: true,
            captureBeyondViewport: request.mode !== 'viewport',
            ...(clip ? { clip } : {}),
          });
          const dataBase64 = String(screenshot?.data ?? '');
          const bytes = Buffer.from(dataBase64, 'base64').byteLength;
          if (!dataBase64 || bytes > PREVIEW_MAX_INLINE_BYTES) throw new RangeError('Visual Evidence exceeds the inline evidence byte limit.');
          const state = await pageState(tabId);
          return Object.freeze({
            schema: 'gd-visual-evidence/1',
            build: 68,
            sessionId,
            tabId,
            url: state.url,
            mode: request.mode,
            format: request.format,
            selector: request.selector ?? null,
            viewport,
            width: Math.round(clip?.width ?? viewport.width),
            height: Math.round(clip?.height ?? viewport.height),
            bytes,
            dataBase64,
            capturedAt: options.now(),
            readOnly: true,
            inline: true,
            persisted: false,
            interactionAuthority: false,
            validationAuthority: false,
          });
        } finally {
          client.close();
        }
      }

      async function upload(tabId: string, selector: string, fileName: string, bytes: Uint8Array): Promise<PreviewUploadResult> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        if (bytes.byteLength > PREVIEW_MAX_INLINE_BYTES) throw new RangeError('Preview upload exceeds the inline byte limit.');
        const safeName = safeTransferName(fileName);
        const path = join(uploadDir, randomUUID() + '-' + safeName);
        writeFileSync(path, bytes, { flag: 'wx' });
        const { client } = await targetClient(origin, tabId);
        try {
          await client.send('DOM.enable');
          const nodeId = await nodeForSelector(client, selector, 10_000);
          await client.send('DOM.setFileInputFiles', { nodeId, files: [path] });
          return Object.freeze({
            schema: 'gd-preview-transfer/1',
            build: 68,
            direction: 'upload',
            sessionId,
            tabId,
            selector,
            fileName: safeName,
            bytes: bytes.byteLength,
            temporaryOnly: true,
            persistedToProject: false,
          });
        } finally {
          client.close();
          rmSync(path, { force: true });
        }
      }

      async function download(tabId: string, selector: string, timeoutValue?: number): Promise<PreviewDownloadResult> {
        if (!tabs.has(tabId)) throw new Error('Unknown Preview tab.');
        const timeoutMs = normalizePreviewTimeout(timeoutValue);
        const before = new Set(readdirSync(downloadDir));
        const { client } = await targetClient(origin, tabId);
        try {
          await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
          await client.send('DOM.enable');
          const nodeId = await nodeForSelector(client, selector, timeoutMs);
          const box = await client.send('DOM.getBoxModel', { nodeId });
          const bounds = quadBounds(box?.model?.border ?? box?.model?.content ?? []);
          const x = bounds.x + Math.max(1, bounds.width / 2);
          const y = bounds.y + Math.max(1, bounds.height / 2);
          await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

          const deadline = Date.now() + timeoutMs;
          let chosen: string | null = null;
          let lastSize = -1;
          let stable = 0;
          while (Date.now() < deadline) {
            const files = readdirSync(downloadDir).filter((name) => !before.has(name) && !name.endsWith('.crdownload'));
            if (files.length > 0) {
              chosen = files.sort()[0]!;
              const size = statSync(join(downloadDir, chosen)).size;
              stable = size === lastSize ? stable + 1 : 0;
              lastSize = size;
              if (stable >= 2) break;
            }
            await sleep(100);
          }
          if (!chosen || stable < 2) throw new Error('Preview download did not complete before timeout.');
          const path = join(downloadDir, chosen);
          const bytes = readFileSync(path);
          rmSync(path, { force: true });
          if (bytes.byteLength > PREVIEW_MAX_INLINE_BYTES) throw new RangeError('Preview download exceeds the inline byte limit.');
          return Object.freeze({
            schema: 'gd-preview-transfer/1',
            build: 68,
            direction: 'download',
            sessionId,
            tabId,
            fileName: safeTransferName(chosen),
            bytes: bytes.byteLength,
            dataBase64: bytes.toString('base64'),
            temporaryOnly: true,
            persistedToProject: false,
          });
        } finally {
          client.close();
        }
      }

      return Object.freeze({
        get descriptor() { return descriptor(); },
        openTab,
        closeTab,
        navigate,
        pageState,
        capture,
        upload,
        download,
        async close() {
          if (closed) return;
          closed = true;
          for (const tabId of [...tabs.keys()]) {
            try { await fetchOk(origin, '/json/close/' + encodeURIComponent(tabId)); } catch {}
          }
          tabs.clear();
          await terminateProcess(child);
          rmSync(options.profileDir, { recursive: true, force: true });
        },
      });
    },
  });
}
