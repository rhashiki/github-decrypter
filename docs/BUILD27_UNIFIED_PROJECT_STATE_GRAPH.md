# Build 27 — Unified Project State Graph

Versão: `2.4.27`  
Trust protocol: `2.4.21`

## Objetivo

Transformar Lovable Workspace, GitHub e Supabase em fontes reconciliadas de estado do mesmo projeto, sem executar qualquer reparo automático.

A Build 27 é a base do futuro Project Recovery Doctor.

## Fontes

### Lovable Workspace
- árvore real via Build 26;
- revision/ref;
- arquivos, tamanhos e classificação;
- leitura binária/texto sob demanda;
- paths sensíveis nunca são lidos para comparação.

### GitHub
- reutiliza o GitHub App e o Repo Cache existentes;
- HEAD da branch vinculada;
- árvore completa;
- SHA Git por arquivo;
- nenhuma nova credencial é criada.

### Supabase
A nova Edge Function `ld-project-state` usa a autorização OAuth já existente e retorna apenas metadados:

- projeto/status;
- relações, colunas, RLS, policies, routines e triggers;
- histórico de migrations aplicado;
- Edge Functions implantadas;
- configuração Auth sanitizada;
- estado do Google OAuth sem retornar Client ID/Secret;
- somente **nomes** de secrets.

Valores de secrets nunca entram no navegador ou no grafo.

## Reconciliação

O grafo produz:

- `same`;
- `mismatch`;
- `lovable_only`;
- `github_only`;
- `unknown`.

Quando Lovable e GitHub expõem o mesmo commit SHA, arquivos compartilhados são considerados sincronizados sem releitura.

Quando os revisions divergem, a extensão usa o SHA Git do blob calculado localmente para uma amostra limitada e segura. Há limites de arquivos, bytes e tamanho individual para impedir leitura ilimitada.

## Backend

Também cruza:

- Supabase ref detectado pelo Lovable;
- Supabase ref mapeado no Decrypter;
- Supabase ref realmente inspecionado;
- migrations no workspace × migrations aplicadas;
- `supabase/functions/*` × Edge Functions implantadas.

## Segurança

- read-only sobre o projeto Supabase inspecionado;
- sem migration nova;
- sem executar correção;
- sem retornar secret values;
- `.env`, private keys e paths sensíveis não são lidos para hashing;
- sem monkeypatch global de `fetch`, XHR ou `sendBeacon`;
- sem MutationObserver global;
- cache persistido em `chrome.storage.session` contém apenas resumo/metadata;
- OTA e GitHub Release continuam congelados.

## API de runtime

`window.LovableDecrypterProjectStateGraph`

- `getGraph({ force, deepCompare })`
- `getStored(projectId?)`
- `invalidate()`

Evento:

- `ld2:project-state-graph`

## Fora do escopo

A Build 27 **não corrige** rotas, tabelas, OAuth, Mercado Pago ou migrations. Ela só determina o estado real e as divergências.

Esses reparos pertencem à Build 28 — Project Recovery Doctor.
