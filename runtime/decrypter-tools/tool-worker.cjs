#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

const VERSION = '2.6.61';
const ROOT_INPUT = process.env.DECRYPTER_WORKSPACE_ROOT || '/workspace';
const WORKSPACE_ID = String(process.env.DECRYPTER_WORKSPACE_ID || '').trim();
const TOKEN = String(process.env.DECRYPTER_TOOL_WORKER_TOKEN || '').trim();
const PORT = Math.max(1, Math.min(65535, Number(process.env.PORT || 8787)));
const MAX_READ_BYTES = Math.max(4096, Math.min(1_000_000, Number(process.env.DECRYPTER_TOOL_MAX_READ_BYTES || 300000)));
const MAX_GREP_FILES = Math.max(10, Math.min(5000, Number(process.env.DECRYPTER_TOOL_MAX_GREP_FILES || 1200)));
const MAX_GREP_MATCHES = Math.max(10, Math.min(500, Number(process.env.DECRYPTER_TOOL_MAX_GREP_MATCHES || 120)));
const MAX_LIST_FILES = Math.max(10, Math.min(5000, Number(process.env.DECRYPTER_TOOL_MAX_LIST_FILES || 1500)));
const LSP_TIMEOUT_MS = Math.max(3000, Math.min(30000, Number(process.env.DECRYPTER_LSP_TIMEOUT_MS || 10000)));
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage']);
const LSP_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const TEXT_EXTENSIONS = new Set(['.js','.jsx','.ts','.tsx','.mts','.cts','.mjs','.cjs','.json','.md','.mdx','.css','.scss','.html','.sql','.toml','.yaml','.yml','.txt','.env','.gitignore']);
const TOOLS = Object.freeze({
  'workspace.list': { readOnly: true, lsp: false },
  'workspace.read': { readOnly: true, lsp: false },
  'workspace.grep': { readOnly: true, lsp: false },
  'lsp.diagnostics': { readOnly: true, lsp: true },
  'lsp.definition': { readOnly: true, lsp: true },
  'lsp.references': { readOnly: true, lsp: true },
});

let ROOT = path.resolve(ROOT_INPUT);
try { ROOT = fs.realpathSync(ROOT); } catch (_) {}

function timingSafeBearer(value, token = TOKEN) {
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const got = Buffer.from(String(value || ''));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

function ensureWorkspace(value) {
  const id = String(value || '').trim();
  if (WORKSPACE_ID && id !== WORKSPACE_ID) throw coded('WORKSPACE_ID_MISMATCH');
  if (!WORKSPACE_ID && id && !/^[A-Za-z0-9._:-]{1,200}$/.test(id)) throw coded('WORKSPACE_ID_INVALID');
  return id || WORKSPACE_ID || 'default';
}

function coded(code, status = 400) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

function safeExistingPath(relative = '') {
  const raw = String(relative || '').replace(/\\/g, '/');
  if (!raw || raw.includes('\0') || raw.startsWith('/') || raw.split('/').includes('..')) throw coded('PATH_INVALID');
  const candidate = path.resolve(ROOT, raw);
  if (!(candidate === ROOT || candidate.startsWith(ROOT + path.sep))) throw coded('PATH_ESCAPE_BLOCKED');
  let real;
  try { real = fs.realpathSync(candidate); } catch (_) { throw coded('PATH_NOT_FOUND', 404); }
  if (!(real === ROOT || real.startsWith(ROOT + path.sep))) throw coded('SYMLINK_ESCAPE_BLOCKED');
  return real;
}

function safeDirectory(relative = '.') {
  if (relative === '.' || relative === '') return ROOT;
  const real = safeExistingPath(relative);
  if (!fs.statSync(real).isDirectory()) throw coded('DIRECTORY_REQUIRED');
  return real;
}

function rel(real) {
  return path.relative(ROOT, real).split(path.sep).join('/');
}

function isTextFile(file) {
  const base = path.basename(file);
  if (base === 'Dockerfile' || base === 'Makefile' || base.startsWith('.env.')) return true;
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function boundedWalk(start, maxFiles = MAX_LIST_FILES, maxDepth = 8) {
  const out = [];
  const queue = [{ dir: start, depth: 0 }];
  while (queue.length && out.length < maxFiles) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    entries.sort((a,b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      const item = { path: rel(full), type: entry.isDirectory() ? 'directory' : 'file' };
      out.push(item);
      if (entry.isDirectory() && depth < maxDepth && !IGNORE_DIRS.has(entry.name)) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return out;
}

function toolList(args = {}) {
  const dir = safeDirectory(String(args.path || '.'));
  const maxFiles = Math.max(1, Math.min(MAX_LIST_FILES, Number(args.max_files || 500)));
  const maxDepth = Math.max(0, Math.min(12, Number(args.max_depth || 6)));
  const entries = boundedWalk(dir, maxFiles, maxDepth);
  return { root: rel(dir) || '.', entries, truncated: entries.length >= maxFiles };
}

function toolRead(args = {}) {
  const file = safeExistingPath(args.path);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw coded('FILE_REQUIRED');
  if (!isTextFile(file)) throw coded('BINARY_FILE_BLOCKED');
  const maxBytes = Math.max(1, Math.min(MAX_READ_BYTES, Number(args.max_bytes || MAX_READ_BYTES)));
  const fd = fs.openSync(file, 'r');
  try {
    const size = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, 0);
    return { path: rel(file), content: buffer.toString('utf8'), bytes: size, truncated: stat.size > size };
  } finally { fs.closeSync(fd); }
}

function toolGrep(args = {}) {
  const query = String(args.query || '');
  if (!query || query.length > 500) throw coded('GREP_QUERY_INVALID');
  const caseSensitive = args.case_sensitive === true;
  const needle = caseSensitive ? query : query.toLowerCase();
  const start = safeDirectory(String(args.path || '.'));
  const maxFiles = Math.max(1, Math.min(MAX_GREP_FILES, Number(args.max_files || MAX_GREP_FILES)));
  const maxMatches = Math.max(1, Math.min(MAX_GREP_MATCHES, Number(args.max_matches || MAX_GREP_MATCHES)));
  const candidates = boundedWalk(start, maxFiles, 12).filter(x => x.type === 'file');
  const matches = [];
  let scanned = 0;
  for (const item of candidates) {
    if (matches.length >= maxMatches) break;
    const full = path.resolve(ROOT, item.path);
    if (!isTextFile(full)) continue;
    let stat;
    try { stat = fs.statSync(full); } catch (_) { continue; }
    if (stat.size > 1_500_000) continue;
    scanned++;
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
      const at = hay.indexOf(needle);
      if (at >= 0) matches.push({ path: item.path, line: i + 1, column: at + 1, preview: lines[i].slice(0, 500) });
    }
  }
  return { query, matches, scanned_files: scanned, truncated: matches.length >= maxMatches };
}

function languageId(file) {
  const ext = path.extname(file).toLowerCase();
  if (['.ts','.mts','.cts'].includes(ext)) return 'typescript';
  if (ext === '.tsx') return 'typescriptreact';
  if (['.js','.mjs','.cjs'].includes(ext)) return 'javascript';
  if (ext === '.jsx') return 'javascriptreact';
  throw coded('LSP_LANGUAGE_NOT_SUPPORTED');
}

class LspSession extends EventEmitter {
  constructor(root = ROOT) {
    super();
    this.root = root;
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
  }

  async start() {
    this.proc = spawn('typescript-language-server', ['--stdio', '--log-level', '1'], { cwd: this.root, stdio: ['pipe','pipe','pipe'], shell: false, env: { ...process.env, HOME: process.env.HOME || '/tmp' } });
    this.proc.stdout.on('data', chunk => this.consume(chunk));
    this.proc.on('exit', code => this.failAll(coded(`LSP_EXIT_${code ?? 'UNKNOWN'}`, 502)));
    this.proc.on('error', err => this.failAll(coded(`LSP_SPAWN_${err.code || 'FAILED'}`, 502)));
    const init = await this.request('initialize', {
      processId: process.pid,
      rootUri: pathToFileURL(this.root).href,
      capabilities: {
        workspace: { configuration: true, workspaceFolders: true },
        textDocument: { publishDiagnostics: { relatedInformation: true }, definition: {}, references: {} }
      },
      workspaceFolders: [{ uri: pathToFileURL(this.root).href, name: path.basename(this.root) || 'workspace' }]
    });
    this.notify('initialized', {});
    return init;
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { this.buffer = this.buffer.subarray(headerEnd + 4); continue; }
      const length = Number(match[1]);
      const end = headerEnd + 4 + length;
      if (this.buffer.length < end) return;
      const body = this.buffer.subarray(headerEnd + 4, end).toString('utf8');
      this.buffer = this.buffer.subarray(end);
      let msg;
      try { msg = JSON.parse(body); } catch (_) { continue; }
      this.handle(msg);
    }
  }

  handle(msg) {
    if (msg && Object.prototype.hasOwnProperty.call(msg, 'id') && (Object.prototype.hasOwnProperty.call(msg, 'result') || Object.prototype.hasOwnProperty.call(msg, 'error'))) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.error) pending.reject(coded(`LSP_ERROR_${msg.error.code || 'UNKNOWN'}`, 502)); else pending.resolve(msg.result);
      return;
    }
    if (msg?.method && Object.prototype.hasOwnProperty.call(msg, 'id')) {
      let result = null;
      if (msg.method === 'workspace/configuration') result = Array.isArray(msg.params?.items) ? msg.params.items.map(() => ({})) : [];
      else if (msg.method === 'workspace/workspaceFolders') result = [{ uri: pathToFileURL(this.root).href, name: path.basename(this.root) || 'workspace' }];
      this.send({ jsonrpc: '2.0', id: msg.id, result });
      return;
    }
    if (msg?.method) this.emit(msg.method, msg.params);
  }

  send(obj) {
    if (!this.proc?.stdin?.writable) throw coded('LSP_NOT_RUNNING', 502);
    const body = JSON.stringify(obj);
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(coded('LSP_TIMEOUT', 504)); }, LSP_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) { this.send({ jsonrpc: '2.0', method, params }); }

  async open(relative) {
    const file = safeExistingPath(relative);
    if (!LSP_EXTENSIONS.has(path.extname(file).toLowerCase())) throw coded('LSP_FILE_NOT_SUPPORTED');
    const text = fs.readFileSync(file, 'utf8');
    if (Buffer.byteLength(text) > MAX_READ_BYTES * 4) throw coded('LSP_FILE_TOO_LARGE');
    const uri = pathToFileURL(file).href;
    this.notify('textDocument/didOpen', { textDocument: { uri, languageId: languageId(file), version: 1, text } });
    return { file, uri, text };
  }

  failAll(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }

  async close() {
    if (!this.proc) return;
    try { await Promise.race([this.request('shutdown', null), new Promise(resolve => setTimeout(resolve, 500))]); } catch (_) {}
    try { this.notify('exit', null); } catch (_) {}
    setTimeout(() => { try { this.proc?.kill('SIGKILL'); } catch (_) {} }, 250).unref();
  }
}

function position(args = {}) {
  const line = Number(args.line);
  const character = Number(args.character ?? args.column);
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(character) || character < 1) throw coded('LSP_POSITION_INVALID');
  return { line: line - 1, character: character - 1 };
}

async function withLsp(args, fn) {
  const session = new LspSession(ROOT);
  try {
    await session.start();
    const doc = await session.open(args.path);
    return await fn(session, doc);
  } finally { await session.close(); }
}

async function lspDiagnostics(args = {}) {
  return withLsp(args, async (session, doc) => {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); resolve({ uri: doc.uri, diagnostics: [], timed_out: true }); }, Math.min(LSP_TIMEOUT_MS, 7000));
      const onDiag = params => {
        if (params?.uri !== doc.uri) return;
        cleanup();
        resolve({ uri: doc.uri, diagnostics: Array.isArray(params.diagnostics) ? params.diagnostics.slice(0, 200) : [], timed_out: false });
      };
      const cleanup = () => { clearTimeout(timer); session.off('textDocument/publishDiagnostics', onDiag); };
      session.on('textDocument/publishDiagnostics', onDiag);
      session.notify('textDocument/didChange', { textDocument: { uri: doc.uri, version: 2 }, contentChanges: [{ text: doc.text }] });
    });
    return { path: rel(doc.file), ...result, uri: undefined };
  });
}

async function lspDefinition(args = {}) {
  return withLsp(args, async (session, doc) => {
    const result = await session.request('textDocument/definition', { textDocument: { uri: doc.uri }, position: position(args) });
    return { path: rel(doc.file), locations: Array.isArray(result) ? result.slice(0, 100) : result ? [result] : [] };
  });
}

async function lspReferences(args = {}) {
  return withLsp(args, async (session, doc) => {
    const result = await session.request('textDocument/references', { textDocument: { uri: doc.uri }, position: position(args), context: { includeDeclaration: args.include_declaration !== false } });
    return { path: rel(doc.file), locations: Array.isArray(result) ? result.slice(0, 200) : [] };
  });
}

async function invokeTool(tool, args = {}) {
  if (!TOOLS[tool]) throw coded('TOOL_NOT_ALLOWLISTED', 403);
  if (tool === 'workspace.list') return toolList(args);
  if (tool === 'workspace.read') return toolRead(args);
  if (tool === 'workspace.grep') return toolGrep(args);
  if (tool === 'lsp.diagnostics') return lspDiagnostics(args);
  if (tool === 'lsp.definition') return lspDefinition(args);
  if (tool === 'lsp.references') return lspReferences(args);
  throw coded('TOOL_NOT_IMPLEMENTED', 501);
}

function json(res, status, body) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'content-length': String(raw.length) });
  res.end(raw);
}

async function handler(req, res) {
  if (!timingSafeBearer(req.headers.authorization)) return json(res, 401, { ok: false, code: 'TOOL_WORKER_AUTH_REQUIRED' });
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, schema: 'ld-tool-worker/1', version: VERSION, workspace_id: WORKSPACE_ID || null, tools: Object.keys(TOOLS), policy: { read_only: true, arbitrary_shell: false, arbitrary_command: false, write_tools: false, raw_output_persistence: false } });
  if (req.method !== 'POST' || req.url !== '/v1/tools/invoke') return json(res, 404, { ok: false, code: 'NOT_FOUND' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) return json(res, 413, { ok: false, code: 'BODY_TOO_LARGE' });
  }
  try {
    const payload = JSON.parse(body || '{}');
    ensureWorkspace(payload.workspace_id);
    const tool = String(payload.tool || '');
    const started = Date.now();
    const result = await invokeTool(tool, payload.args || {});
    return json(res, 200, { ok: true, schema: 'ld-tool-worker/1', tool, duration_ms: Date.now() - started, result, persistence: { raw_output: false } });
  } catch (error) {
    const status = Number(error?.status || 500);
    return json(res, status, { ok: false, code: String(error?.code || error?.message || 'TOOL_FAILED').slice(0,160) });
  }
}

function main() {
  if (!TOKEN) throw new Error('DECRYPTER_TOOL_WORKER_TOKEN is required');
  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) throw new Error('DECRYPTER_WORKSPACE_ROOT must exist');
  const server = http.createServer((req,res) => { handler(req,res).catch(err => json(res, 500, { ok:false, code:String(err?.code || 'INTERNAL_ERROR') })); });
  server.listen(PORT, '0.0.0.0', () => console.log(JSON.stringify({ event: 'ready', schema: 'ld-tool-worker/1', version: VERSION, port: PORT, workspace_id: WORKSPACE_ID || null, read_only: true })));
}

module.exports = { ROOT, TOOLS, timingSafeBearer, ensureWorkspace, safeExistingPath, toolList, toolRead, toolGrep, languageId, position, LspSession, lspDiagnostics, lspDefinition, lspReferences, invokeTool };
if (require.main === module) main();
