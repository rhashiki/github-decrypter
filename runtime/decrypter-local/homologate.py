#!/usr/bin/env python3
"""End-to-end homologation probe for the Build 60 local model runtime.

The probe verifies the public authenticated worker endpoint and, when control
plane credentials are present, confirms that the worker is registered and
ready. It prints only a compact report; prompts, completions and secrets are
never echoed.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

SERVED_MODEL = "decrypter-local"
DEFAULT_TIMEOUT = 240


class HomologationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    endpoint: str
    runtime_token: str
    control_url: str = ""
    worker_secret: str = ""
    instance_key: str = ""
    timeout_seconds: int = DEFAULT_TIMEOUT

    @classmethod
    def from_env(cls) -> "Config":
        endpoint = (
            os.environ.get("DECRYPTER_HOMOLOGATION_ENDPOINT")
            or os.environ.get("DECRYPTER_WORKER_ENDPOINT")
            or ""
        ).rstrip("/")
        runtime_token = os.environ.get("RUNTIME_TOKEN", "").strip()
        control_url = os.environ.get("DECRYPTER_CONTROL_URL", "").rstrip("/")
        worker_secret = os.environ.get("DECRYPTER_WORKER_SECRET", "").strip()
        instance_key = (
            os.environ.get("DECRYPTER_WORKER_INSTANCE_KEY") or socket.gethostname()
        ).strip()
        timeout_raw = os.environ.get("DECRYPTER_HOMOLOGATION_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT))
        try:
            timeout_seconds = max(30, min(600, int(timeout_raw)))
        except ValueError as exc:
            raise HomologationError("DECRYPTER_HOMOLOGATION_TIMEOUT_SECONDS must be an integer") from exc
        if not endpoint:
            raise HomologationError(
                "DECRYPTER_HOMOLOGATION_ENDPOINT or DECRYPTER_WORKER_ENDPOINT is required"
            )
        if not runtime_token:
            raise HomologationError("RUNTIME_TOKEN is required")
        if bool(control_url) != bool(worker_secret):
            raise HomologationError(
                "DECRYPTER_CONTROL_URL and DECRYPTER_WORKER_SECRET must be configured together"
            )
        return cls(
            endpoint=endpoint,
            runtime_token=runtime_token,
            control_url=control_url,
            worker_secret=worker_secret,
            instance_key=instance_key,
            timeout_seconds=timeout_seconds,
        )


class HttpClient:
    def __init__(self, timeout_seconds: int):
        self.timeout_seconds = timeout_seconds

    def request(
        self,
        url: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> tuple[int, bytes, dict[str, str]]:
        body = None
        request_headers = {
            "user-agent": "decrypter-local-homologation/2.6.60",
            **(headers or {}),
        }
        if payload is not None:
            body = json.dumps(payload, separators=(",", ":")).encode()
            request_headers["content-type"] = "application/json"
        req = urllib.request.Request(url, data=body, headers=request_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as res:
                return res.status, res.read(), dict(res.headers)
        except urllib.error.HTTPError as exc:
            response_body = exc.read()
            raise HomologationError(f"HTTP_{exc.code} from {url}: {safe_error(response_body)}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise HomologationError(f"REQUEST_FAILED for {url}: {type(exc).__name__}") from exc


def safe_error(raw: bytes) -> str:
    """Return only an error code/type, never an inference body."""
    try:
        payload = json.loads(raw.decode() or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "UNPARSEABLE_RESPONSE"
    if isinstance(payload, dict):
        if isinstance(payload.get("error"), dict):
            err = payload["error"]
            return str(err.get("type") or err.get("code") or "REMOTE_ERROR")[:120]
        return str(payload.get("code") or "REMOTE_ERROR")[:120]
    return "REMOTE_ERROR"


def decode_json(raw: bytes, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw.decode() or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HomologationError(f"{label}_INVALID_JSON") from exc
    if not isinstance(payload, dict):
        raise HomologationError(f"{label}_INVALID_SHAPE")
    return payload


def bearer(token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {token}"}


def check_health(client: HttpClient, config: Config) -> dict[str, Any]:
    status, raw, _ = client.request(f"{config.endpoint}/health")
    payload = decode_json(raw, "HEALTH")
    if status != 200 or payload.get("ok") is not True:
        raise HomologationError("RUNTIME_HEALTH_FAILED")
    if str(payload.get("served_model")) != SERVED_MODEL:
        raise HomologationError("RUNTIME_SERVED_MODEL_MISMATCH")
    return {
        "ok": True,
        "runtime": str(payload.get("runtime") or "unknown"),
        "served_model": str(payload.get("served_model") or ""),
        "latency_ms": payload.get("latency_ms"),
    }


def check_models(client: HttpClient, config: Config) -> dict[str, Any]:
    status, raw, _ = client.request(
        f"{config.endpoint}/v1/models", headers=bearer(config.runtime_token)
    )
    payload = decode_json(raw, "MODELS")
    models = payload.get("data") if isinstance(payload.get("data"), list) else []
    ids = [str(item.get("id", "")) for item in models if isinstance(item, dict)]
    if status != 200 or SERVED_MODEL not in ids:
        raise HomologationError("RUNTIME_MODEL_CONTRACT_FAILED")
    return {"ok": True, "served_model_present": True, "model_count": len(ids)}


def check_metrics(client: HttpClient, config: Config) -> dict[str, Any]:
    status, raw, _ = client.request(
        f"{config.endpoint}/metrics", headers=bearer(config.runtime_token)
    )
    text = raw.decode(errors="replace")
    required = (
        "decrypter_requests_total",
        "decrypter_requests_inflight",
        "decrypter_errors_total",
        "decrypter_last_latency_ms",
    )
    if status != 200 or any(name not in text for name in required):
        raise HomologationError("RUNTIME_METRICS_CONTRACT_FAILED")
    return {"ok": True, "required_metrics_present": True}


def check_inference(client: HttpClient, config: Config) -> dict[str, Any]:
    payload = {
        "model": SERVED_MODEL,
        "messages": [
            {
                "role": "user",
                "content": "Return a short plain-text acknowledgement that the local runtime is ready.",
            }
        ],
        "temperature": 0,
        "max_tokens": 256,
        "stream": False,
    }
    started = time.monotonic()
    status, raw, _ = client.request(
        f"{config.endpoint}/v1/chat/completions",
        method="POST",
        headers=bearer(config.runtime_token),
        payload=payload,
    )
    response = decode_json(raw, "INFERENCE")
    choices = response.get("choices") if isinstance(response.get("choices"), list) else []
    content = ""
    if choices and isinstance(choices[0], dict):
        message = choices[0].get("message")
        if isinstance(message, dict):
            content = str(message.get("content") or "").strip()
    runtime_meta = response.get("decrypter_runtime")
    if status != 200 or not content:
        raise HomologationError("RUNTIME_INFERENCE_FAILED")
    if str(response.get("model")) != SERVED_MODEL:
        raise HomologationError("RUNTIME_INFERENCE_MODEL_MISMATCH")
    if not isinstance(runtime_meta, dict) or runtime_meta.get("zero_cost_api") is not True:
        raise HomologationError("RUNTIME_ZERO_COST_ATTESTATION_MISSING")
    return {
        "ok": True,
        "completion_received": True,
        "completion_chars": len(content),
        "provider": str(runtime_meta.get("provider") or "unknown"),
        "runtime_model": str(runtime_meta.get("runtime_model") or ""),
        "latency_ms": round((time.monotonic() - started) * 1000),
    }


def check_control_plane(client: HttpClient, config: Config) -> dict[str, Any]:
    if not config.control_url:
        return {"ok": True, "skipped": True, "reason": "control_credentials_not_configured"}
    status, raw, _ = client.request(
        config.control_url,
        method="POST",
        headers={"x-decrypter-worker-secret": config.worker_secret},
        payload={"action": "status", "pool_code": "decrypter-local-primary"},
    )
    payload = decode_json(raw, "CONTROL")
    if status != 200 or payload.get("ok") is not True:
        raise HomologationError("CONTROL_STATUS_FAILED")
    contract = payload.get("runtime_contract") if isinstance(payload.get("runtime_contract"), dict) else {}
    if str(contract.get("served_model")) != SERVED_MODEL:
        raise HomologationError("CONTROL_SERVED_MODEL_MISMATCH")
    workers = payload.get("workers") if isinstance(payload.get("workers"), list) else []
    matching = [
        worker
        for worker in workers
        if isinstance(worker, dict)
        and str(worker.get("instance_key") or "") == config.instance_key
    ]
    if not matching:
        raise HomologationError("CONTROL_WORKER_NOT_REGISTERED")
    worker = matching[0]
    if str(worker.get("status") or "") != "ready":
        raise HomologationError("CONTROL_WORKER_NOT_READY")
    metadata = worker.get("metadata") if isinstance(worker.get("metadata"), dict) else {}
    if str(metadata.get("served_model") or "") != SERVED_MODEL:
        raise HomologationError("CONTROL_WORKER_MODEL_MISMATCH")
    return {
        "ok": True,
        "skipped": False,
        "instance_key": config.instance_key,
        "worker_ready": True,
        "runtime": str(metadata.get("runtime") or "unknown"),
        "runtime_model": str(metadata.get("runtime_model") or ""),
    }


def run(config: Config, client: HttpClient | None = None) -> dict[str, Any]:
    transport = client or HttpClient(config.timeout_seconds)
    started = time.monotonic()
    report = {
        "schema": "decrypter-local-homologation/1",
        "served_model": SERVED_MODEL,
        "endpoint_scheme": config.endpoint.split(":", 1)[0].lower(),
        "checks": {},
    }
    report["checks"]["health"] = check_health(transport, config)
    report["checks"]["models"] = check_models(transport, config)
    report["checks"]["metrics_before"] = check_metrics(transport, config)
    report["checks"]["inference"] = check_inference(transport, config)
    report["checks"]["metrics_after"] = check_metrics(transport, config)
    report["checks"]["control_plane"] = check_control_plane(transport, config)
    report["ok"] = True
    report["elapsed_ms"] = round((time.monotonic() - started) * 1000)
    return report


def main() -> int:
    try:
        report = run(Config.from_env())
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except HomologationError as exc:
        print(
            json.dumps(
                {
                    "schema": "decrypter-local-homologation/1",
                    "ok": False,
                    "code": str(exc)[:180],
                },
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
