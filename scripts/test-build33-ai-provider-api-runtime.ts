import assert from 'node:assert/strict';
import {
  AI_PROVIDER_REQUEST_SCHEMA,
  AI_PROVIDER_RESPONSE_SCHEMA,
  assertAIProviderAdapter,
  assertAIProviderDescriptor,
  assertAIProviderGenerateRequest,
  assertAIProviderGenerateResultForRequest,
  createAIProviderDescriptor,
  createAIProviderGenerateRequest,
  createAIProviderModelDescriptor,
  validateAIProviderModelList,
  type AIProviderAdapter,
  type AIProviderGenerateResult,
} from '../packages/ai/src/index.js';

const localDescriptor = createAIProviderDescriptor({
  id: 'local-test',
  displayName: 'Local Test Provider',
  kind: 'local',
  credentialMode: 'none',
});
assert.equal(Object.isFrozen(localDescriptor), true);
assert.equal(localDescriptor.id, 'local-test');
assert.equal(localDescriptor.kind, 'local');

const localModel = createAIProviderModelDescriptor({
  providerId: localDescriptor.id,
  id: 'coder:test',
  displayName: 'Coder Test',
  contextWindowTokens: 32768,
  maxOutputTokens: 4096,
});
assert.equal(Object.isFrozen(localModel), true);

const localAdapter: AIProviderAdapter = {
  descriptor: localDescriptor,
  async listModels() { return [localModel]; },
  async generate(request) {
    assertAIProviderGenerateRequest(request);
    return {
      schema: AI_PROVIDER_RESPONSE_SCHEMA,
      providerId: request.providerId,
      modelId: request.modelId,
      text: 'normalized fake response',
      finishReason: 'stop',
      usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
    };
  },
};
assertAIProviderAdapter(localAdapter);

const models = validateAIProviderModelList(localDescriptor.id, await localAdapter.listModels());
assert.equal(models.length, 1);
assert.equal(models[0]?.id, 'coder:test');
assert.equal(Object.isFrozen(models), true);

const request = createAIProviderGenerateRequest({
  providerId: localDescriptor.id,
  modelId: localModel.id,
  messages: [
    { role: 'system', content: 'Respond as a deterministic test adapter.' },
    { role: 'user', content: 'Return a normalized response.' },
  ],
  maxOutputTokens: 128,
  temperature: 0,
});
assert.equal(request.schema, AI_PROVIDER_REQUEST_SCHEMA);
assert.equal(Object.isFrozen(request), true);
assert.equal(Object.isFrozen(request.messages), true);

const result = await localAdapter.generate(request);
assertAIProviderGenerateResultForRequest(result, request);
assert.equal(result.text, 'normalized fake response');
assert.equal(result.usage?.totalTokens, 10);

const externalDescriptor = createAIProviderDescriptor({
  id: 'external-test',
  displayName: 'External Test Provider',
  kind: 'external',
  credentialMode: 'runtime-vault',
});
assertAIProviderDescriptor(externalDescriptor);
assert.equal(externalDescriptor.credentialMode, 'runtime-vault');

assert.throws(
  () => createAIProviderDescriptor({
    id: 'local-invalid',
    displayName: 'Invalid Local Provider',
    kind: 'local',
    credentialMode: 'runtime-vault',
  }),
  /Local AI providers cannot require transported credentials/,
);

assert.throws(
  () => assertAIProviderDescriptor({ ...localDescriptor, apiKey: 'must-not-pass' }),
  /unsupported field apiKey/,
);

assert.throws(
  () => assertAIProviderGenerateRequest({ ...request, endpointUrl: 'must-not-pass' }),
  /unsupported field endpointUrl/,
);

assert.throws(
  () => validateAIProviderModelList(localDescriptor.id, [localModel, localModel]),
  /duplicated/,
);

const foreignModel = createAIProviderModelDescriptor({
  providerId: externalDescriptor.id,
  id: 'remote:model',
  displayName: 'Remote Model',
  contextWindowTokens: null,
  maxOutputTokens: null,
});
assert.throws(
  () => validateAIProviderModelList(localDescriptor.id, [foreignModel]),
  /different provider/,
);

const mismatchedResult: AIProviderGenerateResult = {
  schema: AI_PROVIDER_RESPONSE_SCHEMA,
  providerId: externalDescriptor.id,
  modelId: request.modelId,
  text: '',
  finishReason: 'other',
  usage: null,
};
assert.throws(
  () => assertAIProviderGenerateResultForRequest(mismatchedResult, request),
  /does not match the requested provider\/model identity/,
);

assert.throws(
  () => assertAIProviderGenerateResultForRequest({
    schema: AI_PROVIDER_RESPONSE_SCHEMA,
    providerId: request.providerId,
    modelId: request.modelId,
    text: 'x',
    finishReason: 'stop',
    usage: null,
    rawResponse: { unsafe: true },
  }, request),
  /unsupported field rawResponse/,
);

console.log(JSON.stringify({
  ok: true,
  schema: 'gd-build33-ai-provider-runtime/1',
  localAdapterContract: true,
  externalAdapterMetadata: true,
  exactPublicSchemas: true,
  providerModelOwnership: true,
  responseCorrelation: true,
  secretFieldRejection: true,
  rawResponseRejection: true,
  actualInferenceExecution: false,
}, null, 2));
