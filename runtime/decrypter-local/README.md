# Decrypter Local Runtime — Build 60

Build 60 turns the existing Build 23 GPU pool into a runtime-neutral local inference layer. Ollama is the default runtime; vLLM remains supported through `compose.vllm.yaml`.

## Default model

- stable Decrypter served model: `decrypter-local`
- Ollama runtime model: `qwen3-coder:30b`
- backend display label: `Qwen3-Coder 30B A3B · Ollama`

The extension never receives model weights, worker endpoints or worker secrets.

## Topology

`Decrypter AI -> Model Gateway -> ld-command -> leased worker -> authenticated gateway -> Ollama`

The worker endpoint implements only the OpenAI-compatible contract needed by `ld-command`: `/v1/models` and `/v1/chat/completions`. The Ollama API stays private behind `ollama-gateway.py`, which enforces the backend-only bearer token and rewrites the stable `decrypter-local` name to the real Ollama model.

`worker-agent.py` runs beside the runtime and:

- checks `/health`;
- verifies the stable served model through `/v1/models`;
- reads `/metrics` without touching prompts;
- registers the worker in `ld-local-control` with its actual runtime family and runtime model;
- sends health/metrics heartbeats;
- never reads, stores or uploads inference prompts or responses.

## Structured output

The Decrypter build/plan schemas reach the worker through the OpenAI-compatible `response_format` contract. Ollama handles the JSON schema while `ld-command` continues to validate the returned plan/build before any patch can be applied.

## Scale-to-zero

The control plane remains provider-neutral. `min_workers=0`, so the local pool may stay at zero when idle. If a provider-status check or dispatch needs local capacity, the existing scaler contract may request a worker. If no scaler or worker is available, local remains unhealthy and the Model Gateway chooses the allowed Gemini free path before execution. There is no provider switch after an execution starts.

## Running a worker

1. Copy `.env.example` to the private worker host and set strong server-only secrets.
2. Route `DECRYPTER_WORKER_ENDPOINT` over authenticated HTTPS to local port 8000.
3. Start `docker compose up -d` for the Ollama profile.
4. The compose stack pulls `qwen3-coder:30b`, starts the authenticated gateway, then registers the worker.
5. For vLLM, use `docker compose -f compose.vllm.yaml up -d` with the same control-plane secrets.

No cloud GPU is provisioned by this repository automatically. A worker becomes available only when your own machine/GPU or an explicitly configured external scaler actually starts one.

## Final homologation

After the worker stack is up and `worker-agent.py` has registered the instance, run:

```bash
python runtime/decrypter-local/homologate.py
```

The probe uses the same private environment variables as the worker and validates, in order:

1. `/health` is healthy and reports the stable `decrypter-local` served model;
2. authenticated `/v1/models` exposes `decrypter-local`;
3. required runtime metrics are available;
4. a real authenticated chat completion succeeds through the public worker gateway;
5. the completion reports `zero_cost_api=true` and keeps the stable served-model identity;
6. metrics remain readable after inference;
7. when `DECRYPTER_CONTROL_URL` and `DECRYPTER_WORKER_SECRET` are configured, `ld-local-control` reports the same instance as `ready` with the expected model contract.

The homologator never prints secrets, prompts or completion content. It emits only pass/fail metadata and returns a non-zero exit code on any failed invariant.

For a full Build 60 sign-off, the control-plane check must not be skipped. A successful report with `checks.control_plane.worker_ready=true` is the evidence that the physical worker, authenticated gateway, heartbeat registration and local inference path are all operating together.

## Security invariants

- runtime bearer and worker-control secrets are backend-only;
- public worker endpoint must be HTTPS;
- payload persistence is disabled at the Decrypter control-plane layer;
- the inference queue stores metadata only;
- binary/multimodal attachments stay off the local provider until a compatible local model is approved;
- zero-cost API policy remains mandatory;
- no cross-provider retry after execution begins.
