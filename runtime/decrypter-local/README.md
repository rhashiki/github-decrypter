# Decrypter Local Runtime — Builds 18 + 23

Build 18 introduced one authenticated vLLM endpoint. Build 23 preserves the logical provider/model contract while allowing many GPU workers behind a Supabase-backed control plane.

## Recommended model

`Qwen/Qwen3-Coder-30B-A3B-Instruct`

Every worker exposes the stable served model `decrypter-local`. Model weights and future Decrypter-Coder adapters remain server-side and never ship in the extension.

## Build 23 topology

`Model Gateway -> ld-command -> leased GPU worker -> vLLM`

There is no Edge-Function-to-Edge-Function inference hop. `ld-command` uses the control-plane RPCs to atomically lease the least-loaded healthy worker and calls that worker's authenticated HTTPS endpoint directly. Worker endpoints are never returned to the browser.

A sidecar `worker-agent.py` runs beside each vLLM instance. It:

- checks `/health`;
- verifies `decrypter-local` through `/v1/models`;
- reads `/metrics` for running/waiting requests and KV-cache usage;
- registers the worker in `ld-local-control`;
- sends heartbeats every 15 seconds by default;
- never reads, persists or uploads inference prompts.

The inference queue is metadata-only: request ID, timestamps, worker/lease, state and outcome. Project source code, prompts and attachments are not stored there.

## Continuous batching

Build 23 never coalesces different customer prompts at application level. Each command remains isolated. Per-worker concurrency lets vLLM perform native continuous batching internally.

## Autoscaling

The control plane calculates `desired_workers` from queued + in-flight demand, bounded by `min_workers`, `max_workers`, per-worker capacity and a scale-down cooldown. Provider-status probes can request one warm worker when the pool is at zero, enabling scale-to-zero without changing the Model Gateway.

If backend-only `DECRYPTER_GPU_SCALER_URL` and `DECRYPTER_GPU_SCALER_TOKEN` are configured, `ld-command` / `ld-local-control` send the provider-neutral `ld-gpu-scale/1` contract to that actuator. The actuator may use Kubernetes, RunPod, Modal, another GPU platform or a custom controller. Without an actuator, the decision is recorded as `not_configured`; no infrastructure is falsely reported as provisioned.

## Runtime setup

1. Copy `.env.example` to each private GPU deployment.
2. Use the same strong `RUNTIME_TOKEN` that is stored backend-side as `DECRYPTER_LOCAL_TOKEN`.
3. Put each vLLM runtime behind authenticated HTTPS reachable from `ld-command`.
4. Set a unique `DECRYPTER_WORKER_INSTANCE_KEY` and `DECRYPTER_WORKER_ENDPOINT`.
5. Configure `DECRYPTER_WORKER_SECRET` for registration/heartbeat.
6. Start `docker compose up -d` on each GPU worker.
7. Optionally attach a provider-specific scaler through the generic actuator contract.

`DECRYPTER_LOCAL_URL` is retained only as a legacy single-runtime fallback when the Build 23 pool is absent.

## Provider policy

There is still no cross-provider retry after execution starts. The Model Gateway chooses a provider before execution. Decrypter Local is healthy only when the pool has a ready worker with an available lease slot. If capacity is unavailable before execution, routing may stay on Gemini; after a Local execution begins, a worker failure fails closed instead of switching providers.

Multimodal/binary attachments remain on Gemini until a multimodal Decrypter runtime exists.
