# Build 21 — Trust / Anti-Piracy / IP Protection

## Objetivo

Endurecer a autoridade comercial e técnica do Lovable Decrypter sem depender de segredos no navegador e sem alegar DRM inviolável.

## Cadeia de confiança

`LD2 license → device binding → signed trust attestation → Model Gateway → HMAC internal executor`

1. A licença LD2 continua assinada por ECDSA P-256 e validada no backend.
2. O dispositivo continua vinculado por hash e pode ser revogado.
3. `ld-trust-attest` emite uma sessão `LDT1` assinada por 10 minutos.
4. A sessão é vinculada a licença, hash do dispositivo, versão do cliente e fingerprint dos componentes críticos.
5. Nonces são persistidos por hash e não podem ser reutilizados.
6. O Model Gateway exige a sessão válida em `status` e `execute`.
7. `ld-command` rejeita execução direta e aceita somente a assinatura HMAC interna do Gateway.

## Integridade do cliente

A extensão calcula SHA-256 de componentes críticos empacotados e envia somente a fingerprint agregada na atestação. Em uma extensão executada no computador do usuário, esse fingerprint é um **sinal de risco**, não uma prova criptográfica absoluta de que o cliente não foi modificado. A autorização real permanece no servidor.

Nenhuma chave privada, `service_role`, segredo de assinatura ou token do runtime Local é enviado ao navegador.

## Sessão

- schema: `ld-trust-attestation/1`
- token: `LDT1.<payload>.<ECDSA signature>`
- TTL: 600 segundos
- cache: `chrome.storage.session` ou memória; nunca `chrome.storage.local`
- bearer nunca aparece no Activity Center, histórico ou status público
- sessão expirada/revogada/mal vinculada falha fechada

## Banco

- `ld_trust_sessions`: sessões curtas, nonce hash, binding e revogação.
- `ld_trust_events`: auditoria mínima de emissão/negação, sem licença bruta, device id bruto ou bearer.
- RLS habilitado e acesso de `anon`/`authenticated` revogado; Edge Functions usam somente `service_role` server-side.

## Compatibilidade

Preservados:

- Composer Guardian;
- Decrypter Intelligence / Knowledge;
- Model Gateway auto/fast/deep;
- Decrypter Local health gate e ausência de cross-provider retry;
- reserva/conclusão de créditos;
- `validateBuild` e patches mínimos;
- Activity Center e Update/Recovery;
- boot/FAB sem observer global.

`ld-owner-key-bootstrap-temp` já estava neutralizado com `410 BOOTSTRAP_DISABLED` e continua sem capacidade de bootstrap.

## Fora de escopo

- billing/assinaturas comerciais completas: Build 22;
- GPU pools/autoscaling: Build 23;
- chaos/security massivo: Build 24;
- release oficial/OTA: somente com autorização explícita.
