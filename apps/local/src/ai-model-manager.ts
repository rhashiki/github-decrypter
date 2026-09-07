import {
  assertAIProviderDescriptor,
  normalizeAIModelId,
  normalizeAIProviderId,
  validateAIProviderModelList,
  type AIProviderDescriptor,
  type AIProviderModelDescriptor,
} from '@github-decrypter/ai';
import type { EventBus } from '@github-decrypter/shared';
import type {
  CapabilityRequirement,
  CapabilitySecurityAuthority,
  CapabilityToken,
} from './capability-security.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type { ConnectivityState } from './offline-execution.js';
import {
  LOCAL_AI_RUNTIME_FAMILIES,
  type LocalAIRuntimeFamily,
} from './ai-installer.js';

export const LOCAL_AI_MODEL_MANAGER_BUILD = 36 as const;
export const LOCAL_AI_MODEL_MANAGER_SCHEMA = 'gd-local-ai-model-manager/1' as const;
export const LOCAL_AI_MODEL_MUTATION_SCHEMA = 'gd-local-ai-model-mutation/1' as const;
export const LOCAL_AI_MODEL_MANAGER_OPERATIONS = [
  'managers.list',
  'models.list',
  'models.remove',
  'models.update',
  'default.get',
  'default.set',
  'default.clear',
] as const;
export type LocalAIModelManagerOperation = (typeof LOCAL_AI_MODEL_MANAGER_OPERATIONS)[number];

export const LOCAL_AI_MODEL_MANAGER_RESOURCE = 'gd://ai-model-manager' as const;
export const LOCAL_AI_MODEL_MANAGERS_RESOURCE = `${LOCAL_AI_MODEL_MANAGER_RESOURCE}/providers` as const;
export const LOCAL_AI_MODEL_DEFAULT_RESOURCE = `${LOCAL_AI_MODEL_MANAGER_RESOURCE}/default` as const;

export interface LocalAIModelManagerDescriptor {
  readonly schema: typeof LOCAL_AI_MODEL_MANAGER_SCHEMA;
  readonly provider: AIProviderDescriptor;
  readonly runtimeFamily: LocalAIRuntimeFamily;
  readonly updateNetworkRequired: boolean;
}

export interface LocalAIManagedModelRequest {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIModelMutationResult {
  readonly schema: typeof LOCAL_AI_MODEL_MUTATION_SCHEMA;
  readonly action: 'remove' | 'update';
  readonly providerId: string;
  readonly modelId: string;
  readonly changed: boolean;
}

export interface LocalAIModelManagerAdapter {
  readonly descriptor: LocalAIModelManagerDescriptor;
  listInstalledModels(): Promise<readonly AIProviderModelDescriptor[]>;
  removeModel(request: LocalAIManagedModelRequest): Promise<LocalAIModelMutationResult>;
  updateModel(request: LocalAIManagedModelRequest): Promise<LocalAIModelMutationResult>;
}

export interface LocalAIModelSelection {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIModelManagerStatus {
  readonly ready: boolean;
  readonly schema: typeof LOCAL_AI_MODEL_MANAGER_SCHEMA;
  readonly registeredManagers: number;
  readonly localOnly: true;
  readonly constructionOnlyAdapters: true;
  readonly modelInventory: true;
  readonly modelRemoval: true;
  readonly modelUpdate: true;
  readonly defaultSelection: true;
  readonly defaultSelectionPersistence: false;
  readonly automaticRouting: false;
  readonly arbitrarySourceUrl: false;
  readonly secretsAuthority: false;
  readonly providerConfigurationPersistence: false;
  readonly modelStatePersistence: false;
  readonly directFilesystemAuthority: false;
  readonly studioTransport: false;
}

export interface LocalAIModelManagerAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
}

export interface ListLocalAIModelManagersRequest extends LocalAIModelManagerAuthorization {}
export interface GetLocalAIDefaultModelRequest extends LocalAIModelManagerAuthorization {}
export interface ClearLocalAIDefaultModelRequest extends LocalAIModelManagerAuthorization {}

export interface ListLocalAIManagedModelsRequest extends LocalAIModelManagerAuthorization {
  readonly providerId: string;
}

export interface MutateLocalAIManagedModelRequest extends LocalAIModelManagerAuthorization {
  readonly providerId: string;
  readonly modelId: string;
}

export interface SetLocalAIDefaultModelRequest extends LocalAIModelManagerAuthorization {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIModelManagerConnectivity {
  status(): {
    readonly ready: boolean;
    readonly connectivity: ConnectivityState;
  };
}

export type LocalAIModelManagerReadyPayload = {
  readonly registeredManagers: number;
  readonly modelInventory: true;
  readonly modelRemoval: true;
  readonly modelUpdate: true;
  readonly defaultSelection: true;
  readonly automaticRouting: false;
  readonly persistence: false;
};

export type LocalAIModelManagerOperationPayload = {
  readonly operation: LocalAIModelManagerOperation;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly outcome: 'success' | 'failure';
  readonly networkRequired: boolean | null;
  readonly changed: boolean | null;
  readonly occurredAt: string;
  readonly persistence: false;
};

export type LocalAIModelManagerEventCatalog = Pick<
  LocalRuntimeEventCatalog,
  'gd.local.ai-model-manager.ready' | 'gd.local.ai-model-manager.operation'
>;

export interface LocalAIModelManagerOptions {
  readonly capabilities: CapabilitySecurityAuthority;
  readonly offline: LocalAIModelManagerConnectivity;
  readonly adapters?: readonly LocalAIModelManagerAdapter[];
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unsupported field ${key}.`);
  }
  for (const key of keys) {
    if (!(key in record)) throw new TypeError(`${label} is missing required field ${key}.`);
  }
}

function normalizeManagedModel(input: LocalAIManagedModelRequest): LocalAIManagedModelRequest {
  const providerId = normalizeAIProviderId(input.providerId);
  const modelId = normalizeAIModelId(input.modelId);
  if (modelId.includes('://')) throw new TypeError('Local AI model manager model id cannot be a URL.');
  return Object.freeze({ providerId, modelId });
}

export function createLocalAIModelManagerDescriptor(input: {
  readonly provider: AIProviderDescriptor;
  readonly runtimeFamily: LocalAIRuntimeFamily;
  readonly updateNetworkRequired: boolean;
}): LocalAIModelManagerDescriptor {
  assertAIProviderDescriptor(input.provider);
  if (input.provider.kind !== 'local' || input.provider.credentialMode !== 'none') {
    throw new TypeError('Local AI Model Manager accepts only local providers with credential mode none.');
  }
  if (!LOCAL_AI_RUNTIME_FAMILIES.includes(input.runtimeFamily)) {
    throw new TypeError('Local AI Model Manager runtime family is invalid.');
  }
  if (typeof input.updateNetworkRequired !== 'boolean') {
    throw new TypeError('Local AI Model Manager updateNetworkRequired must be boolean.');
  }
  return Object.freeze({
    schema: LOCAL_AI_MODEL_MANAGER_SCHEMA,
    provider: input.provider,
    runtimeFamily: input.runtimeFamily,
    updateNetworkRequired: input.updateNetworkRequired,
  });
}

export function assertLocalAIModelManagerDescriptor(value: unknown): asserts value is LocalAIModelManagerDescriptor {
  const row = asRecord(value, 'Local AI model manager descriptor');
  assertExactKeys(row, ['schema', 'provider', 'runtimeFamily', 'updateNetworkRequired'], 'Local AI model manager descriptor');
  if (row.schema !== LOCAL_AI_MODEL_MANAGER_SCHEMA) throw new TypeError('Local AI model manager descriptor schema is invalid.');
  assertAIProviderDescriptor(row.provider);
  if (row.provider.kind !== 'local' || row.provider.credentialMode !== 'none') {
    throw new TypeError('Local AI model manager provider must be local with credential mode none.');
  }
  if (!LOCAL_AI_RUNTIME_FAMILIES.includes(row.runtimeFamily as LocalAIRuntimeFamily)) {
    throw new TypeError('Local AI model manager runtime family is invalid.');
  }
  if (typeof row.updateNetworkRequired !== 'boolean') throw new TypeError('Local AI model manager updateNetworkRequired must be boolean.');
}

export function assertLocalAIModelManagerAdapter(value: unknown): asserts value is LocalAIModelManagerAdapter {
  const row = asRecord(value, 'Local AI model manager adapter');
  assertLocalAIModelManagerDescriptor(row.descriptor);
  if (
    typeof row.listInstalledModels !== 'function'
    || typeof row.removeModel !== 'function'
    || typeof row.updateModel !== 'function'
  ) throw new TypeError('Local AI model manager adapter must implement listInstalledModels(), removeModel() and updateModel().');
}

export function assertLocalAIModelMutationResult(
  value: unknown,
  request: LocalAIManagedModelRequest,
  action: 'remove' | 'update',
): asserts value is LocalAIModelMutationResult {
  const row = asRecord(value, 'Local AI model mutation result');
  assertExactKeys(row, ['schema', 'action', 'providerId', 'modelId', 'changed'], 'Local AI model mutation result');
  if (row.schema !== LOCAL_AI_MODEL_MUTATION_SCHEMA || row.action !== action) {
    throw new TypeError('Local AI model mutation result schema/action is invalid.');
  }
  if (normalizeAIProviderId(row.providerId) !== request.providerId) throw new TypeError('Local AI model mutation provider does not match request.');
  if (normalizeAIModelId(row.modelId) !== request.modelId) throw new TypeError('Local AI model mutation model does not match request.');
  if (typeof row.changed !== 'boolean') throw new TypeError('Local AI model mutation changed must be boolean.');
}

function managerResource(providerId: string): string {
  return `${LOCAL_AI_MODEL_MANAGERS_RESOURCE}/${encodeURIComponent(providerId)}`;
}

function modelsResource(providerId: string): string {
  return `${managerResource(providerId)}/models`;
}

function modelResource(providerId: string, modelId: string): string {
  return `${modelsResource(providerId)}/${encodeURIComponent(modelId)}`;
}

export class LocalAIModelManager {
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #offline: LocalAIModelManagerConnectivity;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #adapters = new Map<string, LocalAIModelManagerAdapter>();
  #defaultModel: LocalAIModelSelection | null = null;
  #ready = false;

  constructor(options: LocalAIModelManagerOptions) {
    this.#capabilities = options.capabilities;
    this.#offline = options.offline;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());

    for (const adapter of options.adapters ?? []) {
      assertLocalAIModelManagerAdapter(adapter);
      const providerId = adapter.descriptor.provider.id;
      if (this.#adapters.has(providerId)) throw new TypeError(`Local AI model manager is duplicated: ${providerId}.`);
      this.#adapters.set(providerId, adapter);
    }
  }

  status(): LocalAIModelManagerStatus {
    return Object.freeze({
      ready: this.#ready,
      schema: LOCAL_AI_MODEL_MANAGER_SCHEMA,
      registeredManagers: this.#adapters.size,
      localOnly: true,
      constructionOnlyAdapters: true,
      modelInventory: true,
      modelRemoval: true,
      modelUpdate: true,
      defaultSelection: true,
      defaultSelectionPersistence: false,
      automaticRouting: false,
      arbitrarySourceUrl: false,
      secretsAuthority: false,
      providerConfigurationPersistence: false,
      modelStatePersistence: false,
      directFilesystemAuthority: false,
      studioTransport: false,
    });
  }

  async initialize(): Promise<LocalAIModelManagerStatus> {
    if (!this.#capabilities.status().ready) throw new Error('Local AI Model Manager requires Capability Security to be ready.');
    if (!this.#offline.status().ready) throw new Error('Local AI Model Manager requires Offline Execution to be ready.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.ai-model-manager.ready', {
      registeredManagers: status.registeredManagers,
      modelInventory: true,
      modelRemoval: true,
      modelUpdate: true,
      defaultSelection: true,
      automaticRouting: false,
      persistence: false,
    });
    return status;
  }

  async listManagers(request: ListLocalAIModelManagersRequest): Promise<readonly LocalAIModelManagerDescriptor[]> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'READ', resource: LOCAL_AI_MODEL_MANAGERS_RESOURCE }],
    }, request.token);
    const managers = Object.freeze(
      [...this.#adapters.values()]
        .map((adapter) => adapter.descriptor)
        .sort((a, b) => a.provider.id.localeCompare(b.provider.id)),
    );
    await this.#publishOperation('managers.list', null, null, 'success', null, null);
    return managers;
  }

  async listModels(input: ListLocalAIManagedModelsRequest): Promise<readonly AIProviderModelDescriptor[]> {
    this.#assertReady();
    const providerId = normalizeAIProviderId(input.providerId);
    const adapter = this.#requireAdapter(providerId);
    await this.#capabilities.assertAuthorized({
      jobId: input.jobId,
      requirements: [{ capability: 'READ', resource: modelsResource(providerId) }],
    }, input.token);
    try {
      const models = validateAIProviderModelList(providerId, await adapter.listInstalledModels());
      await this.#publishOperation('models.list', providerId, null, 'success', false, null);
      return models;
    } catch (error) {
      await this.#publishOperation('models.list', providerId, null, 'failure', false, null);
      throw error;
    }
  }

  async removeModel(input: MutateLocalAIManagedModelRequest): Promise<LocalAIModelMutationResult> {
    this.#assertReady();
    const request = normalizeManagedModel(input);
    const adapter = this.#requireAdapter(request.providerId);
    const resource = modelResource(request.providerId, request.modelId);
    await this.#capabilities.assertAuthorized({
      jobId: input.jobId,
      requirements: [
        { capability: 'WRITE', resource },
        { capability: 'EXECUTE', resource },
        { capability: 'DESTRUCTIVE', resource },
      ],
    }, input.token);
    try {
      const result = await adapter.removeModel(request);
      assertLocalAIModelMutationResult(result, request, 'remove');
      if (this.#defaultModel?.providerId === request.providerId && this.#defaultModel.modelId === request.modelId) {
        this.#defaultModel = null;
      }
      await this.#publishOperation('models.remove', request.providerId, request.modelId, 'success', false, result.changed);
      return result;
    } catch (error) {
      await this.#publishOperation('models.remove', request.providerId, request.modelId, 'failure', false, null);
      throw error;
    }
  }

  async updateModel(input: MutateLocalAIManagedModelRequest): Promise<LocalAIModelMutationResult> {
    this.#assertReady();
    const request = normalizeManagedModel(input);
    const adapter = this.#requireAdapter(request.providerId);
    const resource = modelResource(request.providerId, request.modelId);
    const requirements: CapabilityRequirement[] = [
      { capability: 'WRITE', resource },
      { capability: 'EXECUTE', resource },
    ];
    if (adapter.descriptor.updateNetworkRequired) requirements.push({ capability: 'NETWORK', resource });
    if (adapter.descriptor.updateNetworkRequired && this.#offline.status().connectivity !== 'online') {
      await this.#publishOperation('models.update', request.providerId, request.modelId, 'failure', true, null);
      throw new Error('Local AI model update requires online connectivity.');
    }
    await this.#capabilities.assertAuthorized({ jobId: input.jobId, requirements }, input.token);
    try {
      const result = await adapter.updateModel(request);
      assertLocalAIModelMutationResult(result, request, 'update');
      await this.#publishOperation('models.update', request.providerId, request.modelId, 'success', adapter.descriptor.updateNetworkRequired, result.changed);
      return result;
    } catch (error) {
      await this.#publishOperation('models.update', request.providerId, request.modelId, 'failure', adapter.descriptor.updateNetworkRequired, null);
      throw error;
    }
  }

  async getDefaultModel(request: GetLocalAIDefaultModelRequest): Promise<LocalAIModelSelection | null> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'READ', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE }],
    }, request.token);
    await this.#publishOperation('default.get', this.#defaultModel?.providerId ?? null, this.#defaultModel?.modelId ?? null, 'success', false, null);
    return this.#defaultModel ? Object.freeze({ ...this.#defaultModel }) : null;
  }

  async setDefaultModel(input: SetLocalAIDefaultModelRequest): Promise<LocalAIModelSelection> {
    this.#assertReady();
    const selection = normalizeManagedModel(input);
    const adapter = this.#requireAdapter(selection.providerId);
    await this.#capabilities.assertAuthorized({
      jobId: input.jobId,
      requirements: [{ capability: 'WRITE', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE }],
    }, input.token);
    const models = validateAIProviderModelList(selection.providerId, await adapter.listInstalledModels());
    if (!models.some((model) => model.id === selection.modelId)) {
      await this.#publishOperation('default.set', selection.providerId, selection.modelId, 'failure', false, null);
      throw new Error(`Local AI model is not installed: ${selection.providerId}/${selection.modelId}.`);
    }
    this.#defaultModel = Object.freeze({ providerId: selection.providerId, modelId: selection.modelId });
    await this.#publishOperation('default.set', selection.providerId, selection.modelId, 'success', false, true);
    return this.#defaultModel;
  }

  async clearDefaultModel(request: ClearLocalAIDefaultModelRequest): Promise<void> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'WRITE', resource: LOCAL_AI_MODEL_DEFAULT_RESOURCE }],
    }, request.token);
    const previous = this.#defaultModel;
    this.#defaultModel = null;
    await this.#publishOperation('default.clear', previous?.providerId ?? null, previous?.modelId ?? null, 'success', false, previous !== null);
  }

  shutdown(): void {
    this.#defaultModel = null;
    this.#ready = false;
  }

  #requireAdapter(providerId: string): LocalAIModelManagerAdapter {
    const adapter = this.#adapters.get(providerId);
    if (!adapter) throw new Error(`Local AI model manager is not registered: ${providerId}.`);
    return adapter;
  }

  async #publishOperation(
    operation: LocalAIModelManagerOperation,
    providerId: string | null,
    modelId: string | null,
    outcome: 'success' | 'failure',
    networkRequired: boolean | null,
    changed: boolean | null,
  ): Promise<void> {
    await this.#eventBus?.publish('gd.local.ai-model-manager.operation', {
      operation,
      providerId,
      modelId,
      outcome,
      networkRequired,
      changed,
      occurredAt: this.#now(),
      persistence: false,
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Local AI Model Manager is not ready.');
  }
}

export function createLocalAIModelManager(options: LocalAIModelManagerOptions): LocalAIModelManager {
  return new LocalAIModelManager(options);
}
