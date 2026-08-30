#!/usr/bin/env python3
"""Build 60 worker agent for Ollama or vLLM runtimes.

Registers an authenticated OpenAI-compatible endpoint and sends health/metrics
heartbeats. It never reads or stores inference prompts.
"""

import json
import os
import re
import socket
import time
import urllib.error
import urllib.request

CONTROL_URL = os.environ.get("DECRYPTER_CONTROL_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("DECRYPTER_WORKER_SECRET", "")
PUBLIC_ENDPOINT = os.environ.get("DECRYPTER_WORKER_ENDPOINT", "").rstrip("/")
INSTANCE_KEY = os.environ.get("DECRYPTER_WORKER_INSTANCE_KEY") or socket.gethostname()
POOL_CODE = os.environ.get("DECRYPTER_POOL_CODE", "decrypter-local-primary")
ZONE = os.environ.get("DECRYPTER_WORKER_ZONE", "")
RUNTIME_URL = os.environ.get("DECRYPTER_RUNTIME_URL", "http://decrypter-local:8000").rstrip("/")
RUNTIME_TOKEN = os.environ.get("RUNTIME_TOKEN", "")
RUNTIME_KIND = os.environ.get("DECRYPTER_RUNTIME_KIND", "ollama").strip().lower()
RUNTIME_MODEL = os.environ.get("DECRYPTER_RUNTIME_MODEL", "qwen3-coder:30b").strip()
MODEL_LABEL = os.environ.get("DECRYPTER_MODEL_LABEL", "Qwen3-Coder 30B A3B · Ollama").strip()
SERVED_MODEL = os.environ.get("SERVED_MODEL_NAME", "decrypter-local")
MAX_INFLIGHT = max(1, int(os.environ.get("DECRYPTER_WORKER_MAX_INFLIGHT", "1")))
INTERVAL = max(5, int(os.environ.get("DECRYPTER_HEARTBEAT_SECONDS", "15")))
AGENT_VERSION = "2.6.60"

METRIC_NAMES = {
    "vllm:num_requests_running": "running",
    "vllm:num_requests_waiting": "waiting",
    "vllm:kv_cache_usage_perc": "kv_cache_usage",
    "decrypter_requests_inflight": "running",
    "decrypter_requests_total": "requests_total",
    "decrypter_errors_total": "errors_total",
    "decrypter_last_latency_ms": "last_latency_ms",
}


def http(url, method="GET", payload=None, token=None, timeout=8):
    headers = {"user-agent": "decrypter-worker-agent/2.6.60"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    data = None
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode()
        headers["content-type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.read(), dict(res.headers)


def control(action, payload):
    body = {"action": action, "pool_code": POOL_CODE, **payload}
    data = json.dumps(body, separators=(",", ":")).encode()
    req = urllib.request.Request(
        CONTROL_URL,
        data=data,
        headers={
            "content-type": "application/json",
            "x-decrypter-worker-secret": WORKER_SECRET,
            "user-agent": "decrypter-worker-agent/2.6.60",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode() or "{}")


def metric_value(text, name):
    total = 0.0
    found = False
    pattern = re.compile(r"^" + re.escape(name) + r"(?:\{[^}]*\})?\s+([-+0-9.eE]+)\s*$")
    for line in text.splitlines():
        match = pattern.match(line.strip())
        if match:
            try:
                total += float(match.group(1))
                found = True
            except ValueError:
                pass
    return total if found else None


def probe_runtime():
    started = time.monotonic()
    metrics = {"runtime": RUNTIME_KIND, "runtime_model": RUNTIME_MODEL}
    error = None
    healthy = False
    models = []
    try:
        status, _, _ = http(f"{RUNTIME_URL}/health", timeout=6)
        healthy = status == 200
        status, model_bytes, _ = http(f"{RUNTIME_URL}/v1/models", token=RUNTIME_TOKEN, timeout=6)
        if status == 200:
            data = json.loads(model_bytes.decode() or "{}")
            models = [str(item.get("id", "")) for item in data.get("data", [])]
            healthy = healthy and SERVED_MODEL in models
        status, metric_bytes, _ = http(f"{RUNTIME_URL}/metrics", token=RUNTIME_TOKEN, timeout=6)
        if status == 200:
            text = metric_bytes.decode(errors="replace")
            for source, target in METRIC_NAMES.items():
                value = metric_value(text, source)
                if value is not None:
                    metrics[target] = value
        metrics["models"] = models[:10]
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        healthy = False
        error = type(exc).__name__
    metrics["probe_latency_ms"] = round((time.monotonic() - started) * 1000)
    return healthy, metrics, error


def validate_config():
    missing = [
        name
        for name, value in {
            "DECRYPTER_CONTROL_URL": CONTROL_URL,
            "DECRYPTER_WORKER_SECRET": WORKER_SECRET,
            "DECRYPTER_WORKER_ENDPOINT": PUBLIC_ENDPOINT,
            "RUNTIME_TOKEN": RUNTIME_TOKEN,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit("Missing required worker configuration: " + ", ".join(missing))
    if not PUBLIC_ENDPOINT.startswith("https://"):
        raise SystemExit("DECRYPTER_WORKER_ENDPOINT must use https://")
    if RUNTIME_KIND not in {"ollama", "vllm"}:
        raise SystemExit("DECRYPTER_RUNTIME_KIND must be ollama or vllm")


def main():
    validate_config()
    worker_id = None
    delay = 2
    while True:
        healthy, metrics, error = probe_runtime()
        try:
            if not worker_id:
                result = control(
                    "register",
                    {
                        "instance_key": INSTANCE_KEY,
                        "endpoint": PUBLIC_ENDPOINT,
                        "max_inflight": MAX_INFLIGHT,
                        "zone": ZONE or None,
                        "healthy": healthy,
                        "served_model": SERVED_MODEL,
                        "model_label": MODEL_LABEL,
                        "runtime": RUNTIME_KIND,
                        "runtime_model": RUNTIME_MODEL,
                        "agent_version": AGENT_VERSION,
                        "metrics": metrics,
                    },
                )
                if result.get("ok") and result.get("worker", {}).get("id"):
                    worker_id = result["worker"]["id"]
                    delay = 2
                else:
                    raise RuntimeError(str(result.get("code", "REGISTER_FAILED")))
            else:
                result = control(
                    "heartbeat",
                    {
                        "worker_id": worker_id,
                        "healthy": healthy,
                        "error_code": error,
                        "metrics": metrics,
                    },
                )
                if not result.get("ok"):
                    if result.get("code") == "WORKER_NOT_FOUND":
                        worker_id = None
                    raise RuntimeError(str(result.get("code", "HEARTBEAT_FAILED")))
                delay = 2
            time.sleep(INTERVAL)
        except Exception as exc:  # noqa: BLE001 - agent must recover and retry registration
            print(f"worker-agent control error: {type(exc).__name__}", flush=True)
            time.sleep(delay)
            delay = min(60, delay * 2)


if __name__ == "__main__":
    main()
