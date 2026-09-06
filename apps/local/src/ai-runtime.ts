import {
  assertAIProviderAdapter,
  assertAIProviderGenerateRequest,
  assertAIProviderGenerateResultForRequest,
  normalizeAIProviderId,
  validateAIProviderModelList,
  type AIProviderAdapter,
  type AIProviderDescriptor,
  type AIProviderGenerateRequest,
  type AIProviderGenerateResult,
  type AIProviderModelDescriptor,
} from '@github-decrypter/ai';
import type { EventBus } from '@github-decrypter/shared';
import type { CapabilitySecurityAuthority, CapabilityToken } from './capability-security.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';

export const LOCAL_AI_RUNTIME_BUILD = 34 as const;
export const LOCAL_AI_RUNTIME_SCHEMA = 'gd-local-ai-runtime/1' as const;
export const LOCAL_AI_RUNTIME_OPERATIONS = ['providers.list', 'models.list', 'generate'] as const;
export type LocalAIRuntimeOperation = (typeof LOCAL_AI_RUNTIME_OPERATIONS)[number];

export const LOCAL_AI_RUNTIME_RESOURCE = 'gd://ai-runtime' as const;
export const LOCAL_AI_PROVIDERS_RESOURCE = `${LOCAL_AI_RUNTIME_RESOURCE}/providers` as const;

export interface LocalAIRuntimeStatus {
  readonly ready: boolean;
  readonly schema: typeof LOCAL_AI_RUNTIME_SCHEMA;
  readonly registeredProviders: number;
  readonly localOnly: true;
  readonly runtimeExecution: true;
  readonly constructionOnlyAdapters: true;
  readonly externalProviderExecution: false;
  readonly networkAuthority: false;
  readonly secretsAuthority: false;
  readonly promptPersistence: false;
  readonly responsePersistence: false;
  readonly providerConfigurationPersistence: false;
  readonly automaticRouting: false;
  readonly modelInstallation: false;
  readonly modelManagement: false;
  readonly studioTransport: false;
}

export interface LocalAIRuntimeAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
}

export interface ListLocalAIProvidersRequest extends LocalAIRuntimeAuthorization {}

export interface ListLocalAIModelsRequest extends LocalAIRuntimeAuthorization {
  readonly providerId: string;
}

export interface GenerateLocalAIRequest extends LocalAIRuntimeAuthorization {
  readonly request: AIProviderGenerateRequest;
}

export interface LocalAIRuntimeOptions {
  readonly capabilities: CapabilitySecurityAuthority;
  readonly adapters?: readonly AIProviderAdapter[];
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

function providerResource(providerId: string): string {
  return `${LOCAL_AI_PROVIDERS_RESOURCE}/${encodeURIComponent(providerId)}`;
}

function modelsResource(providerId: string): string {
  return `${providerResource(providerId)}/models`;
}

function modelResource(providerId: string, modelId: string): string {
  return `${modelsResource(providerId)}/${encodeURIComponent(modelId)}`;
}

export class LocalAIRuntime {
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  readonly #adapters = new Map<string, AIProviderAdapter>();
  #ready = false;

  constructor(options: LocalAIRuntimeOptions) {
    this.#capabilities = options.capabilities;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());

    for (const adapter of options.adapters ?? []) {
      assertAIProviderAdapter(adapter);
      const descriptor = adapter.descriptor;
      if (descriptor.kind !== 'local' || descriptor.credentialMode !== 'none') {
        throw new TypeError('Local AI Runtime accepts only local providers with credential mode none.');
      }
      if (this.#adapters.has(descriptor.id)) {
        throw new TypeError(`Local AI provider is duplicated: ${descriptor.id}.`);
      }
      this.#adapters.set(descriptor.id, adapter);
    }
  }

  status(): LocalAIRuntimeStatus {
    return Object.freeze({
      ready: this.#ready,
      schema: LOCAL_AI_RUNTIME_SCHEMA,
      registeredProviders: this.#adapters.size,
      localOnly: true,
      runtimeExecution: true,
      constructionOnlyAdapters: true,
      externalProviderExecution: false,
      networkAuthority: false,
      secretsAuthority: false,
      promptPersistence: false,
      responsePersistence: false,
      providerConfigurationPersistence: false,
      automaticRouting: false,
      modelInstallation: false,
      modelManagement: false,
      studioTransport: false,
    });
  }

  async initialize(): Promise<LocalAIRuntimeStatus> {
    if (!this.#capabilities.status().ready) {
      throw new Error('Local AI Runtime requires Capability Security to be ready.');
    }
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.ai-runtime.ready', {
      registeredProviders: status.registeredProviders,
      localOnly: true,
      runtimeExecution: true,
      networkAuthority: false,
      secretsAuthority: false,
      persistence: false,
      automaticRouting: false,
    });
    return status;
  }

  async listProviders(request: ListLocalAIProvidersRequest): Promise<readonly AIProviderDescriptor[]> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'READ', resource: LOCAL_AI_PROVIDERS_RESOURCE }],
    }, request.token);
    const providers = Object.freeze(
      [...this.#adapters.values()]
        .map((adapter) => adapter.descriptor)
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    await this.#publishOperation('providers.list', null, null, 'success', providers.length);
    return providers;
  }

  async listModels(request: ListLocalAIModelsRequest): Promise<readonly AIProviderModelDescriptor[]> {
    this.#assertReady();
    const providerId = normalizeAIProviderId(request.providerId);
    const adapter = this.#requireAdapter(providerId);
    await this.#capabilities.assertAuthorized({
      jobId: request.jobId,
      requirements: [{ capability: 'READ', resource: modelsResource(providerId) }],
    }, request.token);
    try {
      const models = validateAIProviderModelList(providerId, await adapter.listModels());
      await this.#publishOperation('models.list', providerId, null, 'success', models.length);
      return models;
    } catch (error) {
      await this.#publishOperation('models.list', providerId, null, 'failure', 0);
      throw error;
    }
  }

  async generate(input: GenerateLocalAIRequest): Promise<AIProviderGenerateResult> {
    this.#assertReady();
    assertAIProviderGenerateRequest(input.request);
    const request = input.request;
    const adapter = this.#requireAdapter(request.providerId);
    await this.#capabilities.assertAuthorized({
      jobId: input.jobId,
      requirements: [{ capability: 'EXECUTE', resource: modelResource(request.providerId, request.modelId) }],
    }, input.token);

    try {
      const models = validateAIProviderModelList(request.providerId, await adapter.listModels());
      if (!models.some((model) => model.id === request.modelId)) {
        throw new Error(`Local AI model is not available from provider ${request.providerId}: ${request.modelId}.`);
      }
      const result = await adapter.generate(request);
      assertAIProviderGenerateResultForRequest(result, request);
      await this.#publishOperation('generate', request.providerId, request.modelId, 'success', 1);
      return result;
    } catch (error) {
      await this.#publishOperation('generate', request.providerId, request.modelId, 'failure', 0);
      throw error;
    }
  }

  shutdown(): void {
    this.#ready = false;
  }

  #requireAdapter(providerId: string): AIProviderAdapter {
    const adapter = this.#adapters.get(providerId);
    if (!adapter) throw new Error(`Local AI provider is not registered: ${providerId}.`);
    return adapter;
  }

  async #publishOperation(
    operation: LocalAIRuntimeOperation,
    providerId: string | null,
    modelId: string | null,
    outcome: 'success' | 'failure',
    itemCount: number,
  ): Promise<void> {
    await this.#eventBus?.publish('gd.local.ai-runtime.operation', {
      operation,
      providerId,
      modelId,
      outcome,
      itemCount,
      occurredAt: this.#now(),
      promptPersistence: false,
      responsePersistence: false,
    });
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Local AI Runtime is not ready.');
  }
}

export function createLocalAIRuntime(options: LocalAIRuntimeOptions): LocalAIRuntime {
  return new LocalAIRuntime(options);
}
