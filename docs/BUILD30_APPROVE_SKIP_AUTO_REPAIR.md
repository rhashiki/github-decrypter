# Build 30 — Aprovar/Pular + Auto Repair

Versão: `2.4.30`  
Trust protocol: `2.4.21`

## Objetivo

Transformar planos do Decrypter Chat e diagnósticos do Project Recovery Doctor em transações executáveis, sem remover as proteções das Builds anteriores.

Fluxo:

`Plan → freeze → Shadow Build → Validation Gate → Scope Lock → Guarded Commit → GitSync verification`

## Aprovar / Pular

- **Aprovar** congela o plano e autoriza sua execução.
- **Pular** pula somente a aprovação humana do plano.
- Pular nunca desativa whitelist de arquivos, Shadow Build, Validation Gate, Scope Lock, HEAD lock, Project State revision lock, Guarded Commit ou Trust Protocol.
- Frase de contrato: **Pular aprovação, não proteções.**

Cada transação possui:

- `planId` e `hash`;
- HEAD base do GitHub;
- revisão/hash do Unified Project State;
- whitelist de arquivos autorizados;
- expiração de 30 minutos;
- hash da validação do Shadow Build;
- proteção contra Apply duplicado.

Se HEAD ou Project State mudarem, a transação expira/bloqueia antes do commit.

## Auto Repair

O Project Recovery Doctor agora habilita **Auto Repair**. O fluxo primeiro gera um plano read-only e só depois oferece Aprovar/Pular.

Guardrails adicionais:

- migrations devem ser mínimas, incrementais e idempotentes;
- secrets, tokens e client secrets ausentes nunca são inventados ou recuperados;
- assets ausentes nunca viram placeholders;
- nenhum asset é baixado de URL arbitrária;
- quando os bytes reais do asset ou uma credencial forem indispensáveis e não estiverem disponíveis, o item permanece como warning/pendência humana;
- o Auto Repair não executa SQL diretamente no Supabase nesta Build; ele pode preparar/commitar migrations e código sob as mesmas proteções do GitHub.

## Autoridade e segurança

- Model Gateway, Decrypter Intelligence, Brain, Rules e Knowledge/RAG permanecem ativos.
- O executor recebe o plano congelado como `approvedPlan`.
- O resultado do executor deve permanecer dentro da whitelist do plano.
- `assertScopeLock()` roda antes de persistir o Shadow Build e novamente antes do commit.
- `GitAdapter.atomicCommit()` continua sendo a autoridade de escrita GitHub.
- O chat nativo do Lovable não recebe prompts do Decrypter.
- Não há monkeypatch global de `fetch`, XHR ou `sendBeacon`.
- Não há MutationObserver indiscriminado.

## Fora de escopo

- Nenhum OTA/GitHub Release.
- Nenhuma migration no backend do Lovable Decrypter.
- Nenhum Apply automático de SQL no Supabase do projeto do cliente.
- Nenhuma recuperação/exposição de valores secretos.

A Build 31 fará hardening e regressão final do ciclo técnico.
