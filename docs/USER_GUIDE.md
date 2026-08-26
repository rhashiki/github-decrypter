# Guia do Usuário — Lovable Decrypter v2.0

## 1. Primeira configuração

Abra o projeto Lovable, clique no FAB e abra **Configurações**.

Preencha:
1. Gemini API Key.
2. GitHub Fine-grained PAT.
3. Repositório `owner/repo`.
4. Branch base.
5. Opcionalmente, dados do Supabase.

Se o projeto Lovable foi detectado na URL, deixe marcada a opção de associar o repositório ao projeto atual.

## 2. Modos Planejar e Construir

No composer, escolha:

- **Planejar**: analisa o pedido e o projeto e devolve apenas um plano. Não altera arquivos e não cria commit.
- **Construir**: gera patches mínimos, valida o escopo e cria um commit diretamente na branch de trabalho configurada.

## 3. Anexos

Use **📎 Anexar** para enviar contexto como imagens, PDFs, áudios, vídeos, textos, CSVs e documentos/planilhas comuns.

Os anexos são referência para o agente. Eles não são adicionados ao repositório automaticamente.

## 4. Preview e GitHub

A extensão não tenta reconstruir visualmente o projeto. O preview correto é o **preview real do Lovable**.

No modo Construir:
1. a extensão usa o cache do repositório;
2. localiza os arquivos relevantes;
3. Gemini gera patches mínimos;
4. a extensão valida e commita na mesma branch;
5. o GitSync do Lovable reflete o commit no preview.

O botão **VER ALTERAÇÕES** mostra somente o código Antes/Depois do commit para auditoria.

A branch é persistente: cada comando gera um novo commit nela, sem criar branch ou Pull Request por solicitação.

## 5. Treinar Agente

A ferramenta analisa arquivos importantes do repositório e salva localmente:
- resumo do projeto;
- arquitetura;
- regras;
- caminhos importantes;
- checklist de validação.

Esse perfil é incluído nos prompts futuros para o mesmo repositório.

## 6. Aplicar Migrations no Supabase

A ferramenta procura `supabase/migrations/*.sql` no GitHub, consolida em ordem alfabética e mostra o SQL antes da execução. Este executor não é o migrador completo Lovable Cloud → Supabase.

A execução exige `Project Ref` e `Management Token` do seu Supabase.

## 7. ZIP

A ferramenta **ZIP** baixa o branch configurado diretamente pelo endpoint de archive do GitHub.

## 8. Skills

Salve comandos recorrentes, por exemplo:
- revisar responsividade;
- corrigir TypeScript;
- revisar políticas RLS;
- atualizar documentação.

A Skill entra no mesmo fluxo normal: IA → preview → confirmação → GitHub.

## 9. Atalhos

- `Enter`: enviar comando.
- `Shift+Enter`: nova linha.
- `Esc`: fechar modal/painel.
- `Ctrl+/`: abrir/fechar painel.

## 10. Segurança

Nunca cole credenciais em prompts. Configure-as somente nos campos de Configurações da extensão.
