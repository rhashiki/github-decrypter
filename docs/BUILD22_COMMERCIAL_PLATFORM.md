# Build 22 — Commercial Platform

## Objetivo
Transformar a camada já existente de licenças, créditos e checkout avulso em uma plataforma comercial server-authoritative, sem substituir os mecanismos validados das Builds 21 e anteriores.

## Trial
- 4 horas contínuas (14.400 segundos), contadas no servidor desde `started_at`.
- Não pausa ao fechar navegador/extensão.
- Uma utilização por hash de e-mail e uma por hash de dispositivo.
- Emite a mesma identidade LD2 usada pelo restante do produto.
- `max_devices=1`; o dispositivo é vinculado no momento da emissão.
- Expiração continua sendo aplicada pelo campo autoritativo `ld_license_keys.expires_at`.

## Planos recorrentes
A Build 22 não inventa preços novos. Os planos recorrentes iniciais reutilizam o catálogo já existente:
- `subscription_monthly` → preço de `time_30d`.
- `subscription_annual` → preço de `time_365d`.

A tabela `ld_commercial_plans` referencia diretamente `ld_products`, permitindo alterar o catálogo posteriormente sem duplicar a fonte de verdade de preço.

## Mercado Pago
- Compra avulsa continua em `ld-checkout-create`.
- Assinatura usa `/preapproval`.
- Renovação/status usa `subscription_preapproval` e `subscription_authorized_payment`.
- O webhook continua validando `x-signature` antes de processar qualquer evento.
- Eventos são idempotentes por `event_key`.
- Cancelamento preserva acesso somente até `current_period_end` já pago.

## Entitlements
`ld_license_keys` recebe:
- `commercial_tier`: `legacy | owner | trial | subscription`.
- `byok_allowed`.
- `byok_enabled`.

`public.ld_commercial_snapshot(uuid)` agrega licença, trial, assinatura, plano, validade e créditos em uma resposta única para o backend. A função não é executável por `PUBLIC`, `anon` ou `authenticated`; somente `service_role`.

## BYOK
BYOK é opcional. A plataforma comercial registra somente a preferência/entitlement (`byok_enabled`/`byok_allowed`). A chave Gemini continua no cliente e não é gravada nas tabelas comerciais.

## UI
`content/commercial-runtime.js` adiciona ao Unified Launcher:
- status comercial real;
- trial 4h para quem ainda não possui KEY;
- planos recorrentes para uma KEY existente;
- acesso ao checkout avulso de créditos/tempo.

O runtime é bounded/idempotente e não usa `MutationObserver`, monkeypatch de `fetch`, XHR ou `sendBeacon`.

## Banco e segurança
Tabelas novas:
- `ld_commercial_plans`
- `ld_trials`
- `ld_subscriptions`
- `ld_subscription_events`

Todas usam RLS e não concedem acesso a `anon`/`authenticated`. Edge Functions acessam pelo backend privilegiado; secrets do Mercado Pago, owner e service role não entram no browser.

## Compatibilidade
Preservados:
- checkout avulso e reversão por refund/chargeback;
- sistema de créditos e 4 comandos por crédito;
- Trust LDT1 / Model Gateway da Build 21;
- Gemini gratuito por padrão;
- Decrypter Local;
- `cross_provider_fallback=false`;
- boot order e Composer Guardian.

A Build 22 não publica OTA/release oficial automaticamente.
