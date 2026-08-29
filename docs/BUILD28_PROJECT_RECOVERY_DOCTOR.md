# Build 28 — Project Recovery Doctor + Asset Dependency Recovery

Versão: `2.4.28`  
Trust protocol: `2.4.21`

## Objetivo

Transformar o Project State Graph da Build 27 em um diagnóstico de recuperação de projeto, sem executar reparos.

O Doctor cruza:

- Workspace Lovable;
- GitHub;
- Supabase real;
- rotas e imports;
- tabelas/RPCs/Edge Functions;
- migrations;
- Auth e Google OAuth;
- Mercado Pago;
- Supabase Storage;
- assets locais e remotos.

## Recovery Report

Schema: `ld-project-recovery-report/1`.

Cada problema recebe:

- categoria;
- severidade;
- causa;
- evidência;
- candidato de recuperação quando disponível;
- etapa sugerida do plano.

Estados principais:

- `healthy`
- `warning`
- `degraded`
- `broken`

## Asset Dependency Recovery

A Build 28 detecta referências de assets em:

- imports;
- `src`;
- `href`;
- `poster`;
- `url(...)`;
- `new URL(..., import.meta.url)`;
- metadados comuns de imagem/logo/favicon.

Classificações:

- presente no Workspace;
- somente no GitHub;
- ausente;
- remoto no Lovable;
- remoto externo;
- Supabase Storage confirmado;
- candidato de recuperação pelo nome do objeto.

O Doctor não baixa assets remotos arbitrários. O download/restore será executado apenas em uma etapa posterior com origem validada e aprovação do usuário.

## Supabase Storage

`ld-project-state` passa a ler somente metadados de `storage.buckets` e `storage.objects`.

Segundo a documentação atual do Supabase, o schema `storage` pode ser consultado para metadados, mas deve ser tratado como read-only; objetos reais continuam no storage provider.

A Build 28:

- não altera `storage`;
- não lê bytes dos objetos;
- não retorna valores de secrets;
- não cria signed URLs;
- não executa upload/download automático.

## Google OAuth

Quando o frontend usa Google, o Doctor confere:

- provider habilitado;
- presença de Client ID;
- presença de Client Secret;
- Site URL;
- redirects explícitos do frontend versus allowlist do Supabase.

Valores de credenciais nunca entram no relatório.

## Mercado Pago

O Doctor detecta a integração por referências no código e verifica:

- Edge Functions invocadas/declaradas;
- nomes de secrets exigidos;
- presença desses nomes no Supabase;
- existência provável de webhook;
- migrations e tabelas relacionadas indiretamente pelo restante do diagnóstico.

Nenhum secret é lido.

## Portabilidade do ZIP

O relatório informa se o projeto pode ser considerado portável com base em:

- imports locais resolvidos;
- assets locais presentes;
- assets ainda presos ao Lovable.

O ZIP da Build 26 continua inalterado nesta Build. O Doctor apenas fornece o diagnóstico de portabilidade que será usado pela etapa posterior de recuperação/exportação.

## Limites de análise

Por execução:

- até 1.400 arquivos de texto;
- até 512 KiB por arquivo;
- até 24 MiB de conteúdo analisado;
- arquivos sensíveis e binários são excluídos.

Contexto incompleto é marcado nos diagnósticos.

## Garantias

- somente leitura do projeto alvo;
- nenhuma migration nova;
- nenhum Auto Repair;
- nenhuma alteração automática de Auth/OAuth;
- nenhum deploy automático no projeto do cliente;
- nenhum fetch/XHR/sendBeacon monkeypatch global;
- nenhum MutationObserver novo;
- valores de secrets nunca entram no browser/report;
- Trust Protocol permanece `2.4.21`.

## Próxima etapa

A Build 29 implementará o Decrypter Chat integrado ao Lovable.

A execução controlada do plano e o Auto Repair permanecem reservados para a Build 30.
