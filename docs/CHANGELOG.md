## 2.1.1 — Baseline & Cleanup
- Corrige a versão exposta pelo content script usando `chrome.runtime.getManifest().version`.
- Renomeia o antigo “Migrar Cloud → Supabase” para “Aplicar Migrations no Supabase”, refletindo a funcionalidade real.
- Corrige o empacotamento de release para manter `updates/update-manager.js` dentro do ZIP e excluir somente `updates/latest.json`.
- Atualiza documentação da arquitetura backend da linha 2.1.

## 2.1.0 — Commerce & Credits
- Planos por tempo: 7, 15, 30, 60, 90 e 365 dias.
- Créditos sem validade; 1 crédito a cada 4 comandos.
- Plano por tempo ativo pausa o consumo de créditos.
- Checkout Mercado Pago (Pix/cartão), webhook assinado, refund/chargeback e emissão automática de KEY.
- Área de licença e botões de renovar/comprar créditos.
- Gemini gratuito por padrão ou billing opcional da própria API do usuário.

## v2.0.10
- Botão Atualizar no launcher.
- Atualização automática quando gerenciada pelo Chrome Web Store.
- Em modo unpacked, baixa o ZIP assinado e informa a etapa manual exigida pelo Chrome.
- Limpa apenas caches internos, preservando KEY e configurações, e recarrega a aba Lovable sem cache após update aplicado.
- Feed OTA padrão preparado para `rhashiki/lovable-decrypter-extension`.

## v2.0.9 — 2026-08-25
- Login obrigatório por KEY LD2 assinada em ECDSA P-256.
- Verificação de licença no background, não apenas na UI.
- Owner Toolkit separado com chave privada e gerador de licenças.
- Vault remoto opcional com criptografia local AES-256-GCM para restaurar Gemini/GitHub/configurações após reinstalação.
- A KEY pode carregar os endpoints assinados do Vault e do feed de atualização.
- Verificação periódica de atualização assinada; builds unpacked baixam o ZIP e builds publicadas usam o mecanismo oficial da Chrome Web Store.
- Nenhum JavaScript remoto é carregado/executado.

## v2.0.8 — 2026-08-25
- UI/UX do chat inspirada no WhatsApp: balões, composer em cápsula, clipe e botão circular de enviar.
- Toggle Planejar/Construir integrado ao composer.
- Planos agora oferecem Revisar Plano, Aprovar, Rejeitar e Pular.
- Aprovar executa o plano explicitamente aprovado sem trocar a branch de trabalho.
- Rejeitar permite voltar ao chat ou solicitar outro plano com feedback.
- Pular descarta o plano sem aplicar alterações.

## v2.0.7 — 2026-08-25

- Modos **Planejar** e **Construir** no composer.
- Planejar não escreve código nem toca no GitHub; retorna somente plano, arquivos previstos e avisos.
- Construir aplica automaticamente alterações na branch de trabalho atual e deixa o preview visual a cargo do GitSync real do Lovable.
- Removido o preview visual gerado por Gemini da UI; revisão local passa a ser somente código Antes/Depois.
- Branch persistente: não cria branch/PR por comando.
- Botão de anexos com suporte a imagens, PDFs, áudio, vídeo, texto, CSV e documentos/planilhas comuns.
- Guardrails absolutos de escopo: nada fora do pedido explícito pode ser alterado.
- Updates passam a ser patches mínimos `search → replace`; reescritas excessivamente amplas são recusadas.
- Cache do repositório continua por SHA e a atualização pós-commit ocorre em background para não atrasar o retorno do modo Construir.

## v2.0.6 — 2026-08-25

- Header e status permanecem fixos no topo do painel.
- Composer permanece fixo no rodapé do chat.
- Somente a coluna lateral possui rolagem própria.
- Somente o histórico da conversa possui rolagem própria.
- O painel principal e a página do Lovable não recebem rolagem causada pela extensão.
- Textarea não redimensiona mais o layout; quando necessário, rola internamente.
- Scrollbar estável e overscroll isolado nas duas regiões roláveis.

## v2.0.5 — 2026-08-25
- Chat IA ganhou etapas de processamento em tempo real: prompt, cache, análise, edição, revisão e conclusão.
- Cronômetro por comando mostra o tempo total de processamento.
- Mensagem “Preview disponível” agora possui botão persistente **VER PREVIEW**.
- Corrigido retorno do Preview Center: fechar/ESC volta à última mensagem e ao campo de comando sem fechar o painel inteiro.
- Cache incremental do repositório por SHA: arquivos de texto não sensíveis são reutilizados localmente entre comandos.
- Warm-up automático do cache ao abrir projeto com GitHub configurado.
- Context builder passa a preferir blobs locais e só consulta GitHub quando necessário.
- Preparação para runtime visual real; o renderer visual estático da v2.0.4 continua sendo tratado como aproximação, não como preview pixel-perfect.

## v2.0.4 — 2026-08-25
- Novo Preview Center responsivo em viewport cheia.
- Alternância Visual/Código.
- Alternância Componente/Página.
- Comparação Antes/Depois/Lado a lado.
- Preview visual estático sob demanda, sem commit e com cache por plano.
- Código Antes/Depois com fonte maior e painéis independentes.
- Modal não depende de rolagem da página Lovable.

## v2.0.3 — 2026-08-25
- Catálogo dinâmico de modelos via Gemini `models.list`.
- Dropdowns exibem todos os modelos de texto/código retornados pela chave.
- ZERO COST obrigatório por padrão: modelos sem Free Tier verificado aparecem bloqueados.
- Trava de segurança no core impede chamada a modelo não verificado antes da requisição.
- Migração automática de configurações antigas que apontavam para modelos pagos/não verificados.
- Teste Gemini mantém feedback visual de progresso.

## v2.0.1 (2026-08-25)
- UX: modelos Gemini agora são selecionados por dropdown.
- UX: Testar Gemini exibe spinner, barra de progresso e estado final de sucesso/erro.

# Changelog

## 2.0.0 — 2026-08-25

### Arquitetura
- Removida toda interceptação de chat/requisições do Lovable.
- Removidos `fix_error`, captura de sessão Lovable e dependência de endpoints internos.
- GitHub passa a ser a fonte de verdade para leitura e escrita do código.
- Google Gemini passa a gerar alterações com saída estruturada.

### GitHub
- Context builder baseado na árvore Git.
- Preview por arquivo antes de qualquer escrita.
- Commit atômico com blobs → tree → commit → ref.
- Branch e Pull Request por padrão.
- Download de ZIP.
- Associação de repositório por projeto Lovable.

### IA
- Gemini Interactions API.
- Modelo principal configurável.
- Modelo avançado configurável.
- Treinamento de agente por repositório.
- Regras globais do agente.
- Skills reutilizáveis.

### Ferramentas preservadas
- Migrar Cloud → Supabase a partir de migrations versionadas.
- Treinar Agente.
- Baixar ZIP.
- Notas.
- Skills.
- Remoção de marca via alteração revisável no GitHub.
- Diagnóstico.

### Segurança
- Nenhuma chave hardcoded.
- Nenhum servidor próprio.
- Nenhum token Lovable capturado.
- Nenhum log de segredo.
