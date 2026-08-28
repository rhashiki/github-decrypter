# Build 18 — Decrypter AI Runtime / Decrypter Local

## Objetivo

Adicionar o primeiro provider open-weight/self-hosted ao Model Gateway sem colocar pesos, segredos ou lógica proprietária no navegador.

A Build 18 implementa o provider **decrypter-local** e o runtime de referência, mas o provider só fica `active=true` quando um host privado real passa no health-check. Não existe status falso de disponibilidade.

## Modelo inicial recomendado

`Qwen/Qwen3-Coder-30B-A3B-Instruct`

Nome lógico servido ao backend: `decrypter-local`.

O contrato do produto depende do nome lógico/provider, não diretamente do checkpoint. Isso permite trocar o modelo base ou, na Build 20, substituir pelo Decrypter-Coder fine-tuned sem mudar a extensão.

## Runtime de referência

`runtime/decrypter-local/compose.yaml` sobe um servidor vLLM OpenAI-compatible.

Defaults relevantes:

- bind local: `127.0.0.1`;
- API key obrigatória;
- modelo: `Qwen/Qwen3-Coder-30B-A3B-Instruct`;
- served model: `decrypter-local`;
- prefix caching ativo;
- contexto operacional padrão limitado a 65.536 tokens, mesmo que o checkpoint suporte contexto maior.

O runtime deve ser colocado atrás de HTTPS/rede privada antes de ser usado pelo backend.

## Segredos

Somente backend:

- `DECRYPTER_LOCAL_URL`
- `DECRYPTER_LOCAL_TOKEN`
- `DECRYPTER_LOCAL_MODEL`
- `DECRYPTER_LOCAL_MODEL_LABEL`

Nenhum desses valores é enviado à extensão, ao Lovable ou ao histórico do Activity Center.

## Health gate

O executor provider-neutral `ld-command` expõe `action=provider_status` exclusivamente para o Model Gateway autenticado por HMAC interno derivado do `SUPABASE_SERVICE_ROLE_KEY`.

O health real consulta:

`GET <private-runtime>/v1/models`

com Bearer token e exige que o served model configurado esteja carregado.

Estados:

- `LOCAL_RUNTIME_NOT_CONFIGURED`: nenhuma infraestrutura GPU configurada;
- `LOCAL_MODEL_NOT_LOADED`: endpoint respondeu, mas o modelo esperado não está carregado;
- `LOCAL_HEALTH_TIMEOUT` / `LOCAL_HEALTH_FAILED`: runtime degradado;
- `OK`: provider elegível.

## Roteamento

`User → Decrypter Intelligence → Knowledge → Model Gateway → provider → ld-command → Scope Lock → checkpoints/apply/commit`

O Gateway resolve provider **antes** de executar:

1. consulta o health do Decrypter Local;
2. verifica se os anexos são compatíveis com o coder text-only;
3. se Local está saudável e o request é compatível, seleciona `decrypter-local`;
4. caso contrário seleciona Gemini;
5. depois que a execução inicia, NÃO existe retry em outro provider.

Isso não é cross-provider fallback durante falha. É preflight de disponibilidade antes da escolha autoritativa.

## Anexos

Nesta Build, Decrypter Local aceita apenas anexos textuais compatíveis (`text/*`, JSON/XML/JS/TS).

Imagem, áudio, vídeo, PDF e outros binários continuam no executor compatível do Gateway. O runtime Local não finge capacidade multimodal.

## Executor provider-neutral

`ld-command` continua sendo a autoridade única para:

- autenticação da licença/dispositivo;
- reserva/conclusão de créditos;
- logs;
- schemas de Plan/Build;
- validação de patch mínimo;
- bloqueio de delete não explícito;
- validação de paths;
- limite de arquivos.

O provider muda apenas a camada de inferência:

- `gemini` → Gemini Interactions;
- `decrypter-local` → OpenAI-compatible `/v1/chat/completions`.

Local só pode ser solicitado por chamada interna assinada pelo Gateway.

## Telemetria

Quando o executor reporta `usage`, `ld-command` normaliza:

- input tokens;
- output tokens;
- total tokens;
- provider;
- runtime/model.

Custo permanece `null` para Decrypter Local nesta fase; custo de infraestrutura será tratado pela plataforma comercial/telemetria de GPU, não inventado por chamada.

## UI

O Unified Launcher recebe o card **Decrypter Local**.

Ele mostra apenas:

- ativo / degradado / runtime não configurado;
- modelo público recomendado;
- served model lógico;
- health code;
- latência do health;
- política de retry.

URL privada e tokens nunca são exibidos.

## Segurança

- HMAC interno entre `ld-model-gateway` e `ld-command`;
- Local provider é `gateway-only`;
- sem segredo do runtime no browser;
- sem cross-provider retry;
- sem bypass de crédito/entitlement;
- response JSON continua passando pela mesma validação de Build;
- `Scope Lock` e commit authority permanecem posteriores ao provider.

## Estado de infraestrutura

A Build 18 pode ser integrada mesmo sem GPU provisionada. Nesse estado, o código/provider está completo, mas `Decrypter Local` aparece como `RUNTIME NÃO CONFIGURADO` e o Gateway usa o executor disponível antes da execução.

Ativar o provider requer apenas provisionar um host compatível e configurar os segredos backend; não exige nova versão da extensão.
