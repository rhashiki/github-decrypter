import {
  AI_PROVIDER_SCHEMA,
  assertAIProviderDescriptor,
  normalizeAIModelId,
  normalizeAIProviderId,
  type AIProviderDescriptor,
} from '@github-decrypter/ai';
import type { EventBus } from '@github-decrypter/shared';
import type {
  CapabilityRequirement,
  CapabilitySecurityAuthority,
  CapabilityToken,
} from './capability-security.js';
import type { DurableJobId } from './job-types.js';
import type { ConnectivityState } from './offline-execution.js';

export const LOCAL_AI_INSTALLER_BUILD = 35 as const;
export const LOCAL_AI_INSTALLER_SCHEMA = 'gd-local-ai-installer/1' as const;
export const LOCAL_AI_INSTALL_RESULT_SCHEMA = 'gd-local-ai-install-result/1' as const;
export const LOCAL_AI_INSTALLER_OPERATIONS = ['installers.list', 'models.install'] as const;
export type LocalAIInstallerOperation = (typeof LOCAL_AI_INSTALLER_OPERATIONS)[number];

export const LOCAL_AI_RUNTIME_FAMILIES = ['ollama-compatible', 'vllm-compatible', 'custom-local'] as const;
export type LocalAIRuntimeFamily = (typeof LOCAL_AI_RUNTIME_FAMILIES)[number];

export const LOCAL_AI_INSTALLER_RESOURCE = 'gd://ai-installer' as const;
export const LOCAL_AI_INSTALLERS_RESOURCE = `${LOCAL_AI_INSTALLER_RESOURCE}/providers` as const;

export interface LocalAIInstallerDescriptor {
  readonly schema: typeof LOCAL_AI_INSTALLER_SCHEMA;
  readonly provider: AIProviderDescriptor;
  readonly runtimeFamily: LocalAIRuntimeFamily;
  readonly networkRequired: boolean;
}

export interface LocalAIInstallRequest {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIInstallResult {
  readonly schema: typeof LOCAL_AI_INSTALL_RESULT_SCHEMA;
  readonly providerId: string;
  readonly modelId: string;
  readonly installed: true;
  readonly reused: boolean;
}

export interface LocalAIInstallerAdapter {
  readonly descriptor: LocalAIInstallerDescriptor;
  installModel(request: LocalAIInstallRequest): Promise<LocalAIInstallResult>;
}

export interface LocalAIInstallerStatus {
  readonly ready: boolean;
  readonly schema: typeof LOCAL_AI_INSTALLER_SCHEMA;
  readonly registeredInstallers: number;
  readonly localOnly: true;
  readonly constructionOnlyAdapters: true;
  readonly modelInstallation: true;
  readonly modelRemoval: false;
  readonly modelUpdate: false;
  readonly defaultSelection: false;
  readonly automaticRouting: false;
  readonly arbitrarySourceUrl: false;
  readonly secretsAuthority: false;
  readonly providerConfigurationPersistence: false;
  readonly modelStatePersistence: false;
  readonly studioTransport: false;
}

export interface LocalAIInstallerAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
}

export interface ListLocalAIInstallersRequest extends LocalAIInstallerAuthorization {}

export interface InstallLocalAIModelRequest extends LocalAIInstallerAuthorization {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIInstallerConnectivity {
  status(): {
    readonly ready: boolean;
    readonly connectivity: ConnectivityState;
  };
}

export type LocalAIInstallerReadyPayload = {
  readonly registeredInstallers: number;
  readonly localOnly: true;
  readonly modelInstallation: true;
  readonly modelManagement: false;
  readonly automaticRouting: false;
  readonly persistence: false;
};

export type LocalAIInstallerOperationPayload = {
  readonly operation: LocalAIInstallerOperation;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly outcome: 'success' | 'failure';
  readonly networkRequired: boolean | null;
  readonly reused: boolean | null;
  readonly occurredAt: string;
  readonly persistence: false;
};

export type LocalAIInstallerEventCatalog = {
  readonly 'gd.local.ai-installer.ready': LocalAIInstallerReadyPayload;
  readonly 'gd.local.ai-installer.operation': LocalAIInstallerOperationPayload;
};

export interface LocalAIInstallerOptions {
  readonly capabilities: CapabilitySecurityAuthority;
  readonly offline: LocalAIInstallerConnectivity;
  readonly adapters?: readonly LocalAIInstallerAdapter[];
  readonly eventBus?: EventBus<LocalAIInstallerEventCatalog>;
  readonly now?: () => string;
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

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function createLocalAIInstallerDescriptor(input: {
  readonly provider: AIProviderDescriptor;
  readonly runtimeFamily: LocalAIRuntimeFamily;
  readonly networkRequired: boolean;
}): LocalAIInstallerDescriptor {
  assertAIProviderDescriptor(input.provider);
  if (input.provider.schema !== AI_PROVIDER_SCHEMA || input.provider.kind !== 'local' || input.provider.credentialMode !== 'none') {
    throw new TypeError('Local AI Installer accepts only local providers with credential mode none.');
  }
  if (!LOCAL_AI_RUNTIME_FAMILIES.includes(input.runtimeFamily)) {
    throw new TypeError('Local AI Installer runtime family is invalid.');
  }
  if (typeof input.networkRequired !== 'boolean') {
    throw new TypeError('Local AI Installer networkRequired must be boolean.');
  }
  return Object.freeze({
    schema: LOCAL_AI_INSTALLER_SCHEMA,
    provider: input.provider,
    runtimeFamily: input.runtimeFamily,
    networkRequired: input.networkRequired,
  });
}

export function assertLocalAIInstallerDescriptor(value: unknown): asserts value is LocalAIInstallerDescriptor {
  const row = asRecord(value, 'Local AI installer descriptor');
  assertExactKeys(row, ['schema', 'provider', 'runtimeFamily', 'networkRequired'], 'Local AI installer descriptor');
  if (row.schema !== LOCAL_AI_INSTALLER_SCHEMA) throw new TypeError('Local AI installer descriptor schema is invalid.');
  assertAIProviderDescriptor(row.provider);
  if (row.provider.kind !== 'local' || row.provider.credentialMode !== 'none') {
    throw new TypeError('Local AI installer provider must be local with credential mode none.');
  }
  if (!LOCAL_AI_RUNTIME_FAMILIES.includes(row.runtimeFamily as LocalAIRuntimeFamily)) {
    throw new TypeError('Local AI installer runtime family is invalid.');
  }
  if (typeof row.networkRequired !== 'boolean') throw new TypeError('Local AI installer networkRequired must be boolean.');
}

export function assertLocalAIInstallerAdapter(value: unknown): asserts value is LocalAIInstallerAdapter {
  const row = asRecord(value, 'Local AI installer adapter');
  assertLocalAIInstallerDescriptor(row.descriptor);
  if (typeof row.installModel !== 'function') throw new TypeError('Local AI installer adapter must implement installModel().');
}

export function createLocalAIInstallRequest(input: LocalAIInstallRequest): LocalAIInstallRequest {
  const providerId = normalizeAIProviderId(input.providerId);
  const modelId = normalizeAIModelId(input.modelId);
  if (modelId.includes('://')) {
    throw new TypeError('Local AI installer model id cannot be a URL.');
  }
  return Object.freeze({ providerId, modelId });
}

export function assertLocalAIInstallResult(value: unknown, request: LocalAIInstallRequest): asserts value is LocalAIInstallResult {
  const row = asRecord(value, 'Local AI install result');
  assertExactKeys(row, ['schema', 'providerId', 'modelId', 'installed', 'reused'], 'Local AI install result');
  if (row.schema !== LOCAL_AI_INSTALL_RESULT_SCHEMA) throw new TypeError('Local AI install result schema is invalid.');
  if (normalizeAIProviderId(row.providerId) !== request.providerId) throw new TypeError('Local AI install result provider does not match request.');
  if (normalizeAIModelId(row.modelId) !== request.modelId) throw new TypeError('Local AI install result model does not match request.');
  if (row.installed !== true || typeof row.reused !== 'boolean') throw new TypeError('Local AI install result is invalid.');
}

function installerResource(providerId: string): string {
  return `${LOCAL_AI_INSTALLERS_RESOURCE}/${encodeURIComponent(providerId)}`;
}

function modelInstallResource(providerId: string, modelId: string): string {
  return `${installerResource(providerId)}/models/${encodeURIComponent(modelId)}`;
}

export class LocalAIInstaller {
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #offline: LocalAIInstallerConnectivity;
  readonly #eventBus?: EventBus<LocalAIInstallerEventCatalog>;
  readonly #now: () => string;
  readonly #adapters = new Map<string, LocalAIInstallerAdapter>();
  #ready = false;

  constructor(options: LocalAIInstallerOptions) {
    this.#capabilities = options.capabilities;
    this.#offline = options.offline;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());

    for (const adapter of options.adapters ?? []) {
      assertLocalAIInstallerAdapter(adapter);
      const providerId = adapter.descriptor.provider.id;
      if (this.#adapters.has(providerId)) throw new TypeError(`Local AI installer is duplicated: ${providerId}.`);
      this.#adapters.set(providerId, adapter);
    }
  }

  status(): LocalAIInstallerStatus {
    return Object.freeze({
      ready: this.#ready,
      schema: LOCAL_AI_INSTALLER_SCHEMA,
      registeredInstallers: this.#adapters.size,
      localOnly: true,
      constructionOnlyAdapters: true,
      modelInstallation: true,
      modelRemoval: false,
      modelUpdate: false,
      defaultSelection: false,
      automaticRouting: false,
      arbitrarySourceUrl: false,
      secretsAuthority: false,
      providerConfigurationPersistence: false,
      modelStatePersistence: false,
      studioTransport: false,
    });
  }

  async initialize(): Promise<LocalAIInstallerStatus> {
    if (!this.#capabilities.status().ready) throw new Error('Local AI Installer requires Capability Security to be ready.');
    if (!this.#offline.status().ready) throw new Error('Local AI Installer requires Offline Execution to be ready.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.ai-installer.ready', {
      registeredInstallers: status.registeredInstallers,
      localOnly: true,
      modelInstallation: true,
      modelManagement: false,
      automaticRouting: false,
      persistence: false,
    });
    return status;
  }

  async listInstallers(request: ListLocalAIInstallersRequest): Promise<readonly LocalAIInstallerDescriptor[]> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'READ', resource: LOCAL_AI_INSTALLERS_RESOURCE }],
    }, request.token);
    const installers = Object.freeze(
      [...this.#adapters.values()]
        .map((adapter) => adapter.descriptor)
        .sort((a, b) => a.provider.id.localeCompare(b.provider.id)),
    );
    await this.#publishOperation('installers.list', null, null, 'success', null, null);
    return installers;
  }

  async installModel(input: InstallLocalAIModelRequest): Promise<LocalAIInstallResult> {
    this.#assertReady();
    const request = createLocalAIInstallRequest({ providerId: input.providerId, modelId: input.modelId });
    const adapter = this.#requireAdapter(request.providerId);
    const resource = modelInstallResource(request.providerId, request.modelId);
    const requirements: CapabilityRequirement[] = [
      { capability: 'WRITE', resource },
      { capability: 'EXECUTE', resource },
    ];
    if (adapter.descriptor.networkRequired) requirements.push({ capability: 'NETWORK', resource });

    if (adapter.descriptor.networkRequired) {
      const connectivity = this.#offline.status().connectivity;
      if (connectivity !== 'online') {
        await this.#publishOperation('models.install', request.providerId, request.modelId, 'failure', true, null);
        throw new Error(`Local AI model installation requires online connectivity; current state is ${connectivity}.`);
      }
    }

    await this.#capabilities.assertAuthorized({ jobId: input.jobId, requirements }, input.token);

    try {
      const result = await adapter.installModel(request);
      assertLocalAIInstallResult(result, request);
      await this.#publishOperation('models.install', request.providerId, request.modelId, 'success', adapter.descriptor.networkRequired, result.reused);
      return result;
    } catch (error) {
      await this.#publishOperation('models.install', request.providerId, request.modelId, 'failure', adapter.descriptor.networkRequired, null);
      throw error;
    }
  }

  shutdown(): void {
    this.#ready = false;
  }

  #requireAdapter(providerId: string): LocalAIInstallerAdapter {
    const adapter = this.#adapters.get(providerId);
    if (!adapter) throw new Error(`Local AI installer is not registered: ${providerId}.`);
    return adapter;
  }

  async #publishOperation(
    operation: LocalAIInstallerOperation,
    providerId: string | null,
    modelId: string | null,
    outcome: 'success' | 'failure',
    networkRequired: boolean | null,
    reused: boolean | null,
  ): Promise<void> {
    await this.#eventBus?.publish('gd.local.ai-installer.operation', {
      operation,
      providerId,
      modelId,
      outcome,
      networkRequired,
      reused,
      occurredAt: this.#now(),
      persistence: false,
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Local AI Installer is not ready.');
  }
}

export function createLocalAIInstaller(options: LocalAIInstallerOptions): LocalAIInstaller {
  return new LocalAIInstaller(options);
}