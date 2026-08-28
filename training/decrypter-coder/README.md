# Decrypter-Coder — Build 20

Build 20 prepares a reproducible QLoRA specialization pipeline for the self-hosted Decrypter Local provider.

## Base model

- `Qwen/Qwen3-Coder-30B-A3B-Instruct`
- Apache-2.0
- Runtime contract remains `provider=decrypter-local` / served model `decrypter-local`.

The base model choice matches Build 18 so the fine-tuned adapter can replace the underlying checkpoint without changing the browser contract.

## Safety and privacy boundary

This pipeline is synthetic-only by construction:

- no automatic ingestion of repositories;
- no private customer code;
- no conversation scraping;
- no extension telemetry as training material;
- no DecrypterBench tasks in the training set;
- no model weights committed to the repository.

`prepare-dataset.mjs` has no external input mode. It deterministically generates the Build 20 curriculum and writes a signed manifest. `train.py` refuses datasets whose manifest does not explicitly declare `synthetic_only=true`, `private_customer_code_training=false`, and `decrypterbench_holdout=true`.

## Dataset

The curriculum contains 2,400 synthetic chat examples:

- 600 Lovable
- 600 Supabase
- 300 GitHub
- 300 React/TypeScript
- 300 Security
- 300 Full Stack

Split:

- 2,160 train
- 240 validation

Every example teaches the actual Build execution contract: minimal exact patch, approved scope only, no secret exposure, and backend authority where applicable.

Generate the dataset outside the repository:

```bash
node training/decrypter-coder/prepare-dataset.mjs --out=/tmp/decrypter-coder-dataset
```

## Validation-only mode

The training entrypoint defaults to dry-run. It validates the config, dataset manifest, hashes, split counts and privacy contract without loading a model or requiring ML dependencies:

```bash
python3 training/decrypter-coder/train.py \
  --dataset-dir=/tmp/decrypter-coder-dataset \
  --output-dir=/tmp/decrypter-coder-output
```

## Real QLoRA execution

Real training is never started automatically. On a GPU training host:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r training/decrypter-coder/requirements.txt
python3 training/decrypter-coder/train.py \
  --dataset-dir=/secure/path/decrypter-coder-dataset \
  --output-dir=/secure/path/decrypter-coder-adapter \
  --execute-training
```

The output directory must be outside the repository. The entrypoint fails closed when CUDA is unavailable.

## Evaluation and promotion

The 400-task DecrypterBench remains an untouched holdout. Run the exact same `suite_hash` against the base provider and the candidate adapter, then compare reports:

```bash
node training/decrypter-coder/compare-reports.mjs \
  --baseline=/secure/reports/base.json \
  --candidate=/secure/reports/candidate.json
```

A candidate is not promoted unless it improves the average score by the configured minimum and does not regress pass rate, security, scope, high-risk failures or category scores beyond the allowed threshold.

## Runtime handoff

After a candidate passes DecrypterBench, deploy the adapter on the private GPU runtime behind the existing OpenAI-compatible vLLM boundary. The browser still sees only `decrypter-local`; endpoint, runtime token, model path and adapter files remain backend/private.

Build 20 does not provision GPUs, autoscaling or production worker pools; those remain Build 23 scope.
