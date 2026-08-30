import importlib.util
import os
import pathlib
import unittest

os.environ['RUNTIME_TOKEN'] = 'unit-test-secret'
path = pathlib.Path('runtime/decrypter-local/ollama-gateway.py')
spec = importlib.util.spec_from_file_location('decrypter_ollama_gateway', path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class OllamaGatewayContractTest(unittest.TestCase):
    def test_bearer_auth_is_constant_time_contract(self):
        self.assertTrue(mod.authorised('Bearer unit-test-secret', 'unit-test-secret'))
        self.assertFalse(mod.authorised('Bearer wrong', 'unit-test-secret'))
        self.assertFalse(mod.authorised('', 'unit-test-secret'))

    def test_model_probe_accepts_configured_qwen(self):
        payload = {'models': [{'name': 'qwen3-coder:30b', 'model': 'qwen3-coder:30b'}]}
        self.assertTrue(mod.model_loaded(payload, 'qwen3-coder:30b'))
        self.assertFalse(mod.model_loaded(payload, 'another-model'))

    def test_openai_payload_rewrites_only_runtime_model(self):
        schema = {'type': 'object', 'properties': {'summary': {'type': 'string'}}, 'required': ['summary']}
        response_format = {'type': 'json_schema', 'json_schema': {'name': 'decrypter_plan', 'strict': True, 'schema': schema}}
        payload = {
            'model': 'decrypter-local',
            'messages': [{'role': 'user', 'content': 'plan'}],
            'temperature': 0.1,
            'max_tokens': 99999,
            'stream': False,
            'response_format': response_format,
        }
        rewritten = mod.rewrite_chat_payload(payload, 'qwen3-coder:30b', 'decrypter-local')
        self.assertEqual(rewritten['model'], 'qwen3-coder:30b')
        self.assertEqual(rewritten['max_tokens'], 32768)
        self.assertFalse(rewritten['stream'])
        self.assertEqual(rewritten['response_format'], response_format)
        self.assertEqual(payload['model'], 'decrypter-local', 'input payload must not be mutated')

    def test_fail_closed_on_wrong_model_or_streaming(self):
        with self.assertRaisesRegex(ValueError, 'MODEL_NOT_SERVED'):
            mod.rewrite_chat_payload({'model': 'unknown', 'messages': [{'role': 'user', 'content': 'x'}]}, 'qwen3-coder:30b', 'decrypter-local')
        with self.assertRaisesRegex(ValueError, 'STREAMING_NOT_SUPPORTED'):
            mod.rewrite_chat_payload({'model': 'decrypter-local', 'messages': [{'role': 'user', 'content': 'x'}], 'stream': True}, 'qwen3-coder:30b', 'decrypter-local')


if __name__ == '__main__':
    unittest.main()
