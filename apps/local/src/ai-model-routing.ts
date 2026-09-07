import {
  normalizeAIModelId,
  normalizeAIProviderId,
} from '@github-decrypter/ai';
import type { EventBus } from '@github-decrypter/shared';
import type {
  CapabilitySecurityAuthority,
  CapabilityToken,
} from './capability-security.js';
import type { DurableJobId } from './job-types.js';
import type { LocalRuntimeEventCatalog } from './lifecycle.js';
import type {
  LocalAIModelManager,
  LocalAIModelSelection,
} from './ai-model-manager.js';

export const LOCAL_AI_MODEL_ROUTING_BUILD = 37 as const;
export const LOCAL_AI_MODEL_ROUTING_SCHEMA = 'gd-local-ai-model-routing/1' as const;
export const LOCAL_AI_MODEL_ROUTE_DECISION_SCHEMA = 'gd-local-ai-model-route-decision/1' as const;
export const LOCAL_AI_MODEL_ROUTING_OPERATIONS = ['routes.select'] as const;
export type LocalAIModelRoutingOperation = (typeof LOCAL_AI_MODEL_ROUTING_OPERATIONS)[number];

export const LOCAL_AI_MODEL_ROUTING_RESOURCE = 'gd://ai-model-routing' as const;
export const LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE = `${LOCAL_AI_MODEL_ROUTING_RESOURCE}/select` as const;

export const LOCAL_AI_MODEL_ROUTE_REASONS = ['preferred', 'default', 'fallback'] as const;
export type LocalAIModelRouteReason = (typeof LOCAL_AI_MODEL_ROUTE_REASONS)[number];

export interface LocalAIModelRoutingPreference {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalAIModelRouteDecision {
  readonly schema: typeof LOCAL_AI_MODEL_ROUTE_DECISION_SCHEMA;
  readonly providerId: string;
  readonly modelId: string;
  readonly reason: LocalAIModelRouteReason;
  readonly candidatesConsidered: number;
  readonly deterministic: true;
  readonly localOnly: true;
}

export interface LocalAIModelRoutingStatus {
  readonly ready: boolean;
  readonly schema: typeof LOCAL_AI_MODEL_ROUTING_SCHEMA;
  readonly automaticRouting: true;
  readonly deterministic: true;
  readonly localOnly: true;
  readonly decisionOnly: true;
  readonly runtimeExecution: false;
  readonly modelInstallation: false;
  readonly modelManagement: false;
  readonly defaultMutation: false;
  readonly externalProviderRouting: false;
  readonly networkAuthority: false;
  readonly secretsAuthority: false;
  readonly routingPersistence: false;
  readonly promptInspection: false;
  readonly adaptiveRouting: false;
  readonly studioTransport: false;
}

export interface LocalAIModelRoutingAuthorization {
  readonly jobId: DurableJobId;
  readonly token: CapabilityToken | string;
}

export interface SelectLocalAIModelRouteRequest extends LocalAIModelRoutingAuthorization {
  readonly preferred?: LocalAIModelRoutingPreference | null;
}

export type LocalAIModelRoutingReadyPayload = {
  readonly automaticRouting: true;
  readonly deterministic: true;
  readonly localOnly: true;
  readonly decisionOnly: true;
  readonly persistence: false;
};

export type LocalAIModelRoutingOperationPayload = {
  readonly operation: LocalAIModelRoutingOperation;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly reason: LocalAIModelRouteReason | null;
  readonly outcome: 'success' | 'failure';
  readonly candidatesConsidered: number;
  readonly occurredAt: string;
  readonly persistence: false;
};

export type LocalAIModelRoutingEventCatalog = Pick<
  LocalRuntimeEventCatalog,
  'gd.local.ai-model-routing.ready' | 'gd.local.ai-model-routing.operation'
>;

export interface LocalAIModelRoutingOptions {
  readonly capabilities: CapabilitySecurityAuthority;
  readonly modelManager: LocalAIModelManager;
  readonly eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly now?: () => string;
}

function normalizeSelection(input: LocalAIModelRoutingPreference): LocalAIModelSelection {
  const providerId = normalizeAIProviderId(input.providerId);
  const modelId = normalizeAIModelId(input.modelId);
  if (modelId.includes('://')) throw new TypeError('Local AI model routing model id cannot be a URL.');
  return Object.freeze({ providerId, modelId });
}

function selectionKey(selection: LocalAIModelSelection): string {
  return `${selection.providerId}\u0000${selection.modelId}`;
}

export class LocalAIModelRouting {
  readonly #capabilities: CapabilitySecurityAuthority;
  readonly #modelManager: LocalAIModelManager;
  readonly #eventBus?: EventBus<LocalRuntimeEventCatalog>;
  readonly #now: () => string;
  #ready = false;

  constructor(options: LocalAIModelRoutingOptions) {
    this.#capabilities = options.capabilities;
    this.#modelManager = options.modelManager;
    this.#eventBus = options.eventBus;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  status(): LocalAIModelRoutingStatus {
    return Object.freeze({
      ready: this.#ready,
      schema: LOCAL_AI_MODEL_ROUTING_SCHEMA,
      automaticRouting: true,
      deterministic: true,
      localOnly: true,
      decisionOnly: true,
      runtimeExecution: false,
      modelInstallation: false,
      modelManagement: false,
      defaultMutation: false,
      externalProviderRouting: false,
      networkAuthority: false,
      secretsAuthority: false,
      routingPersistence: false,
      promptInspection: false,
      adaptiveRouting: false,
      studioTransport: false,
    });
  }

  async initialize(): Promise<LocalAIModelRoutingStatus> {
    if (!this.#capabilities.status().ready) throw new Error('Local AI Model Routing requires Capability Security to be ready.');
    if (!this.#modelManager.status().ready) throw new Error('Local AI Model Routing requires Model Manager to be ready.');
    this.#ready = true;
    const status = this.status();
    await this.#eventBus?.publish('gd.local.ai-model-routing.ready', {
      automaticRouting: true,
      deterministic: true,
      localOnly: true,
      decisionOnly: true,
      persistence: false,
    });
    return status;
  }

  async selectRoute(input: SelectLocalAIModelRouteRequest): Promise<LocalAIModelRouteDecision> {
    this.#assertReady();
    await this.#capabilities.assertAuthorized({
      jobId: input.jobId,
      requirements: [{ capability: 'READ', resource: LOCAL_AI_MODEL_ROUTE_SELECT_RESOURCE }],
    }, input.token);

    let candidatesConsidered = 0;
    try {
      const managers = await this.#modelManager.listManagers(input);
      const candidates: LocalAIModelSelection[] = [];
      for (const manager of managers) {
        const models = await this.#modelManager.listModels({
          jobId: input.jobId,
          token: input.token,
          providerId: manager.provider.id,
        });
        for (const model of models) {
          candidates.push(Object.freeze({ providerId: manager.provider.id, modelId: model.id }));
        }
      }
      candidates.sort((a, b) => selectionKey(a).localeCompare(selectionKey(b)));
      candidatesConsidered = candidates.length;
      if (candidates.length === 0) throw new Error('Local AI Model Routing found no installed local models.');

      if (input.preferred) {
        const preferred = normalizeSelection(input.preferred);
        const selected = candidates.find((candidate) => selectionKey(candidate) === selectionKey(preferred));
        if (!selected) throw new Error(`Preferred local AI model is not installed: ${preferred.providerId}/${preferred.modelId}.`);
        return await this.#succeed(selected, 'preferred', candidatesConsidered);
      }

      const defaultModel = await this.#modelManager.getDefaultModel(input);
      if (defaultModel) {
        const selected = candidates.find((candidate) => selectionKey(candidate) === selectionKey(defaultModel));
        if (!selected) throw new Error(`Default local AI model is not installed: ${defaultModel.providerId}/${defaultModel.modelId}.`);
        return await this.#succeed(selected, 'default', candidatesConsidered);
      }

      return await this.#succeed(candidates[0]!, 'fallback', candidatesConsidered);
    } catch (error) {
      await this.#eventBus?.publish('gd.local.ai-model-routing.operation', {
        operation: 'routes.select',
        providerId: null,
        modelId: null,
        reason: null,
        outcome: 'failure',
        candidatesConsidered,
        occurredAt: this.#now(),
        persistence: false,
      });
      throw error;
    }
  }

  shutdown(): void {
    this.#ready = false;
  }

  async #succeed(
    selection: LocalAIModelSelection,
    reason: LocalAIModelRouteReason,
    candidatesConsidered: number,
  ): Promise<LocalAIModelRouteDecision> {
    const decision = Object.freeze({
      schema: LOCAL_AI_MODEL_ROUTE_DECISION_SCHEMA,
      providerId: selection.providerId,
      modelId: selection.modelId,
      reason,
      candidatesConsidered,
      deterministic: true as const,
      localOnly: true as const,
    });
    await this.#eventBus?.publish('gd.local.ai-model-routing.operation', {
      operation: 'routes.select',
      providerId: decision.providerId,
      modelId: decision.modelId,
      reason: decision.reason,
      outcome: 'success',
      candidatesConsidered,
      occurredAt: this.#now(),
      persistence: false,
    });
    return decision;
  }

  #assertReady(): void {
    if (!this.#ready) throw new Error('Local AI Model Routing is not ready.');
  }
}

export function createLocalAIModelRouting(options: LocalAIModelRoutingOptions): LocalAIModelRouting {
  return new LocalAIModelRouting(options);
}
