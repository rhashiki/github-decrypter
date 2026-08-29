# Build 25 — Release Candidate

## Objetivo

Congelar o escopo do Lovable Decrypter v2.4 e produzir um candidato de release auditável, reproduzível e seguro, sem publicar OTA ou GitHub Release automaticamente.

## Baseline

- Base: Build 24 / commit `f955f30f1d643a1551f6fc60270af60911e4904d`.
- App: `2.4.25`.
- Trust protocol: `2.4.21` (deliberadamente desacoplado da versão do app).
- Migration head auditado: `20260829002720_build24_security_chaos_hardening`.
- Snapshot do backend: `release/RC25_MANIFEST.json`.

## Gates obrigatórios

1. Manifest MV3 válido e boot order preservado.
2. Todos os arquivos JS/MJS do pacote passam em `node --check`.
3. Regressões das Builds 21, 22, 23 e 24 passam integralmente.
4. Trust continua session-only; nenhuma credencial backend aparece no browser surface.
5. Model Gateway continua server-authoritative e sem retry cross-provider depois do início da execução.
6. Commerce continua payment-authoritative; preapproval sozinho não concede acesso.
7. GPU queue não persiste prompt/código do cliente; endpoint privado/link-local continua bloqueado.
8. Nenhum `MutationObserver` global ou monkeypatch de fetch/XHR/sendBeacon é introduzido.
9. `.github/RELEASE_TRIGGER`, `updates/latest.json` e `updates/release.json` não podem mudar nesta Build.
10. O pacote RC exclui `.git`, `.github`, Supabase backend, runtime GPU, docs, testes, benchmark, training e metadata de release interna.
11. O ZIP final recebe SHA-256 e inventário de arquivos determinístico.

## Backend auditado

As funções críticas auditadas estão ACTIVE e registradas com versão + `ezbr_sha256` no RC manifest. Nenhuma Edge Function é redeployada nesta Build; qualquer divergência descoberta bloqueia a promoção em vez de ser mascarada por um redeploy.

## Supabase

Os advisors atuais não possuem finding crítico/alto. Permanecem apenas INFO conhecidos: tabelas backend-only com RLS sem policy cliente e quatro FKs legadas fora do escopo da Build 23 ainda sem índice. Eles são não bloqueantes para a RC e não justificam mudança de schema durante o freeze.

Referências de remediation dos INFO conhecidos:
- RLS sem policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- FKs sem índice: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Publicação

Esta Build gera somente um artefato **Release Candidate**. Ela não altera `.github/RELEASE_TRIGGER`, não cria tag, não cria GitHub Release, não atualiza `updates/latest.json`, não atualiza `updates/release.json` e não publica OTA oficial automaticamente.

A promoção para `main` é apenas o fechamento da Build 25; publicação oficial continua exigindo autorização explícita separada.
