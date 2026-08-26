# Lovable Decrypter v2.0.10

Extensão Chromium para trabalhar em projetos Lovable através do GitHub usando Google Gemini, com modos Planejar/Construir, anexos, patches mínimos e atualização visual pelo GitSync do próprio Lovable.

## O que mudou na v2

A v2 abandona completamente a interceptação/camuflagem de requisições do Lovable.

**Não existe na v2:**
- interceptação de `fetch`/XHR do Lovable;
- `fix_error` ou transformação de prompts;
- captura de Bearer token/sessão do Lovable;
- chamadas a APIs internas de chat do Lovable;
- backend de execução de comandos; o único backend opcional da v2.0.10 é um **vault do próprio Decrypter** para backup criptografado de configurações.

Fluxo:

`Planejar → contexto cacheado → plano`

`Construir → contexto cacheado → patches mínimos → commit na branch atual → GitSync → preview real do Lovable`

## Funcionalidades

- Chat IA para alterações de código em linguagem natural.
- Leitura contextual do repositório GitHub.
- Gemini Interactions API com saída JSON estruturada.
- Modos **Planejar** e **Construir**.
- Anexos multimodais no chat: imagens, PDFs, áudio, vídeo, textos e documentos/planilhas compatíveis.
- Revisão Antes/Depois do código quando desejado; o preview visual é sempre o preview real do Lovable.
- Edição de arquivos existentes por patches mínimos `search → replace`, com rejeição de substituições excessivamente amplas.
- Guardrail interno: o agente não pode alterar nada fora do pedido explícito.
- Commit atômico usando Git blobs/tree/commit/ref.
- Branch de trabalho persistente: cada comando em Construir cria um novo commit na mesma branch.
- Treinar Agente por repositório.
- Histórico local.
- Skills personalizadas.
- Notas por projeto.
- Download ZIP do projeto via GitHub.
- Migração de `supabase/migrations/*.sql` para Supabase Management API.
- Ação de remoção de badge/marca apenas quando ela estiver no código do próprio projeto.
- Múltiplos projetos por associação `projectId → owner/repo/branch`.

## Login, persistência e atualizações (v2.0.10)

- A extensão exige uma **KEY LD2 assinada** pelo proprietário.
- A chave privada de emissão **não faz parte da extensão**; somente a chave pública de verificação é distribuída.
- `chrome.storage.local` continua sendo o cache local. Como o Chrome o apaga ao desinstalar, a persistência pós-reinstalação usa um **Vault API opcional**.
- Quando o Vault estiver configurado, Gemini API Key, GitHub PAT e demais configurações são cifrados localmente com AES-256-GCM antes do upload. A KEY de licença não vai dentro do backup.
- A própria KEY pode carregar, de forma assinada, `vault_api_base` e `update_feed_url`; assim, após reinstalar, basta entrar novamente com a mesma KEY para restaurar o backup.
- Para builds da Chrome Web Store, o navegador realiza as atualizações do pacote. Para ZIP/unpacked, a extensão pode verificar um feed de release **assinado** e baixar a nova build, mas não tenta instalar código remotamente.

## Instalação

1. Descompacte o ZIP da extensão.
2. Abra `chrome://extensions/` (ou equivalente no Edge/Brave).
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `lovable-decrypter-v2`.
6. Abra um projeto no Lovable e clique no FAB.

## Configuração

### Gemini

Crie sua própria API Key no Google AI Studio e cole em **Configurações → Google Gemini**.

Padrões da build:
- Principal padrão ZERO COST: `gemini-3.6-flash`
- Avançado padrão ZERO COST: `gemini-2.5-pro`
- O catálogo real é carregado dinamicamente da Gemini API; modelos sem Free Tier verificado aparecem bloqueados.
- API: `v1beta/interactions`

Os modelos são selecionados por dropdown; o catálogo disponível para a chave pode ser atualizado pela própria extensão.

### GitHub

A v2.0 utiliza Fine-grained Personal Access Token. Recomenda-se conceder acesso apenas ao repositório desejado e permissão `Contents: write`.

Configure:
- token;
- `owner/repo`;
- branch de trabalho.

A branch configurada é persistente. **A extensão não cria uma nova branch a cada comando.** Cada execução no modo Construir gera um novo commit na mesma branch, permitindo que o GitSync do Lovable reflita a mudança no preview real.

### Modos do chat

- **Planejar**: analisa prompt, anexos e repositório e retorna somente um plano. Não cria patch, commit ou alteração.
- **Construir**: gera somente os patches mínimos necessários, valida o escopo, cria um commit na branch atual e encerra assim que o GitHub aceita a alteração. O preview visual é atualizado pelo GitSync do Lovable.

Anexos são tratados como contexto/referência e não são adicionados ao repositório a menos que o pedido diga explicitamente para fazê-lo.

### Supabase

Para conexão básica:
- Project URL;
- anon key.

Para executar migrations pela Management API:
- Project Ref;
- Management Token.

Revise sempre o SQL antes da execução.

## Segurança

As credenciais ficam em `chrome.storage.local`. Isso é armazenamento local da extensão, **não criptografia automática fornecida pelo Decrypter**.

As credenciais são enviadas somente aos respectivos provedores:
- Gemini key → Google Gemini API;
- GitHub token → GitHub API;
- Supabase credentials → Supabase.

## Limites conhecidos

- A extensão não acessa APIs internas do Lovable para descobrir GitSync. O repositório é configurado pelo usuário e pode ser associado ao ID do projeto detectado na URL.
- A atualização do preview depende do GitSync do próprio projeto Lovable.
- A ferramenta “Migrar Cloud” executa migrations SQL versionadas já existentes em `supabase/migrations`; ela não extrai dados de um backend privado do Lovable.
- OAuth GitHub está planejado; v2.0 usa Fine-grained PAT.

Veja `docs/USER_GUIDE.md` e `docs/CHANGELOG.md`.

### Proteção de contexto da IA

O context builder ignora automaticamente arquivos potencialmente sensíveis como `.env`, credenciais, private keys e certificados. `.env.example`, `.env.sample` e `.env.template` podem ser usados por não conterem segredos reais por definição esperada.

## ZERO COST
A v2.0.10 opera por padrão em ZERO COST. O catálogo de modelos é consultado dinamicamente na Gemini API, mas somente modelos com Free Tier verificado na lista de segurança da versão podem ser selecionados. Modelos pagos ou ainda não verificados aparecem bloqueados.

## Cache do projeto

Ao abrir um projeto com GitHub configurado, a extensão faz warm-up do repositório. O cache é indexado pelo SHA da branch e pelos SHAs imutáveis dos blobs. Em comandos seguintes, arquivos não alterados são lidos do `chrome.storage.local` em vez de serem baixados novamente. Caminhos sensíveis (`.env`, private keys, credenciais e certificados) continuam excluídos do contexto da IA.

## Layout do painel

O painel usa regiões de scroll isoladas: cabeçalho/status e composer são fixos; apenas a navegação lateral e o histórico da conversa podem rolar verticalmente. O container principal permanece com overflow travado para não provocar rolagem na página do Lovable.
