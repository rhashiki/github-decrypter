update public.ld_inference_pools
set model_label='Qwen3-Coder 30B A3B · Ollama',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'build',60,
      'primary_runtime','ollama',
      'compatible_runtimes',jsonb_build_array('ollama','vllm'),
      'ollama_model','qwen3-coder:30b',
      'runtime_contract','openai-compatible/v1',
      'payload_persistence',false,
      'zero_cost_api',true
    ),
    updated_at=now()
where code='decrypter-local-primary';
