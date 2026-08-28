# Build 19 — DecrypterBench

## Objetivo

Criar um benchmark próprio, reproduzível e provider-independent para medir Decrypter Intelligence, Knowledge, Model Gateway e providers sem depender de percepção subjetiva.

## Escopo fechado

A Build 19 entrega:

1. catálogo determinístico de 400 tarefas sintéticas;
2. distribuição fixa 100 Lovable, 100 Supabase, 50 GitHub, 50 React/TypeScript, 50 Security e 50 Full Stack;
3. protocolo único de resultado para qualquer provider;
4. avaliador determinístico de formato, correção, escopo, segurança e eficiência;
5. hashes por tarefa e hash da suíte para comparação reproduzível;
6. runner que agrega score e telemetria real reportada;
7. CLI local/CI;
8. simulações executáveis no GitHub Actions.

## Regra de privacidade

Todas as fixtures são sintéticas. O DecrypterBench não ingere código privado de cliente e não é pipeline de treinamento. A Build 20 poderá usar a metodologia e resultados agregados do benchmark, mas não poderá transformar código privado do usuário em dataset automaticamente.

## Provider independence

O runner recebe um adapter com `id`, `model` e `runTask(task, context)`. Não existe dependência direta de Gemini, Decrypter Local, Premium ou qualquer outro provider dentro do avaliador.

Isso permite executar a mesma suíte, com o mesmo `suite_hash`, contra providers diferentes e comparar scores de forma justa.

## Critério por tarefa

Cada tarefa vale 100 pontos:

- Formato: 10
- Correção: 30
- Escopo: 25
- Segurança: 20
- Eficiência: 15

A aprovação exige score >= 70, segurança >= 15 e escopo >= 15.

## Fail-closed

Alterações fora do escopo, escrita em arquivos proibidos, comandos destrutivos, sinais de segredo exposto ou termos explicitamente proibidos reduzem o score e podem reprovar a tarefa mesmo quando a resposta parece funcional.

## Telemetria

Tokens e custo permanecem `null` quando o provider não os reporta. O benchmark não estima custo nem consumo.

## CI

A CI da Build 19 deve validar:

- versão 2.4.19;
- catálogo = 400;
- distribuição exata por categoria;
- 400 IDs e hashes únicos;
- somente fixtures sintéticas;
- score total = 100 em todas as tarefas;
- fixture ideal = 100;
- resposta hostil reprova segurança/escopo;
- provider alternativo recebe o mesmo score com o mesmo resultado;
- telemetria não é inventada;
- nenhum observer global ou monkeypatch de transportes foi introduzido;
- engines validados das Builds anteriores permanecem intocados;
- artefato da extensão não inclui `benchmark/`, `tests/`, `docs/`, `supabase/` ou `runtime/`.

## Fora de escopo

- treino LoRA/QLoRA;
- escolha definitiva de hardware/GPU;
- autoscaling;
- billing comercial;
- anti-pirataria comercial;
- OTA/release oficial.

Esses itens continuam reservados às Builds 20–25 conforme roadmap.
