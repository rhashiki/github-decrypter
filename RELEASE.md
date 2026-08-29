# OTA / Releases

O código-fonte da extensão fica neste repositório. A distribuição estável usa GitHub Releases e o feed OTA assinado servido pela Edge Function `ld-release-feed`.

## Release Candidate

A preparação de uma candidata acontece em branch própria e passa pelo workflow de Release Readiness.

**Nenhuma publicação ocorre na preparação do RC.** Durante essa etapa permanecem congelados:

- `.github/RELEASE_TRIGGER`;
- `updates/release.json`;
- `updates/latest.json`;
- GitHub Releases/tags oficiais;
- backend e migrations Supabase.

O ZIP candidato é montado somente com a allowlist de runtime em `release/runtime-package.json`. `tests`, `docs`, `supabase`, `.github`, `scripts`, `release`, `benchmark` e o worker standalone em `runtime/decrypter-local` não entram no pacote da extensão.

`updates/update-manager.js` faz parte do runtime do navegador e entra no ZIP. Já `updates/release.json` e `updates/latest.json` são metadata de publicação/OTA e permanecem fora do pacote.

Arquivos legados que não pertencem ao boot atual podem ser listados em `excluded_paths`. O RC1 exclui explicitamente `content/cloud-runtime.js`, um interceptor legado com monkeypatch global de `fetch`. O preflight garante que nenhum script do manifest nem import relativo do runtime dependa de um caminho excluído.

O preflight `scripts/release-preflight.mjs` valida versão, Trust Protocol, referências do `manifest.json`, fechamento dos imports relativos, ausência de arquivos de credenciais, ausência de metadata OTA no ZIP e ausência de monkeypatch global de rede nos arquivos efetivamente distribuídos.

## Publicação oficial

A publicação oficial só deve ser iniciada após autorização explícita.

1. Confirme que `main` contém exatamente a candidata validada.
2. Confirme CI verde do Release Readiness e da regressão integral.
3. Confira `release/RC31_MANIFEST.json` e o SHA da candidata.
4. Somente então dispare `release.yml` por mecanismo de release explicitamente autorizado (trigger/tag/workflow manual).
5. O workflow executa novamente o preflight e gera `Lovable-Decrypter-vX.Y.Z.zip` usando a mesma allowlist/exclusões de runtime.
6. O workflow calcula SHA-256, cria/atualiza a GitHub Release e publica `updates/release.json` em `main`.
7. A Edge Function Supabase `ld-release-feed` lê o metadata estável, valida versão/URL/SHA-256 e devolve um envelope ECDSA assinado.
8. Para clientes legados, o workflow copia um envelope já assinado pelo `ld-release-feed` para `updates/latest.json`.

A chave privada de assinatura permanece no backend/Supabase e nunca deve ser versionada, enviada ao GitHub Actions ou exposta no content script.

## Estado atual do RC1

- Candidata: `2.4.31`.
- Trust Protocol: `2.4.21`.
- `updates/release.json` e `updates/latest.json` continuam apontando para a release estável anterior até autorização de publicação.
- `.github/RELEASE_TRIGGER` não é alterado durante a preparação.
- O worker `runtime/decrypter-local` é distribuído separadamente e não faz parte do ZIP da extensão Chrome.
- `content/cloud-runtime.js` é legado morto e não faz parte do pacote candidato.

## Limitação do Chrome

- Chrome Web Store: o botão Atualizar pode disparar a verificação oficial; quando o pacote novo é baixado, a extensão limpa apenas caches internos, recarrega a extensão e recarrega a aba Lovable sem cache.
- Instalação `Carregar sem compactação`: o Chrome não permite que a extensão substitua seus próprios arquivos. O botão verifica o feed assinado e baixa o ZIP, mas a troca da pasta/reload ainda é manual.
