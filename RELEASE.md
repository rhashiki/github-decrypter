# OTA / Releases

O código-fonte da extensão fica neste repositório. O feed assinado fica em `updates/latest.json`.

## Release automática

1. Crie no GitHub Actions Secret `LD_OWNER_SIGNING_KEY_PEM` com a chave privada ECDSA do Owner Toolkit.
2. Faça commit das alterações e atualize a versão em `manifest.json`, `settings/config.js` e `ui/ui.js`. O content script lê a versão diretamente do manifest.
3. Crie/push uma tag no formato `vX.Y.Z`.
4. O workflow `release.yml` gera o ZIP, calcula SHA-256, cria GitHub Release e atualiza `updates/latest.json` com assinatura ECDSA.

Nunca faça commit de `license-private-key.pem`.

## Limitação do Chrome

- Chrome Web Store: o botão Atualizar pode disparar a verificação oficial; quando o pacote novo é baixado, a extensão limpa apenas caches internos, recarrega a extensão e recarrega a aba Lovable sem cache.
- Instalação `Carregar sem compactação`: o Chrome não permite que a extensão substitua seus próprios arquivos. O botão verifica o feed assinado e baixa o ZIP, mas a troca da pasta/reload ainda é manual.
