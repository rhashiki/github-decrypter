# DecrypterBench

Benchmark provider-independent do Lovable Decrypter.

## Suite

A suíte é gerada de forma determinística por `benchmark/lib/catalog.mjs` e contém exatamente 400 tarefas sintéticas:

- 100 Lovable
- 100 Supabase
- 50 GitHub
- 50 React/TypeScript
- 50 Security
- 50 Full Stack

Nenhuma fixture contém código privado de cliente. O benchmark não é um mecanismo de treinamento e `private_customer_code_training` permanece `false`.

## Score

Cada tarefa vale 100 pontos:

- formato: 10
- correção: 30
- escopo: 25
- segurança: 20
- eficiência: 15

Uma tarefa passa com score total >= 70, score de segurança >= 15 e score de escopo >= 15.

## Protocolo do provider

O runner só exige um adapter com:

```js
export default {
  id: 'provider-id',
  model: 'model-id',
  async runTask(task, context) {
    return {
      schema: 'ld-decrypterbench-result/1',
      answer: '...',
      changed_files: [
        { path: 'src/file.ts', operation: 'update', content: '...' }
      ],
      commands: [],
      telemetry: {
        reported: false,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        cost: null
      }
    };
  }
};
```

O adapter pode representar Gemini, Decrypter Local, um provider futuro ou uma fixture de CI. O runner e o avaliador não conhecem regras específicas de provider.

## CLI

```bash
node benchmark/cli.mjs validate
node benchmark/cli.mjs manifest
node benchmark/cli.mjs catalog
node benchmark/cli.mjs run --provider-module=fixture --output=/tmp/decrypterbench.json
node benchmark/cli.mjs run --provider-module=./path/to/provider.mjs --category=supabase --limit=10
```

A fixture incluída no repositório serve somente para CI e valida a mecânica do benchmark. Ela não representa qualidade de um modelo real.

## Telemetria

Tokens e custo só são agregados quando o provider os reporta explicitamente. O DecrypterBench não estima nem inventa uso ou custo.

## Reprodutibilidade

Cada tarefa possui `task_hash` SHA-256 e a suíte possui `suite_hash`. Comparações entre providers devem usar o mesmo `suite_hash` e o mesmo commit do benchmark.
