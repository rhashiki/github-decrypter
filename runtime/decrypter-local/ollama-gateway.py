#!/usr/bin/env python3
"""Build 68 authenticated Ollama bridge for the Decrypter local agent runtime.

Exposes a minimal OpenAI-compatible API, supports a strict local model allowlist,
and never persists prompts or responses. Uses Python's standard library only.
"""

import hmac
import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3-coder:30b").strip()
OLLAMA_MODELS = tuple(dict.fromkeys(
    model.strip() for model in os.environ.get(
        "OLLAMA_MODELS",
        "qwen3-coder:30b,qwen2.5-coder:14b,qwen2.5-coder:7b",
    ).split(",") if model.strip()
))
SERVED_MODEL = os.environ.get("SERVED_MODEL_NAME", "decrypter-local")
RUNTIME_TOKEN = os.environ.get("RUNTIME_TOKEN", "")
PORT = max(1, min(65535, int(os.environ.get("PORT", "8000"))))
MAX_BODY_BYTES = max(1024, min(32_000_000, int(os.environ.get("MAX_BODY_BYTES", "8000000"))))
UPSTREAM_TIMEOUT = max(30, min(300, int(os.environ.get("OLLAMA_TIMEOUT_SECONDS", "210"))))

_metrics_lock = threading.Lock()
_metrics = {"requests": 0, "inflight": 0, "errors": 0, "last_latency_ms": 0}


def authorised(header_value, token=RUNTIME_TOKEN):
    expected = f"Bearer {token}" if token else ""
    return bool(expected and header_value and hmac.compare_digest(str(header_value), expected))


def loaded_model_names(payload):
    models = payload.get("models", []) if isinstance(payload, dict) else []
    names = []
    for item in models if isinstance(models, list) else []:
        if isinstance(item, dict):
            names.extend([str(item.get("name", "")), str(item.get("model", ""))])
    return {name for name in names if name}


def model_loaded_names(payload):
    names = loaded_model_names(payload)
    out = []
    for model in OLLAMA_MODELS:
        if model in names or any(name.split("@", 1)[0] == model for name in names):
            out.append(model)
    return out


def resolve_requested_model(requested):
    value = str(requested or "").strip()
    if value == SERVED_MODEL:
        return OLLAMA_MODEL
    if value in OLLAMA_MODELS:
        return value
    raise ValueError("MODEL_NOT_SERVED")


def rewrite_chat_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("INVALID_JSON_BODY")
    selected_model = resolve_requested_model(payload.get("model", ""))
    if payload.get("stream") is True:
        raise ValueError("STREAMING_NOT_SUPPORTED")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages or len(messages) > 128:
        raise ValueError("MESSAGES_INVALID")
    out = dict(payload)
    out["model"] = selected_model
    out["stream"] = False
    out["temperature"] = max(0.0, min(1.0, float(payload.get("temperature", 0.1))))
    if "max_tokens" in payload:
        out["max_tokens"] = max(256, min(32768, int(payload.get("max_tokens") or 16384)))
    response_format = payload.get("response_format")
    if response_format is not None and not isinstance(response_format, dict):
        raise ValueError("RESPONSE_FORMAT_INVALID")
    return out, selected_model


def http_json(url, method="GET", payload=None, timeout=8):
    headers = {"content-type": "application/json", "user-agent": "decrypter-ollama-gateway/2.6.68"}
    data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        return res.status, json.loads(raw.decode() or "{}")


def probe():
    started = time.monotonic()
    try:
        status, payload = http_json(f"{OLLAMA_URL}/api/tags", timeout=6)
        loaded = model_loaded_names(payload) if status == 200 else []
        healthy = status == 200 and bool(loaded)
        return healthy, loaded, round((time.monotonic() - started) * 1000), None if healthy else "OLLAMA_MODEL_NOT_LOADED"
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return False, [], round((time.monotonic() - started) * 1000), type(exc).__name__


def metric_snapshot():
    with _metrics_lock:
        return dict(_metrics)


def metric_add(name, delta=1):
    with _metrics_lock:
        _metrics[name] = _metrics.get(name, 0) + delta


def metric_set(name, value):
    with _metrics_lock:
        _metrics[name] = value


class Handler(BaseHTTPRequestHandler):
    server_version = "DecrypterOllamaGateway/2.6.68"

    def log_message(self, fmt, *args):
        return

    def send_json(self, status, body):
        raw = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def denied(self):
        self.send_json(401, {"error": {"message": "unauthorized", "type": "authentication_error"}})

    def require_auth(self):
        if authorised(self.headers.get("authorization", "")):
            return True
        self.denied()
        return False

    def do_GET(self):
        if self.path == "/health":
            healthy, loaded, latency, error = probe()
            self.send_json(200 if healthy else 503, {
                "ok": healthy,
                "runtime": "ollama",
                "model": OLLAMA_MODEL,
                "models_configured": list(OLLAMA_MODELS),
                "models_loaded": loaded,
                "served_model": SERVED_MODEL,
                "latency_ms": latency,
                "error": error,
            })
            return
        if self.path == "/metrics":
            if not self.require_auth():
                return
            snap = metric_snapshot()
            lines = [
                f"decrypter_requests_total {int(snap['requests'])}",
                f"decrypter_requests_inflight {int(snap['inflight'])}",
                f"decrypter_errors_total {int(snap['errors'])}",
                f"decrypter_last_latency_ms {int(snap['last_latency_ms'])}",
            ]
            raw = ("\n".join(lines) + "\n").encode()
            self.send_response(200)
            self.send_header("content-type", "text/plain; version=0.0.4")
            self.send_header("content-length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if self.path == "/v1/models":
            if not self.require_auth():
                return
            healthy, loaded, latency, error = probe()
            if not healthy:
                self.send_json(503, {"error": {"message": error or "ollama unavailable", "type": "runtime_unavailable"}})
                return
            data = [{"id": SERVED_MODEL, "object": "model", "owned_by": "lovable-decrypter", "runtime_model": OLLAMA_MODEL}]
            data.extend({"id": model, "object": "model", "owned_by": "ollama", "runtime_model": model} for model in loaded)
            self.send_json(200, {"object": "list", "data": data, "latency_ms": latency, "local_only": True})
            return
        self.send_json(404, {"error": {"message": "not found", "type": "not_found"}})

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            self.send_json(404, {"error": {"message": "not found", "type": "not_found"}})
            return
        if not self.require_auth():
            return
        length = int(self.headers.get("content-length", "0") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_json(413, {"error": {"message": "request body too large or empty", "type": "invalid_request_error"}})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode())
            upstream, selected_model = rewrite_chat_payload(payload)
            healthy, loaded, _, _ = probe()
            if not healthy or selected_model not in loaded:
                raise ValueError("MODEL_NOT_LOADED")
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": {"message": str(exc), "type": "invalid_request_error"}})
            return
        metric_add("requests")
        metric_add("inflight")
        started = time.monotonic()
        try:
            status, body = http_json(f"{OLLAMA_URL}/v1/chat/completions", method="POST", payload=upstream, timeout=UPSTREAM_TIMEOUT)
            if isinstance(body, dict):
                body["model"] = selected_model
                body["decrypter_runtime"] = {"provider": "ollama", "runtime_model": selected_model, "zero_cost_api": True, "local_only": True}
            self.send_json(status, body)
            if status >= 400:
                metric_add("errors")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            metric_add("errors")
            self.send_json(502, {"error": {"message": type(exc).__name__, "type": "upstream_error"}})
        finally:
            metric_add("inflight", -1)
            metric_set("last_latency_ms", round((time.monotonic() - started) * 1000))


def main():
    if not RUNTIME_TOKEN:
        raise SystemExit("RUNTIME_TOKEN is required")
    if OLLAMA_MODEL not in OLLAMA_MODELS:
        raise SystemExit("OLLAMA_MODEL must be present in OLLAMA_MODELS")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(json.dumps({
        "event": "ready",
        "runtime": "ollama",
        "served_model": SERVED_MODEL,
        "runtime_model": OLLAMA_MODEL,
        "allowed_models": list(OLLAMA_MODELS),
        "port": PORT,
    }), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
