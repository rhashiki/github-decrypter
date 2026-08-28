# Build 17 — Model Gateway

## Objetivo

Separar a identidade **Decrypter AI** do provider técnico usado para executar uma tarefa. O usuário escolhe apenas um perfil lógico (`auto`, `fast` ou `deep`); o backend resolve provider e modelo.

## Pipeline

`User → Brain/Rules/Skills → Decrypter Intelligence → Decrypter Knowledge → Execution Brief → Model Gateway → provider executor → Scope Lock → checkpoints/apply/commit`

O Gateway não substitui o Intelligence. Ele recebe o Execution Brief já classificado e usa apenas intenção/risco para escolher o perfil de execução.

## Autoridade

O Model Gateway é **server-authoritative**: a decisão final de provider/modelo pertence ao backend.

A rota oficial de Plan/Build não chama mais `ld-command` diretamente no cliente.

`GeminiAgent.backendCommand` é envolvido por `background/model-gateway-bootstrap.js` e envia a execução para `ld-model-gateway`.

`ld-model-gateway`:

1. valida a KEY LD2;
2. valida o dispositivo vinculado;
3. normaliza o modo `auto/fast/deep`;
4. lê intenção/risco do Execution Brief;
5. resolve o perfil;
6. valida novamente ZERO COST no servidor;
7. resolve o modelo;
8. encaminha ao executor atual;
9. devolve a decisão `ld-model-gateway/1` junto do resultado.

Se a resposta não contiver uma decisão válida e autoritativa, o bootstrap falha fechado.

## Modos

### Automático

Padrão do produto.

- risco `high` ou `critical` → `deep`;
- Build com intenção `security`, `database`, `auth` ou `migration` e risco `medium` → `deep`;
- demais casos → `fast`.

### Rápido

Força o perfil `fast`.

### Profundo

Força o perfil `deep`.

## Providers

Registro inicial:

- **Gemini** — ativo como executor técnico;
- **Decrypter Local** — registrado, mas inativo até Build 18;
- **Premium Provider** — registrado como futuro.

Não existe fallback silencioso entre providers. `cross_provider_fallback=false` é um invariante da Build 17.

## Modelos atuais

Perfil rápido padrão: `gemini-3.6-flash`.

Perfil profundo padrão: `gemini-2.5-pro`.

As preferências configuradas pelo usuário podem ser usadas quando passam pelas validações do Gateway. No modo ZERO COST, o backend reaplica uma allowlist própria antes de chamar o executor. Uma preferência inválida pode cair para o modelo seguro do **mesmo provider** e isso fica registrado como fallback explícito.

## Decrypter AI

A UI deixa de apresentar Gemini como identidade principal. O tile passa a ser:

`Decrypter AI · Automático`

O modal **Model Gateway** mostra:

- modo atual;
- autoridade do backend;
- último perfil;
- último provider;
- último modelo;
- fallback, quando houve;
- registry de providers.

## Activity Center

A decisão do Gateway é correlacionada com a operação ativa pelo `requestId`/operação observada e exibida no detalhe:

`Automático → FAST · gemini · gemini-3.6-flash`

O histórico do Gateway guarda somente metadados de roteamento. Não persiste prompt, conteúdo de arquivos, Knowledge context, Rules, Brain ou anexos.

## Falhas

- Gateway indisponível → Plan/Build falha fechado.
- Provider ativo indisponível → erro; não tenta outro provider.
- resposta sem schema válido → bloqueada pelo bootstrap.
- modelo incompatível/fora da allowlist ZERO COST → fallback explícito dentro do mesmo provider ou bloqueio no executor.

## Escopo não alterado

Continuam independentes:

- Decrypter Intelligence;
- Decrypter Knowledge;
- Project Rules;
- Skills;
- Scope Lock;
- Queue;
- Composer Guardian;
- checkpoints;
- commit authority;
- Update & Recovery.

## Deferred

**Build 18 — Decrypter AI Runtime / Decrypter Local** adicionará o primeiro provider próprio ao registry. Até lá, o registry já sabe que ele existe, mas `active=false` impede seleção ou fallback para ele.
