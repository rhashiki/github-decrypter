# Third-Party Provenance

This document is the human-readable companion to `third-party-sources.json`.

GitHub Decrypter intentionally reuses compatible open-source work where appropriate. Reuse must remain attributable, auditable and replaceable.

## Initial upstream candidates

### Hugging Face Transformers
- Repository: `huggingface/transformers`
- Repository license observed: Apache-2.0
- Intended use: optional local-runtime dependency and model/tokenizer/config compatibility layer.
- Do not vendor the full repository into the Studio.

### n8n
- Repository: `n8n-io/n8n`
- License observed: Sustainable Use License plus separately licensed Enterprise files/directories.
- Intended use: architecture/reference only unless a specific independently licensed component is verified compatible.
- No wholesale copy/rename.

### Continue
- Repository: `continuedev/continue`
- License observed: Apache-2.0.
- Intended use: selectively adapt context-provider, MCP, tool/protocol, model-provider and IDE/core separation patterns.
- File-level provenance is mandatory for any actual copied source.

### CrewAI
- Repository: `crewAIInc/crewAI`
- License observed: MIT.
- Intended use: agent/flow orchestration concepts and selectively reusable implementation where it does not create a Python runtime authority inside Decrypter.

### Monaco Editor
- Repository: `microsoft/monaco-editor`
- License observed: MIT.
- Intended use: direct dependency for desktop/web code editor and diff surfaces.

### assistant-ui
- Repository: `assistant-ui/assistant-ui`
- License observed: MIT.
- Intended use: direct React primitives and/or adapted runtime bindings for GitHub Decrypter Chat. Assistant Cloud is not an authority for project/job state.

### Adorable
- Repository: `freestyle-sh/Adorable`
- License observed: MIT.
- Intended use: selectively adapt workspace, preview, terminal, conversation and publish/rollback UX patterns while replacing Freestyle VM authority with the Decrypter local runtime/provider architecture.

### December
- Repository: `ntegrals/december`
- License observed: MIT.
- Intended use: mine local container/preview/editor/file-management patterns; do not make Docker a mandatory V1 authority.

### v0.diy
- Repository: `SujalXplores/v0.diy`
- Repository license observed: MIT.
- Intended use: selectively adapt project/chat/preview UX and separately audit bundled `.agents/skills` licenses before reuse.
- v0 API dependence, rate limits and hosted-provider assumptions are not adopted.

## Provenance workflow

Before copied/adapted code is merged, add an entry to `third-party-sources.json` with the exact upstream commit and source path. If the exact upstream commit has not yet been pinned, the entry remains `candidate` and no source code should be represented as already incorporated.
