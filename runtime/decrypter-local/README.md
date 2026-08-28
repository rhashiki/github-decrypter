# Decrypter Local Runtime — Builds 18 + 23

This directory defines the self-hosted inference runtime for Lovable Decrypter. Build 18 introduced one authenticated vLLM endpoint; Build 23 keeps the same OpenAI-compatible contract while allowing many GPU workers behind a provider-neutral router.

## Recommended model

`Qwen/Qwen3-Coder-30B-A3B-Instruct`

Every worker exposes the stable logical served model `decrypter-local`. Concrete checkpoints and future Decrypter-Coder adapters remain server-side and never ship in the extension.

## Build 23 topology

`ld-command -> ld-local-router -> worker pool -> vLLM`

The router is the only URL configured as `DECRYPTER_LOCAL_URL`. It leases the least-loaded healthy worker atomically, forwards the non-streaming OpenAI-compatible request, then releases the lease. Worker endpoints are never returned to the browser.

A sidecar `worker-agent.py` runs beside each vLLM instance. It:

- checks `/health`;
- verifies `decrypter-local` through `/v1/models`;
- reads `/metrics` for vLLM running/waiting requests and KV-cache usage;
- registers the worker in `ld-local-control`;
- sends a heartbeat every 15 seconds by default;
- never reads, persists or uploads inference prompts.

The dispatch queue is metadata-only: request ID, timestamps, worker/lease and outcome. Project source code and prompts are not stored in the inference queue.

## Continuous batching

Build 23 deliberately does not combine different customer prompts into a homemade application-level batch. Each command remains isolated. Concurrency per worker lets vLLM perform its native continuous batching internally, which preserves request boundaries while using GPU capacity efficiently.

## Autoscaling

The control plane calculates `desired_workers` from queued + in-flight demand, bounded by the pool's `min_workers` / `max_workers` and a scale-down cooldown. A health probe can request one warm worker when the pool is at zero, allowing scale-to-zero deployments to wake without changing the Model Gateway.

Provisioning is provider-neutral. If backend-only `DECRYPTER_GPU_SCALER_URL` and `DECRYPTER_GPU_SCALER_TOKEN` are configured, the router/control plane sends an `ld-gpu-scale/1` request containing only aggregate capacity information. The scaler may be implemented with Kubernetes, RunPod, Modal, another GPU platform, or a custom controller. Without an actuator, decisions are recorded but no infrastructure is provisioned automatically.

## Runtime setup

1. Copy `.env.example` to the private GPU deployment environment.
2. Generate a long random `RUNTIME_TOKEN` and a worker-control secret.
3. Put each vLLM runtime behind authenticated HTTPS that the Supabase router can reach.
4. Set a unique `DECRYPTER_WORKER_INSTANCE_KEY` and its `DECRYPTER_WORKER_ENDPOINT`.
5. Start `docker compose up -d` on each GPU worker.
6. Configure backend-only `DECRYPTER_LOCAL_URL` to the `ld-local-router` Edge Function and keep `DECRYPTER_LOCAL_TOKEN` private.
7. Optionally connect a provider-specific autoscaler through the generic actuator contract.

## Provider policy

There is still no cross-provider retry after execution starts. The Model Gateway chooses a provider before execution. `/v1/models` reports Decrypter Local healthy only when the pool has a ready worker with an available lease slot. If the pool is unavailable before execution, routing may remain on Gemini; if a selected Local execution later fails, it fails closed instead of retrying another provider.

Multimodal/binary attachments remain on Gemini until a multimodal Decrypter runtime exists.
