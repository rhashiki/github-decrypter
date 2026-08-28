# Build 23 — Mass Scale / GPU Autoscaling

## Objetivo

Escalar `decrypter-local` horizontalmente sem alterar o contrato da Build 18 e sem amarrar o produto a um fornecedor específico de GPU.

## Arquitetura

`Model Gateway -> ld-command -> ld-local-router -> pool -> vLLM workers`

O `ld-command` continua usando exatamente `DECRYPTER_LOCAL_URL`, `DECRYPTER_LOCAL_TOKEN` e o modelo lógico `decrypter-local`. Na Build 23, `DECRYPTER_LOCAL_URL` aponta para `ld-local-router`, que implementa `/v1/models` e `/v1/chat/completions` de forma compatível com o contrato já existente.

## Control plane

O Supabase passa a manter apenas estado operacional:

- `ld_inference_pools` — política do pool;
- `ld_inference_workers` — workers, heartbeat, capacidade e métricas;
- `ld_inference_jobs` — fila de despacho sem payload;
- `ld_inference_leases` — leases atômicos por request;
- `ld_inference_rate_windows` — limite global por minuto;
- `ld_inference_scale_decisions` — decisões de autoscaling.

Todas as tabelas têm RLS habilitado e acesso de `anon`/`authenticated` revogado. As RPCs de claim/release/snapshot são executáveis apenas por `service_role`.

## Privacidade da fila

Nenhum prompt, contexto de repositório, código do cliente ou anexo é persistido na fila de inferência. `ld_inference_jobs` guarda apenas IDs, estado, timestamps, worker e código de erro. O corpo da requisição existe somente durante o encaminhamento HTTP pelo router.

## Load balancing

`ld_claim_inference_worker` usa transação e `FOR UPDATE SKIP LOCKED` para escolher o worker saudável com menor ocupação relativa. Cada worker possui capacidade máxima de in-flight e o pool também impõe um teto por worker.

Leases vencidos são reaproveitados automaticamente; o reap também marca heartbeats vencidos como `offline` e faz GC de janelas de rate limit, decisões e jobs terminais.

## Batching

Não existe coalescência de prompts entre clientes. Cada comando mantém isolamento próprio. O router aceita concorrência por worker para que o próprio vLLM execute continuous batching internamente.

## Health e telemetria

O agente sidecar usa APIs oficiais do vLLM:

- `/health`;
- `/v1/models`;
- `/metrics`.

Ele envia ao control plane somente métricas operacionais como requests running/waiting, KV-cache usage e latência do probe.

## Autoscaling

O snapshot calcula `desired_workers` a partir de `queued_jobs + inflight`, limitado por `min_workers`/`max_workers` e `target_inflight_per_worker`.

Scale-to-zero é suportado: quando `/v1/models` recebe demanda e não há capacidade pronta, o router pode solicitar um worker quente mesmo com `min_workers=0`. O Model Gateway usa Gemini enquanto o pool ainda não estiver pronto; isso ocorre **antes da execução**, preservando a regra de não fazer retry cross-provider depois que uma execução Local começou.

Scale-down respeita cooldown e é reavaliado pelos heartbeats. Um worker recém-criado não é derrubado imediatamente antes de ter chance de receber trabalho.

## Actuator provider-neutral

O control plane não contém SDK de RunPod, Kubernetes, Modal ou qualquer outro provedor. Quando `DECRYPTER_GPU_SCALER_URL` e `DECRYPTER_GPU_SCALER_TOKEN` existem no backend, ele envia:

```json
{
  "schema": "ld-gpu-scale/1",
  "pool_code": "decrypter-local-primary",
  "current_workers": 1,
  "ready_workers": 1,
  "queued_jobs": 3,
  "inflight": 4,
  "desired_workers": 4,
  "reason": "dispatch-saturated",
  "idempotency_key": "..."
}
```

O actuator externo é quem provisiona/encerra GPUs. Sem actuator configurado, a Build 23 registra a decisão como `not_configured` e **não finge que infraestrutura foi criada**.

## Segurança

- workers só registram endpoint HTTPS;
- registro/heartbeat exigem secret backend/worker;
- ações administrativas usam owner secret;
- runtime token continua backend-only;
- router não expõe endpoint de worker ao navegador;
- sem `MutationObserver` global, monkeypatch de `fetch`, XHR ou `sendBeacon`;
- sem cross-provider retry após início da execução;
- nenhum peso de modelo entra no pacote da extensão.

## Release

A Build 23 gera apenas um artifact candidato. Não publica OTA/release oficial automaticamente.
