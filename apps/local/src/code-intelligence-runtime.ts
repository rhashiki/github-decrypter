import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CODE_INTELLIGENCE_MAX_FILE_CHARS,
  CODE_INTELLIGENCE_MAX_TOTAL_CHARS,
  buildCodeIntelligenceIndex,
  queryCodeIntelligence,
  type CodeFileInput,
  type CodeIntelligenceQuery,
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

function queryOf(raw: ToolValue): CodeIntelligenceQuery {
  const input = dataRow(raw, 'Code Intelligence query');
  if (Object.keys(input).some((key) => !['kind','term','path','limit'].includes(key))) {
    throw new TypeError('Code Intelligence query contains unknown fields.');
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
  if (!options?.workspaces || !scopeLock || scopeLock.schema !== 'gd-scope-lock/1' || scopeLock.status !== 'locked') {
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
        if (context.sourceScopeLockId !== scopeLock.id) {
          throw new Error('Code Intelligence invocation belongs to a different Scope Lock.');
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
          const stat = lstatSync(filename);
          if (!stat.isFile() || stat.size > CODE_INTELLIGENCE_MAX_FILE_CHARS * 4) {
            throw new RangeError('Code Intelligence source is not a bounded regular file.');
          }
          bytes += stat.size;
          if (bytes > CODE_INTELLIGENCE_MAX_TOTAL_CHARS * 4) {
            throw new RangeError('Code Intelligence aggregate source bytes exceed the bound.');
          }
          const content = readFileSync(filename, 'utf8');
          if (content.length > CODE_INTELLIGENCE_MAX_FILE_CHARS) {
            throw new RangeError('Code Intelligence source text exceeds the bound.');
          }
          files.push({ path, content });
        }
        const index = buildCodeIntelligenceIndex(files);
        const result = queryCodeIntelligence(index, query);
        return JSON.parse(JSON.stringify({
          ...result,
          workspaceId: context.workspaceId,
          orchestrationId: context.sourceOrchestrationId,
          invocationId: context.invocationId,
          scopeLockId: context.sourceScopeLockId,
          indexedFiles: index.files,
          syntacticOnly: true,
          readCapabilityVerified: true,
          mutationAuthority: false,
        })) as ToolValue;
      },
    }),
  ]);
}
