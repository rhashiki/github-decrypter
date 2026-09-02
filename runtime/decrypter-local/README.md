# GitHub Decrypter Local Runtime — inherited source asset

This directory contains the local-inference implementation inherited from the predecessor project and preserved by Build 3/4 because its Ollama, vLLM, worker, health-check and homologation ideas belong in GitHub Decrypter V1.

It is **not** yet the final GitHub Decrypter daemon. Build 6+ moves reusable pieces into the monorepo/local-runtime architecture; Build 34 later completes the Local AI Runtime.

## Preserved capabilities

- Ollama gateway logic;
- vLLM compose path;
- worker-agent pattern;
- health and metrics probes;
- authenticated OpenAI-compatible `/v1/models` and `/v1/chat/completions` surface;
- structured-output validation concepts;
- local model homologation.

## Compatibility identifiers

The stable served-model id `decrypter-local` and some inherited control-plane environment/endpoint names remain temporarily inside these source files so the preserved implementation stays internally coherent until its physical migration. They are technical compatibility identifiers, not the product name or a hosted-product authority.

No inherited hosted control plane is authoritative for GitHub Decrypter. The final runtime must use the local daemon, durable jobs, provider contracts and security boundaries defined by `docs/product/`.

## Default model

- compatibility served-model id: `decrypter-local`;
- current Ollama reference model: `qwen3-coder:30b`;
- reference display label: `Qwen3-Coder 30B A3B · Ollama`.

## Running the preserved worker for development

1. Copy `.env.example` to a private development host and set strong local/server-only secrets.
2. Route the configured worker endpoint to local port 8000 through an authenticated boundary.
3. Start `docker compose up -d` for the Ollama profile.
4. For vLLM, use `docker compose -f compose.vllm.yaml up -d`.
5. Run the homologation probe only against infrastructure you explicitly configured.

```bash
python runtime/decrypter-local/homologate.py
```

No cloud GPU is provisioned by this repository automatically.

## Security invariants

- model weights, worker secrets and private runtime credentials do not belong in the browser UI;
- public network exposure is not required for the final local-first architecture;
- prompts/responses must not be persisted by inference adapters unless an explicit product feature and policy authorizes it;
- local AI providers remain replaceable;
- no provider switch occurs silently after an execution starts;
- this preserved directory cannot become the durable job authority merely because it contains runnable worker code.
