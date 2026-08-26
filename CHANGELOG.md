# Changelog

## 2.2.0 — 2026-08-26

### Engenharia e execução
- Project Intelligence, Impact Maps, Project Rules, Explain Project e Skill Router.
- Scope Lock, Shadow Build, Regression Sentinel e Validation Gate no pipeline autoritativo.
- Checkpoints persistentes com rollback automático e manual seguro, sem force reset.
- Batch Mode sequencial, isolado por projeto, com pausa em falha e reentrada no pipeline completo.
- Sugestões Automáticas determinísticas e somente consultivas, sem Build/Plan autônomo e sem consumo automático de Gemini.

### UX
- Novo Control Center v2.2.0.
- Preview do Lovable com blur durante Build/Aprovação/Batch.
- Barra de progresso vinculada aos eventos reais de execução e conclusão visual do preview; 100% somente após sinal observável do Lovable.

### Segurança e hardening
- Credenciais sensíveis mantidas fora do DOM compartilhado com o Lovable.
- GitHub PAT e operações sensíveis restritos ao background.
- OTA exige feed ECDSA assinado e token efêmero vinculado à release validada.
- Destinos Supabase/Vault restritos a HTTPS em `*.supabase.co`.
- Compatibilidade Chrome MV3 e fallback Firefox/WebExtension sem scripts em MAIN world.
- Política Gemini zero-cost preservada: sem fallback pago automático; cota gratuita esgotada interrompe a operação.
- Validações de secrets/.env e regressões dedicadas em CI.

### Distribuição
- Release estável empacotada pelo GitHub Actions com ZIP + SHA-256.
- Metadata publicada em `updates/release.json` e servida por `ld-release-feed` com assinatura ECDSA.
