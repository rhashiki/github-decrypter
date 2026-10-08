import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import {
  CODE_INTELLIGENCE_MAX_FILE_CHARS,
  CODE_INTELLIGENCE_MAX_TOTAL_CHARS,
  buildCodeIntelligenceIndex,
  buildCodeDependencyGraph,
  queryCodeIntelligence,
  resolveCodeSemantics,
  type CodeFileInput,
  type CodeIntelligenceQuery,
  type CodeSemanticRequest,
} from '@github-decrypter/code-intelligence';
import { asWorkspaceId } from '@github-decrypter/workspace';
import {
  TOOL_RUNTIME_SCHEMA,
  type ToolDescriptor,
  type ToolExecutionContext,
  type ToolRegistration,
  type ToolValue,
} from '@github-decrypter/tools';
import type { ScopeLockRecord } from '@github-decrypter/scope/lock';
import type { WorkspaceManager } from './workspace-manager.js';

export const CODE_INTELLIGENCE_TOOL_ID = 'code-intelligence.query' as const;
const MAX_FILES_PER_READ = 64;
const MAX_PATH = 2048;
const SOURCE_SUFFIX = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const EXCLUDED = new Set([
  '.git','node_modules','.next','.cache','dist','build','coverage','.ssh','.aws','.config','.vscode','.idea','secrets',
]);
const SENSITIVE = /^(?:\.env(?:\..*)?|id_(?:rsa|ed25519|ecdsa)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets(?:\..*)?)$/i;

function verifiedPath(path: unknown): string {
  if (typeof path !== 'string' || !path || path.length > MAX_PATH || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new TypeError('Code Intelligence source path must be a bounded relative string.');
  }
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)
    || parts.some((part) => !part || part === '.' || part === '..' || EXCLUDED.has(part) || SENSITIVE.test(part))
    || !SOURCE_SUFFIX.test(normalized)) {
    throw new TypeError('Code Intelligence source path is unsafe or unsupported.');
  }
  return normalized;
}

function dataRow(value: ToolValue, label: string): Record<string, ToolValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(label + ' must be an object.');
  }
  return value as Record<string, ToolValue>;
}

function queryOf(raw: ToolValue): CodeIntelligenceQuery | CodeSemanticRequest {
  const input = dataRow(raw, 'Code Intelligence query');
  const semantic = input.kind === 'semantic-definitions' || input.kind === 'semantic-references';
  const allowedFields = semantic ? ['kind','path','line','column','limit'] : ['kind','term','path','limit'];
  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new TypeError('Code Intelligence query contains unknown fields.');
  }
  if (semantic) {
    if (typeof input.path !== 'string' || typeof input.line !== 'number' || typeof input.column !== 'number'
      || !Number.isInteger(input.line) || !Number.isInteger(input.column) || input.line < 1 || input.column < 1
      || input.line > 1_000_000 || input.column > 1_000_000
      || typeof input.limit !== 'undefined' && !Number.isInteger(input.limit)) {
      throw new TypeError('Code Intelligence semantic query fields are invalid.');
    }
    return {
      kind: input.kind as CodeSemanticRequest['kind'],
      path: verifiedPath(input.path),
      line: input.line,
      column: input.column,
      ...(typeof input.limit === 'number' ? { limit: input.limit } : {}),
    };
  }
  if (typeof input.kind !== 'string' || !['definitions','occurrences','imports','calls'].includes(input.kind)
    || typeof input.term !== 'string' || typeof input.path !== 'undefined' && typeof input.path !== 'string'
    || typeof input.limit !== 'undefined' && !Number.isInteger(input.limit)) {
    throw new TypeError('Code Intelligence query fields are invalid.');
  }
  const kind = input.kind as CodeIntelligenceQuery['kind'];
  return {
    kind, term: input.term,
    ...(typeof input.path === 'string' ? { path: verifiedPath(input.path) } : {}),
    ...(typeof input.limit === 'number' ? { limit: input.limit } : {}),
  };
}

export interface CodeIntelligenceLocalOptions {
  readonly workspaces: Pick<WorkspaceManager, 'get' | 'resolveExistingPath'>;
}

export function createCodeIntelligenceToolRegistrations(
  options: CodeIntelligenceLocalOptions,
  scopeLock: ScopeLockRecord,
): readonly ToolRegistration[] {
  if (!options?.workspaces || !scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked'
    || scopeLock.lockDigest?.algorithm !== 'sha256' || !/^[0-9a-f]{64}$/.test(scopeLock.lockDigest.hex)
    || !scopeLock.workspaceId || !scopeLock.sourceOrchestrationId
    || scopeLock.sourceOrchestrationDigest?.algorithm !== 'sha256'
    || !/^[0-9a-f]{64}$/.test(scopeLock.sourceOrchestrationDigest.hex)) {
    throw new TypeError('Code Intelligence requires canonical workspace and locked Scope Lock context.');
  }
  const descriptor: ToolDescriptor = Object.freeze({
    id: CODE_INTELLIGENCE_TOOL_ID,
    label: 'Read bounded AST-backed source facts from a registered workspace',
    requiredCapabilities: Object.freeze(['READ'] as const),
    mutating: false,
  });
  return Object.freeze([
    Object.freeze({
      descriptor,
      handler: async (context: ToolExecutionContext, raw: ToolValue): Promise<ToolValue> => {
        if (context.schema !== TOOL_RUNTIME_SCHEMA || context.tool.id !== descriptor.id
          || !context.verifiedCapabilities.includes('READ') || context.mutationAuthorized) {
          throw new Error('Code Intelligence requires a verified Tool Runtime READ invocation.');
        }
        if (context.sourceScopeLockId !== scopeLock.id
          || context.sourceScopeLockDigest !== scopeLock.lockDigest.hex
          || context.workspaceId !== scopeLock.workspaceId
          || context.sourceOrchestrationId !== scopeLock.sourceOrchestrationId
          || context.sourceOrchestrationDigest !== scopeLock.sourceOrchestrationDigest.hex
          || context.scopeLock !== true) {
          throw new Error('Code Intelligence invocation must match the active workspace, orchestration and Scope Lock digests.');
        }
        const input = dataRow(raw, 'Code Intelligence');
        if (Object.keys(input).some((key) => !['paths','query'].includes(key))) {
          throw new TypeError('Code Intelligence input contains unknown fields.');
        }
        if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > MAX_FILES_PER_READ) {
          throw new RangeError('Code Intelligence accepts 1–64 explicitly selected source paths.');
        }
        const paths = input.paths.map(verifiedPath);
        if (new Set(paths).size !== paths.length) throw new TypeError('Code Intelligence paths must be unique.');
        const query = queryOf(input.query as ToolValue);

        const workspaceId = asWorkspaceId(context.workspaceId);
        const workspace = options.workspaces.get(workspaceId);
        if (!workspace) throw new Error('Code Intelligence workspace is not registered.');
        const files: CodeFileInput[] = [];
        const canonicalRoot = realpathSync(workspace.rootPath);
        if (canonicalRoot !== workspace.rootPath) throw new Error('Workspace root canonical identity has changed.');
        let bytes = 0;
        for (const path of paths) {
          const parts = path.split('/');
          let component = workspace.rootPath;
          for (const part of parts) {
            component = join(component, part);
            const lstat = lstatSync(component);
            if (lstat.isSymbolicLink() || (lstat.isFile() && lstat.nlink !== 1)
              || (!lstat.isFile() && !lstat.isDirectory())) {
              throw new Error('Code Intelligence refuses symbolic links, hard links and special files.');
            }
          }
          const filename = options.workspaces.resolveExistingPath(workspaceId, path);
          // A bounded file descriptor prevents an attacker from enlarging or replacing a
          // previously checked path between lstat and unbounded readFileSync.
          const fd = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
          try {
            const before = fstatSync(fd, { bigint: true });
            const maxFileBytes = CODE_INTELLIGENCE_MAX_FILE_CHARS * 4;
            if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(maxFileBytes)) {
              throw new RangeError('Code Intelligence requires a bounded single-link regular file.');
            }
            bytes += Number(before.size);
            if (bytes > CODE_INTELLIGENCE_MAX_TOTAL_CHARS * 4) {
              throw new RangeError('Code Intelligence aggregate source bytes exceed the bound.');
            }
            const buffer = Buffer.alloc(Number(before.size) + 1);
            let read = 0;
            while (read < buffer.length) {
              const received = readSync(fd, buffer, read, buffer.length - read, null);
              if (!received) break;
              read += received;
            }
            const after = fstatSync(fd, { bigint: true });
            const pathAfter = lstatSync(filename, { bigint: true });
            const canonicalAfter = realpathSync(filename);
            const relation = relative(canonicalRoot, canonicalAfter);
            if (canonicalAfter !== filename || isAbsolute(relation) || relation === '..'
              || relation.startsWith('..' + sep) || pathAfter.isSymbolicLink()
              || pathAfter.dev !== before.dev || pathAfter.ino !== before.ino
              || pathAfter.nlink !== 1n || after.dev !== before.dev || after.ino !== before.ino
              || after.size !== before.size || after.mtimeNs !== before.mtimeNs
              || read !== Number(before.size)) {
              throw new Error('Code Intelligence source changed or escaped during bounded read.');
            }
            const content = buffer.subarray(0, read).toString('utf8');
            if (content.length > CODE_INTELLIGENCE_MAX_FILE_CHARS) {
              throw new RangeError('Code Intelligence source text exceeds the bound.');
            }
            files.push({ path, content });
          } finally {
            closeSync(fd);
          }
        }
        const index = buildCodeIntelligenceIndex(files);
        const result = query.kind === 'semantic-definitions' || query.kind === 'semantic-references'
          ? resolveCodeSemantics(files, query)
          : queryCodeIntelligence(index, query);
        const dependencies = buildCodeDependencyGraph(index);
        return JSON.parse(JSON.stringify({
          ...result,
          workspaceId: context.workspaceId,
          orchestrationId: context.sourceOrchestrationId,
          invocationId: context.invocationId,
          scopeLockId: context.sourceScopeLockId,
          indexedFiles: index.files,
          dependencies,
          syntacticOnly: query.kind !== 'semantic-definitions' && query.kind !== 'semantic-references',
          readCapabilityVerified: true,
          mutationAuthority: false,
        })) as ToolValue;
      },
    }),
  ]);
}
