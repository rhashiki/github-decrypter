# Build 26 — Lovable Workspace Deep Read

Status: implementação read-only pós-RC.

## Objetivo

Dar ao Lovable Decrypter visibilidade direta do estado de arquivos que o Lovable expõe para o projeto aberto, sem depender exclusivamente do GitHub e sem interceptar globalmente `fetch`, XHR ou `sendBeacon`.

## Entregas

- `content/lovable-workspace-deep-read.js`
  - lê a sessão Firebase já existente no domínio Lovable sem persistir o bearer;
  - enumera o workspace por `GET /projects/{id}/git/files`;
  - lê texto e binários sob demanda por `GET /projects/{id}/git/file`;
  - gera `WorkspaceSnapshot` `ld-workspace-snapshot/1`;
  - classifica frontend, backend, Supabase, migrations, Edge Functions e configurações;
  - marca paths sensíveis e não inclui seus valores no snapshot;
  - expõe somente operações de leitura (`writeFiles:false`);
  - mantém cache curto apenas em memória;
  - invalida cache quando o projeto/rota muda.

## ZIP do projeto

O botão **Exportar ZIP** existente passa a usar:

1. **Lovable Workspace** como fonte principal;
2. leitura integral de bytes, inclusive arquivos binários;
3. montagem local de ZIP válido, sem enviar token ou arquivos a proxy próprio;
4. falha fechada: um erro de leitura não produz ZIP parcial;
5. **GitHub fallback** explícito quando o workspace estiver indisponível/incompleto ou exceder o limite seguro local.

O fallback reaproveita `LD2_GITHUB_ZIP_BYTES`; nenhum fluxo OTA/Release foi conectado ao recurso.

## Segurança

- nenhuma atribuição a `window.fetch`/`globalThis.fetch`;
- nenhum patch em `XMLHttpRequest.prototype`;
- nenhum patch em `navigator.sendBeacon`;
- nenhum `MutationObserver` global;
- bearer Lovable é lido sob demanda e não entra no `WorkspaceSnapshot`;
- conteúdo sensível fica redigido no `readFile()` por padrão;
- conteúdo sensível só pode ser lido em bytes para o ZIP local solicitado pelo usuário e não é persistido;
- limite local do ZIP: 60.000 arquivos / 512 MiB de conteúdo-fonte. Acima disso, usa GitHub fallback.

## Fora de escopo

- escrita por API Lovable;
- Decrypter Chat;
- Plan → Aprovar/Pular;
- Context Graph Lovable × GitHub × Supabase;
- qualquer mudança de schema/Edge Function Supabase.

Trust protocol preservado: `2.4.21`.

Esta Build não publica OTA nem GitHub Release automaticamente.
