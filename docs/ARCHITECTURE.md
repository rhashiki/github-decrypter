# Arquitetura v2.0

```text
Lovable Page
   │
   └── content/content.js
          │ detecta apenas projectId/URL
          ▼
      ui/ui.js
          │
          ▼
background/service-worker.js
   ├── github/git-adapter.js
   │      └── GitHub REST/Git Data API
   ├── core/context-builder.js
   ├── ai/gemini-agent.js
   │      └── Gemini Interactions API
   └── tools/supabase-tools.js
          └── Supabase API
```

## Isolamento

O content script não intercepta rede e não captura sessão do Lovable. Seu papel é somente montar a UI e identificar o projeto atual pela URL.

## Escrita Git

```text
branch ref persistente
  ↓
base commit/tree
  ↓
patches mínimos validados
  ↓
novos blobs somente dos arquivos alterados
  ↓
new tree
  ↓
new commit
  ↓
update da MESMA branch
  ↓
GitSync do Lovable → preview real
```

Cada comando em **Construir** gera um commit atômico coerente na mesma branch. **Planejar** nunca executa esta etapa.


## Modos

### Planejar

`prompt + anexos → cache/contexto → Gemini → plano`

Sem escrita no GitHub.

### Construir

`prompt + anexos → cache/contexto → Gemini → patches mínimos → validação → commit na branch atual → GitSync Lovable`

O Decrypter não usa APIs internas nem intercepta o chat do Lovable para atualizar o preview.
