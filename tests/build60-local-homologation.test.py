#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "runtime" / "decrypter-local" / "homologate.py"
spec = importlib.util.spec_from_file_location("decrypter_homologate", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class FakeClient:
    def __init__(self):
        self.calls = []

    def request(self, url, *, method="GET", headers=None, payload=None):
        self.calls.append((url, method, headers or {}, payload))
        if url.endswith("/health"):
            return 200, json.dumps({
                "ok": True,
                "runtime": "ollama",
                "model": "qwen3-coder:30b",
                "served_model": "decrypter-local",
                "latency_ms": 12,
            }).encode(), {}
        if url.endswith("/v1/models"):
            return 200, json.dumps({
                "object": "list",
                "data": [{"id": "decrypter-local", "object": "model"}],
            }).encode(), {}
        if url.endswith("/metrics"):
            return 200, (
                "decrypter_requests_total 1\n"
                "decrypter_requests_inflight 0\n"
                "decrypter_errors_total 0\n"
                "decrypter_last_latency_ms 15\n"
            ).encode(), {"content-type": "text/plain"}
        if url.endswith("/v1/chat/completions"):
            return 200, json.dumps({
                "model": "decrypter-local",
                "choices": [{"message": {"role": "assistant", "content": "ready"}}],
                "decrypter_runtime": {
                    "provider": "ollama",
                    "runtime_model": "qwen3-coder:30b",
                    "zero_cost_api": True,
                },
            }).encode(), {}
        if url.endswith("/functions/v1/ld-local-control"):
            return 200, json.dumps({
                "ok": True,
                "runtime_contract": {"served_model": "decrypter-local"},
                "workers": [{
                    "instance_key": "gpu-worker-01",
                    "status": "ready",
                    "metadata": {
                        "runtime": "ollama",
                        "runtime_model": "qwen3-coder:30b",
                        "served_model": "decrypter-local",
                    },
                }],
            }).encode(), {}
        raise AssertionError(f"unexpected URL: {url}")


class HomologationProbeTests(unittest.TestCase):
    def config(self, **overrides):
        values = dict(
            endpoint="https://gpu-worker-01.example.com",
            runtime_token="runtime-secret",
            control_url="https://project.supabase.co/functions/v1/ld-local-control",
            worker_secret="worker-secret",
            instance_key="gpu-worker-01",
            timeout_seconds=30,
        )
        values.update(overrides)
        return module.Config(**values)

    def test_full_homologation_contract(self):
        client = FakeClient()
        report = module.run(self.config(), client=client)
        self.assertTrue(report["ok"])
        self.assertEqual(report["served_model"], "decrypter-local")
        self.assertTrue(report["checks"]["health"]["ok"])
        self.assertTrue(report["checks"]["inference"]["completion_received"])
        self.assertTrue(report["checks"]["control_plane"]["worker_ready"])
        inference_calls = [call for call in client.calls if call[0].endswith("/v1/chat/completions")]
        self.assertEqual(len(inference_calls), 1)
        _, method, headers, payload = inference_calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(headers["authorization"], "Bearer runtime-secret")
        self.assertEqual(payload["model"], "decrypter-local")

    def test_control_plane_can_be_explicitly_skipped_when_credentials_absent(self):
        client = FakeClient()
        report = module.run(
            self.config(control_url="", worker_secret=""),
            client=client,
        )
        self.assertTrue(report["ok"])
        self.assertTrue(report["checks"]["control_plane"]["skipped"])

    def test_inference_requires_zero_cost_attestation(self):
        class MissingAttestationClient(FakeClient):
            def request(self, url, *, method="GET", headers=None, payload=None):
                if url.endswith("/v1/chat/completions"):
                    return 200, json.dumps({
                        "model": "decrypter-local",
                        "choices": [{"message": {"content": "ready"}}],
                    }).encode(), {}
                return super().request(url, method=method, headers=headers, payload=payload)

        with self.assertRaisesRegex(module.HomologationError, "RUNTIME_ZERO_COST_ATTESTATION_MISSING"):
            module.run(self.config(), client=MissingAttestationClient())


if __name__ == "__main__":
    unittest.main()
