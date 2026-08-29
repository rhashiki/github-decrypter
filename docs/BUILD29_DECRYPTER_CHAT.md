# Build 29 — Decrypter Chat

Version: `2.4.29`
Trust protocol: `2.4.21`

## Objetivo

Integrar o Decrypter Chat à mesma região visual ocupada pelo chat nativo do Lovable, com composer próprio e transação isolada. Quando o Decrypter está ativo, o caminho é `input → Decrypter`; o texto não é enviado ao Lovable.

## Modos

- **Chat** — conversa contextual read-only usando GitHub + Unified Project State + Brain + Rules + Knowledge/RAG + Model Gateway.
- **Planejar** — reutiliza o contrato autoritativo `LD2_PLAN_ONLY`.
- **Build** — reutiliza `LD2_PLAN_PREPARE` e para no Shadow Build.

A Build 29 nunca chama `LD2_PLAN_APPLY` nem `LD2_BUILD_EXECUTE` a partir do Chat. O Shadow Build não cria commit automaticamente.

## Chat nativo

O botão **Chat nativo** desliga o roteamento do Decrypter e devolve a região ao compositor original do Lovable. Para ligar novamente, o controle `Decrypter ON/OFF` do Editor Direto continua sendo a autoridade de ativação.

## Fail-closed

Estados públicos:

- `READY`
- `BUSY`
- `LOCKED`
- `DEGRADED`

Se a área de chat remonta, a geometria fica inválida, a licença falha ou o Decrypter perde o host visual, o roteamento continua bloqueando envios nativos. Não existe fallback automático para o Lovable.

A UI própria vive em Shadow DOM. Isso impede que o textarea do Decrypter seja confundido com o textarea nativo pelos guardiões existentes.

Não há monkeypatch global de `fetch`, XHR ou `sendBeacon`. A Build 29 não adiciona MutationObserver.

## Contexto

O runtime read-only do Chat usa o `GeminiAgent` já protegido por Decrypter Intelligence e Model Gateway. O contexto inclui:

- cache/árvore GitHub;
- arquivos relevantes;
- Unified Project State sanitizado;
- histórico recente do chat;
- Project Brain;
- Project Rules sincronizadas;
- Skills roteadas como contexto técnico;
- Decrypter Knowledge / RAG;
- Trust Protocol `2.4.21`.

Secret values, tokens e conteúdo sensível não entram no histórico do Chat nem no snapshot sanitizado. Nomes de secrets podem aparecer apenas como metadados diagnósticos.

## Persistência

O histórico é persistido por Lovable Project ID em `chrome.storage.local` e limitado a mensagens sanitizadas. Base64 de anexos não é persistido. Anexos são usados somente na requisição atual.

## Attachments

- até 8 arquivos;
- até 15 MB por arquivo;
- até 40 MB no total;
- seleção, drag-and-drop e paste.

## Streaming

O Chat transmite os estágios reais do pipeline (`validate`, `sync`, `context`, `intelligence`, `done`) pelo port dedicado. A resposta final é renderizada progressivamente em Markdown/code blocks.

## Escrita

O modo Chat chama o executor estruturado através do Model Gateway, mas impõe `files=[]`. Se o executor tentar propor qualquer alteração de arquivo, a resposta é recusada com `CHAT_WRITE_INTENT_BLOCKED`.

O modo Build prepara somente o Shadow Build. Não existe Auto Repair nesta Build.

## Próxima Build

**Build 30 — Aprovar/Pular + Auto Repair**: transformar planos/Recovery Reports/Shadow Builds em execução explicitamente autorizada, mantendo Scope Lock, Validation Gate, Guarded Commit e demais proteções.
