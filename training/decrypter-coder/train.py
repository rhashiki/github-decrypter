#!/usr/bin/env python3
"""Decrypter-Coder QLoRA entrypoint.

Default mode is validation-only. Real training requires the explicit
--execute-training flag, a CUDA GPU, and a synthetic dataset produced by
prepare-dataset.mjs. Private customer code is not accepted by this pipeline.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

ALLOWED_BASE_MODELS = {"Qwen/Qwen3-Coder-30B-A3B-Instruct"}
EXPECTED_SCHEMA = "ld-decrypter-coder-dataset/1"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def validate_dataset(dataset_dir: Path, config: dict[str, Any]) -> dict[str, Any]:
    manifest_path = dataset_dir / "manifest.json"
    train_path = dataset_dir / "train.jsonl"
    validation_path = dataset_dir / "validation.jsonl"
    for required in (manifest_path, train_path, validation_path):
        if not required.is_file():
            raise RuntimeError(f"DATASET_FILE_MISSING:{required.name}")

    manifest = load_json(manifest_path)
    if manifest.get("schema") != EXPECTED_SCHEMA:
        raise RuntimeError("DATASET_SCHEMA_INVALID")
    if manifest.get("synthetic_only") is not True:
        raise RuntimeError("NON_SYNTHETIC_DATASET_FORBIDDEN")
    if manifest.get("private_customer_code_training") is not False:
        raise RuntimeError("PRIVATE_CUSTOMER_CODE_TRAINING_FORBIDDEN")
    if manifest.get("decrypterbench_holdout") is not True:
        raise RuntimeError("DECRYPTERBENCH_HOLDOUT_REQUIRED")
    if not manifest.get("benchmark_suite_hash"):
        raise RuntimeError("BENCHMARK_SUITE_HASH_REQUIRED")

    expected = config.get("dataset", {})
    if int(manifest.get("total_examples", -1)) != int(expected.get("total_examples", -2)):
        raise RuntimeError("DATASET_TOTAL_MISMATCH")
    if int(manifest.get("train_examples", -1)) != int(expected.get("train_examples", -2)):
        raise RuntimeError("DATASET_TRAIN_MISMATCH")
    if int(manifest.get("validation_examples", -1)) != int(expected.get("validation_examples", -2)):
        raise RuntimeError("DATASET_VALIDATION_MISMATCH")

    hashes: list[str] = []
    split_counts = {"train": 0, "validation": 0}
    for split, file_path in (("train", train_path), ("validation", validation_path)):
        with file_path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get("synthetic") is not True or row.get("private_customer_code") is not False:
                    raise RuntimeError(f"PRIVACY_CONTRACT_FAILED:{split}:{line_number}")
                if row.get("benchmark_holdout") is not True:
                    raise RuntimeError(f"BENCHMARK_HOLDOUT_FAILED:{split}:{line_number}")
                if row.get("split") != split:
                    raise RuntimeError(f"SPLIT_MISMATCH:{split}:{line_number}")
                messages = row.get("messages")
                if not isinstance(messages, list) or [m.get("role") for m in messages] != ["system", "user", "assistant"]:
                    raise RuntimeError(f"CHAT_FORMAT_INVALID:{split}:{line_number}")
                if not row.get("example_hash"):
                    raise RuntimeError(f"EXAMPLE_HASH_MISSING:{split}:{line_number}")
                hashes.append(str(row["example_hash"]))
                split_counts[split] += 1

    if split_counts["train"] != int(manifest["train_examples"]):
        raise RuntimeError("TRAIN_LINE_COUNT_MISMATCH")
    if split_counts["validation"] != int(manifest["validation_examples"]):
        raise RuntimeError("VALIDATION_LINE_COUNT_MISMATCH")

    calculated_hash = hashlib.sha256(compact_json(sorted(hashes)).encode("utf-8")).hexdigest()
    if calculated_hash != manifest.get("dataset_hash"):
        raise RuntimeError("DATASET_HASH_MISMATCH")
    return manifest


def validate_config(config: dict[str, Any]) -> None:
    if config.get("schema") != "ld-decrypter-coder-config/1":
        raise RuntimeError("TRAINING_CONFIG_SCHEMA_INVALID")
    if config.get("base_model") not in ALLOWED_BASE_MODELS:
        raise RuntimeError("BASE_MODEL_NOT_ALLOWLISTED")
    if config.get("base_license") != "Apache-2.0":
        raise RuntimeError("BASE_MODEL_LICENSE_NOT_APPROVED")
    if config.get("method") != "qlora":
        raise RuntimeError("BUILD20_REQUIRES_QLORA")
    if config.get("dataset", {}).get("private_customer_code_training") is not False:
        raise RuntimeError("PRIVATE_CUSTOMER_CODE_TRAINING_FORBIDDEN")
    if config.get("dataset", {}).get("decrypterbench_holdout") is not True:
        raise RuntimeError("DECRYPTERBENCH_HOLDOUT_REQUIRED")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="training/decrypter-coder/config/decrypter-coder-30b-qlora.json")
    parser.add_argument("--dataset-dir", required=True)
    parser.add_argument("--output-dir", default="/tmp/decrypter-coder-output")
    parser.add_argument("--execute-training", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    dataset_dir = Path(args.dataset_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    config = load_json(config_path)
    validate_config(config)
    manifest = validate_dataset(dataset_dir, config)

    repo_root = Path.cwd().resolve()
    if output_dir == repo_root or repo_root in output_dir.parents:
        raise RuntimeError("MODEL_OUTPUT_INSIDE_REPOSITORY_FORBIDDEN")

    plan = {
        "ok": True,
        "mode": "execute" if args.execute_training else "dry-run",
        "base_model": config["base_model"],
        "method": config["method"],
        "dataset_hash": manifest["dataset_hash"],
        "benchmark_suite_hash": manifest["benchmark_suite_hash"],
        "train_examples": manifest["train_examples"],
        "validation_examples": manifest["validation_examples"],
        "output_dir": str(output_dir),
        "private_customer_code_training": False,
        "automatic_training": False,
    }
    if not args.execute_training:
        print(json.dumps(plan, indent=2))
        return 0

    try:
        import torch
        from datasets import load_dataset
        from peft import LoraConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import SFTConfig, SFTTrainer
    except ImportError as exc:
        raise RuntimeError("TRAINING_DEPENDENCIES_MISSING") from exc

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA_GPU_REQUIRED")

    quant = config["quantization"]
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=bool(quant["load_in_4bit"]),
        bnb_4bit_quant_type=str(quant["bnb_4bit_quant_type"]),
        bnb_4bit_use_double_quant=bool(quant["bnb_4bit_use_double_quant"]),
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    tokenizer = AutoTokenizer.from_pretrained(config["base_model"], trust_remote_code=False)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        config["base_model"],
        trust_remote_code=False,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        quantization_config=quantization_config,
    )
    model.config.use_cache = False

    lora = config["lora"]
    peft_config = LoraConfig(
        r=int(lora["r"]),
        lora_alpha=int(lora["lora_alpha"]),
        lora_dropout=float(lora["lora_dropout"]),
        bias=str(lora["bias"]),
        target_modules=str(lora["target_modules"]),
        task_type=str(lora["task_type"]),
    )

    train_dataset = load_dataset("json", data_files=str(dataset_dir / "train.jsonl"), split="train")
    eval_dataset = load_dataset("json", data_files=str(dataset_dir / "validation.jsonl"), split="train")

    def formatting_func(example: dict[str, Any]) -> str:
        return tokenizer.apply_chat_template(example["messages"], tokenize=False, add_generation_prompt=False)

    t = config["training"]
    output_dir.mkdir(parents=True, exist_ok=True)
    sft_config = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=float(t["num_train_epochs"]),
        learning_rate=float(t["learning_rate"]),
        warmup_ratio=float(t["warmup_ratio"]),
        lr_scheduler_type=str(t["lr_scheduler_type"]),
        per_device_train_batch_size=int(t["per_device_train_batch_size"]),
        per_device_eval_batch_size=int(t["per_device_eval_batch_size"]),
        gradient_accumulation_steps=int(t["gradient_accumulation_steps"]),
        gradient_checkpointing=bool(t["gradient_checkpointing"]),
        logging_steps=int(t["logging_steps"]),
        eval_strategy="steps",
        eval_steps=int(t["eval_steps"]),
        save_steps=int(t["save_steps"]),
        save_total_limit=int(t["save_total_limit"]),
        optim=str(config["optimizer"]),
        bf16=True,
        max_length=int(t["max_seq_length"]),
        seed=int(t["seed"]),
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
        formatting_func=formatting_func,
    )
    trainer.train()
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    (output_dir / "decrypter-training-manifest.json").write_text(
        json.dumps({**plan, "mode": "completed"}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({**plan, "mode": "completed"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
