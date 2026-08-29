# Build 24 — Security & Chaos

## Objetivo

Submeter as fronteiras críticas do Lovable Decrypter a ataques e falhas sintéticas, corrigindo vulnerabilidades reais sem executar caos destrutivo contra clientes, projetos, pagamentos ou GPUs de produção.

## Correções encontradas pela auditoria

### 1. Drift de versão do Trust

O app já estava em `2.4.23`, mas `ld-trust-attest` e `ld-model-gateway` continuam, corretamente, no contrato de Trust criado na Build 21 (`2.4.21`). O cliente usava `VERSION` também como `client_version`, fazendo uma nova Build invalidar o próprio protocolo.

A Build 24 separa:

- `VERSION = 2.4.24` — versão real do produto;
- `TRUST_PROTOCOL_VERSION = 2.4.21` — versão compatível do protocolo LDT1.

A sessão continua vinculada a licença, dispositivo, fingerprint, expiração e protocolo; o bearer continua apenas em `chrome.storage.session`.

### 2. Persistência de webhook inválido

O webhook Mercado Pago validava HMAC, mas tentava registrar o payload mesmo quando `signature_valid=false`. A Build 24 adiciona defesa no banco: um trigger `BEFORE INSERT/UPDATE` descarta linhas sem assinatura válida e limita payload persistido a 512 KiB.

O fluxo de entitlement permanece payment-authoritative: somente pagamento aprovado amplia acesso.

### 3. SSRF por endpoint de worker

Workers já precisavam usar HTTPS no control plane. A Build 24 adiciona uma segunda barreira no banco, rejeitando endpoints com credenciais embutidas, localhost, IPv4 privados/link-local, IPv6 loopback/ULA/link-local e sufixos `.local`, `.internal`, `.localhost` e `.lan`.

Também limita telemetria de worker a 64 KiB e metadata a 32 KiB.

## Chaos suite

`tests/build24-security-chaos.mjs` é totalmente sintético e determinístico. Ele cobre:

- trust drift e replay/expiração/binding;
- bypass direto do executor;
- output inválido e patches inseguros;
- SSRF em workers;
- saturação/rate limit e idempotência de lease;
- worker timeout/failure com fail-closed;
- ausência de retry cross-provider depois que execução começa;
- webhook inválido e autoridade de pagamento;
- fila GPU sem prompt/source payload;
- ausência de monkeypatch global/MutationObserver novo;
- ausência de secrets backend no cliente.

Nenhuma chamada de caos é executada contra pagamentos, licenças reais, projetos de clientes ou GPUs reais.

## Supabase

A migration da Build 24 é backend-only e mantém `SECURITY INVOKER`. As tabelas críticas continuam protegidas por RLS/revogações já existentes.

Referências atuais usadas na auditoria: limites de Edge Functions, rate limiting de chamadas aninhadas, segurança de dados/RLS e recomendação de `SECURITY INVOKER` da documentação Supabase.

## Release

Esta Build produz apenas candidato validado. **Não publica OTA/release oficial automaticamente.**
