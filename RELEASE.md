# OTA / Releases

O código-fonte da extensão fica neste repositório. A distribuição estável usa GitHub Releases e o feed OTA assinado servido pela Edge Function `ld-release-feed`.

## Release automática

1. Atualize a versão em `manifest.json` e nos pontos de versão do projeto.
2. Valide a candidata com os workflows de CI da versão.
3. Promova a candidata para `main` por fast-forward.
4. Atualize `.github/RELEASE_TRIGGER` (ou dispare manualmente `release.yml`).
5. O workflow `release.yml` gera `Lovable-Decrypter-vX.Y.Z.zip`, calcula SHA-256, cria/atualiza a GitHub Release e publica `updates/release.json` em `main`.
6. A Edge Function Supabase `ld-release-feed` lê o metadata estável, valida versão/URL/SHA-256 e devolve um envelope ECDSA assinado. A extensão só aceita releases verificadas.

A chave privada de assinatura permanece no backend/Supabase e nunca deve ser versionada ou exposta no content script.

## Limitação do Chrome

- Chrome Web Store: o botão Atualizar pode disparar a verificação oficial; quando o pacote novo é baixado, a extensão limpa apenas caches internos, recarrega a extensão e recarrega a aba Lovable sem cache.
- Instalação `Carregar sem compactação`: o Chrome não permite que a extensão substitua seus próprios arquivos. O botão verifica o feed assinado e baixa o ZIP, mas a troca da pasta/reload ainda é manual.
