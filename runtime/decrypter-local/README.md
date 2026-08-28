# Decrypter Local Runtime — Build 18

This directory defines the first self-hosted inference runtime for Lovable Decrypter.

## Recommended model

`Qwen/Qwen3-Coder-30B-A3B-Instruct`

The runtime deliberately exposes the stable logical model name `decrypter-local` to the Decrypter backend. The concrete base model stays server-side and may be upgraded without changing the extension contract.

## Runtime

The reference deployment uses the OpenAI-compatible vLLM server. It is NOT bundled into the Chrome extension and model weights are never shipped to the browser.

1. Copy `.env.example` to a private deployment environment.
2. Generate a long random `RUNTIME_TOKEN`.
3. Start the service with Docker Compose on a GPU host.
4. Put the runtime behind private HTTPS/reverse proxy networking. Do not expose the raw vLLM port publicly without authentication and network controls.
5. Configure the backend-only Edge Function secrets `DECRYPTER_LOCAL_URL`, `DECRYPTER_LOCAL_TOKEN`, `DECRYPTER_LOCAL_MODEL`, and `DECRYPTER_LOCAL_MODEL_LABEL`.

The Supabase backend considers the provider active only after an authenticated `/v1/models` probe confirms the configured served model.

## Contract

Health probe:

- `GET /v1/models`
- `Authorization: Bearer <runtime token>`
- must list the configured served model, default `decrypter-local`

Inference:

- `POST /v1/chat/completions`
- OpenAI-compatible messages
- JSON Schema response format
- non-streaming
- temperature kept low for deterministic repository edits

## Provider policy

Build 18 does not perform cross-provider retry. The Model Gateway chooses a provider before execution. If Decrypter Local is selected and fails after execution starts, the request fails closed instead of retrying Gemini.

The Local provider is eligible only when:

- backend runtime secrets are configured;
- `/v1/models` health passes;
- the served model is present;
- attachments are text-compatible for this text-only coder runtime.

Multimodal/binary attachments keep the request on the Gemini executor until a multimodal Decrypter runtime exists.

## Model upgrades

The extension and Model Gateway depend on `provider=decrypter-local` and the logical served name, not directly on the Qwen checkpoint. Future Build 20 fine-tuning can replace the model behind the same private contract.
