# Build 23 — Mass Scale / GPU Autoscaling

## Objetivo

Escalar `decrypter-local` horizontalmente sem alterar sua identidade de provider e sem amarrar o produto a um fornecedor específico de GPU.

## Arquitetura

`Model Gateway -> ld-command -> worker lease -> vLLM worker`

O Model Gateway continua escolhendo `decrypter-local` **antes da execução**. A Build 23 não adiciona um salto entre Edge Functions: o próprio `ld-command` consulta o control plane via RPC, adquire atomicamente um worker saudável e chama o endpoint HTTPS desse worker diretamente. Isso evita fan-out Edge-Function-to-Edge-Function e mantém a regra absoluta de não fazer retry cross-provider depois que a execução Local começou.

`DECRYPTER_LOCAL_URL` permanece apenas como fallback legado para um runtime único caso o pool da Build 23 não exista. No modo normal da Build 23, os endpoints dos workers vêm do control plane e nunca são enviados ao navegador.

## Control plane

O Supabase mantém apenas estado operacional:

- `ld_inference_pools` — política do pool;
- `ld_inference_workers` — workers, heartbeat, capacidade e métricas;
- `ld_inference_jobs` — fila de despacho sem payload;
- `ld_inference_leases` — leases atômicos por request;
- `ld_inference_rate_windows` — limite global por minuto;
- `ld_inference_scale_decisions` — decisões de autoscaling.

Todas as tabelas têm RLS habilitado e acesso de `anon`/`authenticated` revogado. As RPCs de claim/release/snapshot são executáveis apenas por `service_role`.

## Privacidade da fila

Nenhum prompt, contexto de repositório, código do cliente ou anexo é persistido na fila de inferência. `ld_inference_jobs` guarda apenas IDs, estado, timestamps, worker e código de erro. O corpo do pedido permanece apenas em memória durante a chamada direta `ld-command -> worker`.

## Load balancing

`ld_claim_inference_worker` usa transação e `FOR UPDATE SKIP LOCKED` para selecionar o worker saudável com menor ocupação relativa. Cada worker possui capacidade máxima de in-flight e o pool também impõe um teto por worker.

Leases vencidos são liberados automaticamente; o reap marca heartbeats vencidos como `offline` e faz GC de janelas de rate limit, decisões e jobs terminais.

## Batching

Não existe coalescência de prompts entre clientes. Cada comando mantém isolamento próprio. O dispatcher aceita concorrência por worker para que o próprio vLLM execute continuous batching internamente.

## Health e telemetria

O agente sidecar usa APIs oficiais do vLLM:

- `/health`;
- `/v1/models`;
- `/metrics`.

Ele envia ao control plane somente métricas operacionais como requests running/waiting, KV-cache usage e latência do probe.

## Autoscaling

O snapshot calcula `desired_workers` a partir de `queued_jobs + inflight`, limitado por `min_workers`, `max_workers` e `target_inflight_per_worker`.

Scale-to-zero é suportado: o `provider_status` do `ld-command` pode solicitar um worker quente quando não há capacidade pronta. Enquanto o worker não registra heartbeat saudável, o Model Gateway considera Local indisponível e pode escolher Gemini — ainda **antes** da execução.

Scale-up também pode ser solicitado quando um claim encontra saturação ou quando a ocupação ativa excede a meta. Scale-down é reavaliado nos heartbeats e respeita cooldown para não derrubar workers recém-criados.

## Actuator provider-neutral

Quando `DECRYPTER_GPU_SCALER_URL` e `DECRYPTER_GPU_SCALER_TOKEN` existem no backend, `ld-command` e `ld-local-control` podem enviar:

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

O actuator externo é quem provisiona/encerra GPUs. Pode ser implementado com Kubernetes, RunPod, Modal ou outro provedor. Sem actuator configurado, a Build 23 registra a decisão como `not_configured` e não finge que infraestrutura foi criada.

## Segurança

- workers só registram endpoint HTTPS;
- registro/heartbeat exigem secret backend/worker;
- ações administrativas usam owner secret;
- runtime token é backend-only e pode ser lido pelo `ld-command` via Vault;
- endpoint do worker nunca chega ao navegador;
- sem `MutationObserver` global, monkeypatch de `fetch`, XHR ou `sendBeacon`;
- sem chamada aninhada de Edge Function na rota de inferência;
- sem cross-provider retry após início da execução;
- nenhum peso de modelo entra no pacote da extensão.

## Release

A Build 23 gera apenas um artifact candidato e não publica OTA/release oficial automaticamente.
