import { assertSafeRepoPath, isSensitivePath, isTextPath } from './utils.js';
import { beginOperation, finishOperation, listOperationJournal, ORIGINS } from './operation-journal.js';
import { applyTextPatch, normalizePatchPlan, renderPatchPreview, sha256Text } from './patch-engine.js';

const DEFAULT_MAX_READ_BYTES = 750_000;
const DEFAULT_MAX_GREP_FILES = 80;
const DEFAULT_MAX_GREP_MATCHES = 200;

function text(value) { return String(value ?? ''); }
function toolError(code, message, details = {}) {
  const error = new Error(message || code);
  error.code = code;
  Object.assign(error, details || {});
  return error;
}

function globToRegExp(pattern = '**') {
  const source = text(pattern || '**').trim().replace(/\\/g, '/');
  if (source.length > 500) throw toolError('GLOB_TOO_LONG', 'Padrão glob excede o limite seguro.');
  let out = '^';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '*' && next === '*') {
      out += '.*';
      i += 1;
    } else if (char === '*') out += '[^/]*';
    else if (char === '?') out += '[^/]';
    else out += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  out += '$';
  return new RegExp(out);
}

function matchesGlob(path, pattern) {
  if (!pattern || pattern === '**' || pattern === '*') return true;
  return globToRegExp(pattern).test(text(path).replace(/^\/+/, ''));
}

function safeOrigin(value = 'tool') {
  const origin = text(value || 'tool').toLowerCase();
  return ORIGINS.has(origin) ? origin : 'tool';
}

function normalizeAllowedPaths(paths = []) {
  return [...new Set((Array.isArray(paths) ? paths : [])
    .map(value => text(value).trim().replace(/^\/+/, ''))
    .filter(Boolean))].slice(0, 200);
}

function pathAllowed(path, allowedPaths) {
  const safe = assertSafeRepoPath(path);
  const allowed = normalizeAllowedPaths(allowedPaths);
  if (!allowed.length) return false;
  return allowed.some(pattern => matchesGlob(safe, pattern) || safe === pattern || safe.startsWith(`${pattern.replace(/\/$/, '')}/`));
}

function requireWriteAuthorization(paths, authorization = {}) {
  if (authorization?.writeApproved !== true) {
    throw toolError('TOOL_WRITE_APPROVAL_REQUIRED', 'Escrita bloqueada: aprovação explícita não foi fornecida.');
  }
  const allowedPaths = normalizeAllowedPaths(authorization?.allowedPaths);
  const rejected = (Array.isArray(paths) ? paths : [paths]).filter(path => !pathAllowed(path, allowedPaths));
  if (rejected.length) {
    throw toolError('TOOL_SCOPE_LOCK_REJECTED', `Escrita fora do escopo autorizado: ${rejected.join(', ')}`, { paths: rejected });
  }
}

function assertReadablePath(path) {
  const safe = assertSafeRepoPath(path);
  if (isSensitivePath(safe)) throw toolError('TOOL_SENSITIVE_PATH_BLOCKED', `Leitura de caminho sensível bloqueada: ${safe}`, { path: safe });
  return safe;
}

async function treeFiles(adapter, branch, glob = '**') {
  const tree = await adapter.getTree(branch, true);
  return (Array.isArray(tree?.tree) ? tree.tree : [])
    .filter(entry => entry?.type === 'blob' && entry?.path && matchesGlob(entry.path, glob))
    .map(entry => ({ path: entry.path, sha: entry.sha || '', size: Number(entry.size || 0) || 0, mode: entry.mode || '' }));
}

async function currentTreeEntry(adapter, branch, path) {
  const safePath = assertSafeRepoPath(path);
  const files = await treeFiles(adapter, branch, safePath);
  return files.find(file => file.path === safePath) || null;
}

function compactCompare(compare = {}, includePatch = false) {
  const files = (Array.isArray(compare?.files) ? compare.files : []).slice(0, 300).map(file => ({
    path: text(file?.filename).slice(0, 1000),
    status: text(file?.status).slice(0, 60),
    additions: Number(file?.additions || 0) || 0,
    deletions: Number(file?.deletions || 0) || 0,
    changes: Number(file?.changes || 0) || 0,
    patch: includePatch ? text(file?.patch).slice(0, 12000) : ''
  }));
  return {
    status: text(compare?.status).slice(0, 80),
    aheadBy: Number(compare?.ahead_by || 0) || 0,
    behindBy: Number(compare?.behind_by || 0) || 0,
    totalCommits: Number(compare?.total_commits || 0) || 0,
    files
  };
}

export class ToolRuntime {
  constructor({ adapter, diagnosticsAdapter = null, lspAdapter = null, context = {} } = {}) {
    if (!adapter) throw new Error('TOOL_RUNTIME_ADAPTER_REQUIRED');
    this.adapter = adapter;
    this.diagnosticsAdapter = diagnosticsAdapter;
    this.lspAdapter = lspAdapter;
    this.context = context || {};
    this.registry = new Map();
    this.installBuiltins();
  }

  register(definition = {}) {
    const name = text(definition?.name).trim();
    if (!name || typeof definition?.run !== 'function') throw new Error('TOOL_DEFINITION_INVALID');
    if (this.registry.has(name)) throw new Error(`TOOL_ALREADY_REGISTERED: ${name}`);
    const mode = definition?.mode === 'write' ? 'write' : 'read';
    this.registry.set(name, Object.freeze({
      name,
      mode,
      description: text(definition?.description).slice(0, 1000),
      capability: text(definition?.capability).slice(0, 120),
      run: definition.run
    }));
  }

  list() {
    return [...this.registry.values()].map(({ run, ...tool }) => ({ ...tool }));
  }

  async invoke(name, input = {}, options = {}) {
    const tool = this.registry.get(text(name).trim());
    if (!tool) throw toolError('TOOL_NOT_FOUND', `Ferramenta não registrada: ${name}`);
    const origin = safeOrigin(options?.origin || input?.origin || 'tool');
    const operation = await beginOperation({
      tool: tool.name,
      mode: tool.mode,
      origin,
      input,
      context: { ...this.context, ...(options?.context || {}) }
    });
    try {
      const data = await tool.run.call(this, input || {}, { ...options, origin, operation });
      const result = {
        ok: true,
        schema: 'ld-tool-result/1',
        tool: tool.name,
        mode: tool.mode,
        operationId: operation.id,
        data
      };
      await finishOperation(operation, {
        status: 'ok',
        changes: data?.changes || [],
        result: {
          code: data?.code || 'OK',
          branch: data?.branch || '',
          commitSha: data?.commitSha || '',
          matchCount: data?.matchCount || 0,
          fileCount: data?.fileCount || data?.files?.length || 0
        }
      });
      return result;
    } catch (error) {
      await finishOperation(operation, { status: 'failed', error }).catch(() => null);
      error.operationId = operation.id;
      throw error;
    }
  }

  installBuiltins() {
    this.register({
      name: 'repo.list_files',
      mode: 'read',
      description: 'Lista arquivos do repositório por glob sem ler conteúdo.',
      run: async function(input) {
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const glob = text(input?.glob || '**');
        const limit = Math.max(1, Math.min(2000, Number(input?.limit || 500)));
        const files = (await treeFiles(this.adapter, branch, glob)).slice(0, limit);
        return { code: 'OK', branch, glob, files, fileCount: files.length };
      }
    });

    this.register({
      name: 'repo.read_file',
      mode: 'read',
      description: 'Lê um arquivo textual não sensível do repositório.',
      run: async function(input) {
        const path = assertReadablePath(input?.path || '');
        if (!isTextPath(path)) throw toolError('TOOL_NON_TEXT_PATH_BLOCKED', `Arquivo não textual bloqueado: ${path}`, { path });
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const maxBytes = Math.max(1000, Math.min(2_000_000, Number(input?.maxBytes || DEFAULT_MAX_READ_BYTES)));
        const file = await this.adapter.getFileByPath(path, branch);
        const content = text(file?.text);
        if (new TextEncoder().encode(content).byteLength > maxBytes) {
          throw toolError('TOOL_READ_LIMIT_EXCEEDED', `Arquivo excede o limite de leitura: ${path}`, { path, maxBytes });
        }
        return { code: 'OK', branch, path, blobSha: text(file?.sha), content, bytes: new TextEncoder().encode(content).byteLength };
      }
    });

    this.register({
      name: 'repo.grep',
      mode: 'read',
      description: 'Busca texto literal em arquivos textuais do repositório.',
      run: async function(input) {
        const query = text(input?.query);
        if (!query || query.length > 500) throw toolError('GREP_QUERY_INVALID', 'Consulta grep vazia ou acima do limite.');
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const glob = text(input?.glob || '**');
        const caseSensitive = input?.caseSensitive === true;
        const maxFiles = Math.max(1, Math.min(200, Number(input?.maxFiles || DEFAULT_MAX_GREP_FILES)));
        const maxMatches = Math.max(1, Math.min(1000, Number(input?.maxMatches || DEFAULT_MAX_GREP_MATCHES)));
        const candidates = (await treeFiles(this.adapter, branch, glob))
          .filter(file => isTextPath(file.path) && !isSensitivePath(file.path) && (!file.size || file.size <= DEFAULT_MAX_READ_BYTES))
          .slice(0, maxFiles);
        const needle = caseSensitive ? query : query.toLowerCase();
        const matches = [];
        for (const file of candidates) {
          if (matches.length >= maxMatches) break;
          const content = text(await this.adapter.getBlob(file.sha));
          const lines = content.split('\n');
          for (let index = 0; index < lines.length && matches.length < maxMatches; index += 1) {
            const haystack = caseSensitive ? lines[index] : lines[index].toLowerCase();
            const column = haystack.indexOf(needle);
            if (column >= 0) matches.push({
              path: file.path,
              line: index + 1,
              column: column + 1,
              preview: lines[index].slice(0, 1000)
            });
          }
        }
        return { code: 'OK', branch, query, glob, matches, matchCount: matches.length, fileCount: candidates.length, truncated: matches.length >= maxMatches };
      }
    });

    this.register({
      name: 'repo.git_diff',
      mode: 'read',
      description: 'Compara dois refs/commits Git e retorna diff compacto.',
      run: async function(input) {
        const base = text(input?.base).trim();
        const head = text(input?.head || this.adapter.branch || 'main').trim();
        if (!base || !head) throw toolError('GIT_DIFF_REFS_REQUIRED', 'Base e head são obrigatórios para Git diff.');
        if (typeof this.adapter.compareCommits !== 'function') throw toolError('TOOL_CAPABILITY_UNAVAILABLE', 'Adaptador Git não oferece compareCommits.');
        const compare = await this.adapter.compareCommits(base, head);
        return { code: 'OK', base, head, ...compactCompare(compare, input?.includePatch === true) };
      }
    });

    this.register({
      name: 'repo.patch_preview',
      mode: 'read',
      description: 'Aplica patches em memória e retorna hashes/diff sem gravar.',
      run: async function(input) {
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const patches = normalizePatchPlan(input);
        const previews = [];
        for (const patch of patches) {
          const path = assertReadablePath(patch.path);
          if (!isTextPath(path)) throw toolError('TOOL_NON_TEXT_PATH_BLOCKED', `Patch em arquivo não textual bloqueado: ${path}`, { path });
          const file = await this.adapter.getFileByPath(path, branch);
          const applied = await applyTextPatch({ path, currentText: file?.text || '', currentBlobSha: file?.sha || '', patch });
          previews.push({
            path,
            beforeBlobSha: file?.sha || '',
            beforeHash: applied.beforeHash,
            afterHash: applied.afterHash,
            lineDelta: applied.lineDelta,
            editCount: applied.editCount,
            changed: applied.changed,
            preview: renderPatchPreview(file?.text || '', applied.content)
          });
        }
        return { code: 'OK', branch, files: previews, fileCount: previews.length };
      }
    });

    this.register({
      name: 'repo.patch_apply',
      mode: 'write',
      description: 'Aplica patches textuais exatos com stale/ambiguity checks e commit guardado.',
      run: async function(input, options) {
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const patches = normalizePatchPlan(input);
        requireWriteAuthorization(patches.map(patch => patch.path), options?.authorization || input?.authorization || {});
        const files = [];
        const changes = [];
        for (const patch of patches) {
          const path = assertReadablePath(patch.path);
          if (!isTextPath(path)) throw toolError('TOOL_NON_TEXT_PATH_BLOCKED', `Patch em arquivo não textual bloqueado: ${path}`, { path });
          const file = await this.adapter.getFileByPath(path, branch);
          const applied = await applyTextPatch({ path, currentText: file?.text || '', currentBlobSha: file?.sha || '', patch });
          if (!applied.changed) continue;
          files.push({ path, action: 'update', content: applied.content });
          changes.push({
            path,
            action: 'update',
            origin: options?.origin || 'ai',
            beforeHash: applied.beforeHash,
            afterHash: applied.afterHash,
            beforeBlobSha: file?.sha || ''
          });
        }
        if (!files.length) throw toolError('PATCH_NO_CHANGES', 'O patch não produz alterações.');
        const message = text(input?.message || 'chore: apply Decrypter tool patch').slice(0, 240);
        const result = await this.adapter.atomicCommit({ files, message, baseBranch: branch, createBranch: false, createPr: false });
        return { code: 'OK', branch: result?.branch || branch, commitSha: result?.commitSha || '', commitUrl: result?.commitUrl || '', changes, fileCount: files.length, guarded: result?.guarded === true, checkpoint: result?.checkpoint || null };
      }
    });

    this.register({
      name: 'repo.write_file',
      mode: 'write',
      description: 'Cria, substitui ou remove um arquivo textual com optimistic concurrency e aprovação explícita.',
      run: async function(input, options) {
        const branch = text(input?.branch || this.adapter.branch || 'main');
        const path = assertSafeRepoPath(input?.path || '');
        if (isSensitivePath(path)) throw toolError('TOOL_SENSITIVE_PATH_BLOCKED', `Escrita de caminho sensível bloqueada: ${path}`, { path });
        if (!isTextPath(path)) throw toolError('TOOL_NON_TEXT_PATH_BLOCKED', `Escrita de arquivo não textual bloqueada: ${path}`, { path });
        requireWriteAuthorization([path], options?.authorization || input?.authorization || {});
        const action = ['create', 'update', 'delete'].includes(text(input?.action).toLowerCase()) ? text(input.action).toLowerCase() : 'update';
        const entry = await currentTreeEntry(this.adapter, branch, path);
        if (action === 'create' && entry) throw toolError('WRITE_FILE_ALREADY_EXISTS', `Arquivo já existe: ${path}`, { path });
        if (action !== 'create' && !entry) throw toolError('WRITE_FILE_NOT_FOUND', `Arquivo não existe: ${path}`, { path });
        const expectedBlobSha = text(input?.expectedBlobSha).trim();
        if (action !== 'create' && !expectedBlobSha) throw toolError('WRITE_EXPECTED_BLOB_REQUIRED', `expectedBlobSha é obrigatório para ${action}: ${path}`, { path });
        if (action !== 'create' && expectedBlobSha !== entry.sha) throw toolError('WRITE_STALE_BLOB', `Arquivo mudou desde a leitura: ${path}`, { path, expectedBlobSha, currentBlobSha: entry.sha });

        let beforeText = '';
        let afterText = '';
        if (entry) beforeText = text(await this.adapter.getBlob(entry.sha));
        if (action !== 'delete') {
          if (typeof input?.content !== 'string') throw toolError('WRITE_CONTENT_REQUIRED', `Conteúdo ausente: ${path}`, { path });
          afterText = input.content;
        }
        const beforeHash = await sha256Text(beforeText);
        const afterHash = await sha256Text(afterText);
        if (action === 'update' && beforeHash === afterHash) throw toolError('WRITE_NO_CHANGES', `Nenhuma alteração em ${path}.`, { path });

        const files = action === 'delete' ? [{ path, action: 'delete' }] : [{ path, action, content: afterText }];
        const message = text(input?.message || `chore: ${action} ${path}`).slice(0, 240);
        const result = await this.adapter.atomicCommit({ files, message, baseBranch: branch, createBranch: false, createPr: false });
        const changes = [{
          path,
          action,
          origin: options?.origin || 'ai',
          beforeHash,
          afterHash,
          beforeBlobSha: entry?.sha || ''
        }];
        return { code: 'OK', branch: result?.branch || branch, commitSha: result?.commitSha || '', commitUrl: result?.commitUrl || '', changes, fileCount: 1, guarded: result?.guarded === true, checkpoint: result?.checkpoint || null };
      }
    });

    this.register({
      name: 'diagnostics.run',
      mode: 'read',
      capability: 'diagnostics',
      description: 'Executa diagnósticos reais quando um adaptador de diagnóstico está disponível.',
      run: async function(input) {
        if (!this.diagnosticsAdapter || typeof this.diagnosticsAdapter.run !== 'function') {
          throw toolError('TOOL_CAPABILITY_UNAVAILABLE', 'Diagnósticos indisponíveis neste runtime; nenhum resultado sintético será fabricado.');
        }
        return this.diagnosticsAdapter.run(input || {});
      }
    });

    this.register({
      name: 'lsp.query',
      mode: 'read',
      capability: 'lsp',
      description: 'Consulta LSP real quando o host expõe essa capacidade.',
      run: async function(input) {
        if (!this.lspAdapter || typeof this.lspAdapter.query !== 'function') {
          throw toolError('TOOL_CAPABILITY_UNAVAILABLE', 'LSP indisponível neste runtime; nenhum resultado sintético será fabricado.');
        }
        return this.lspAdapter.query(input || {});
      }
    });
  }
}

export async function toolJournal(filters = {}) { return listOperationJournal(filters); }
export { matchesGlob, requireWriteAuthorization };
