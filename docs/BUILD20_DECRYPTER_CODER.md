# Build 20 — Decrypter-Coder

## Objective

Create a provider-compatible QLoRA specialization pipeline for Decrypter Local while preserving the validated Build 18–19 contracts and keeping DecrypterBench as an uncontaminated holdout.

## Base model

Build 20 uses `Qwen/Qwen3-Coder-30B-A3B-Instruct` as the initial allowlisted base model. The model is open-weight under Apache-2.0 and matches the Build 18 reference runtime.

The training path is intentionally replaceable: future open models can be evaluated in a later Build without changing the browser-facing `decrypter-local` provider contract.

## Delivered architecture

1. deterministic 2,400-example synthetic curriculum;
2. fixed 2,160/240 train-validation split;
3. zero-input dataset builder with no repository ingestion mode;
4. DecrypterBench leakage/overlap gate;
5. QLoRA config for the 30B-A3B model;
6. validation-only training entrypoint by default;
7. explicit `--execute-training` requirement for real training;
8. CUDA requirement and output-outside-repository gate;
9. benchmark baseline-vs-candidate promotion gate;
10. CI simulations and artifact packaging without training data or model weights.

## Training contract

The curriculum teaches the real Build output structure used by `ld-command`:

- `summary`
- `plan`
- `files`
- `dependencies`
- `warnings`
- `commit_message`

For updates, `content` remains empty and `edits` contains exact minimal search/replace operations. Outputs are constrained to the approved synthetic file scope.

## Privacy contract

Training is fail-closed:

- `synthetic_only=true` is mandatory;
- `private_customer_code_training=false` is mandatory;
- `decrypterbench_holdout=true` is mandatory;
- no Build 19 benchmark prompt may be copied into the training curriculum;
- high prompt similarity with DecrypterBench fails validation;
- repository/customer ingestion is not implemented;
- weights and adapters may not be written inside the repository.

## Benchmark holdout

DecrypterBench remains the promotion authority, not training material. Baseline and candidate must use the same `suite_hash` and all 400 tasks.

Default promotion policy:

- average score delta >= +1.0;
- no pass-rate regression;
- no security regression;
- no scope regression;
- no increase in failed high/critical-risk tasks;
- no category average regression greater than 1.0 point.

A candidate that fails any gate is not eligible to replace the runtime model.

## Real training

CI never executes QLoRA. Real training requires an explicit operator action on a CUDA GPU host and the `--execute-training` flag. This Build prepares and validates the pipeline but does not claim that model weights were trained when no training GPU has been attached.

## Runtime handoff

A promoted adapter is deployed behind the private Decrypter Local OpenAI-compatible runtime. The extension does not receive model files, private endpoints or runtime tokens.

## Out of scope

- GPU provisioning;
- autoscaling and worker pools;
- mass inference scheduling;
- commercial billing;
- anti-piracy enforcement;
- automatic training on user/customer content;
- official OTA/release publication.
