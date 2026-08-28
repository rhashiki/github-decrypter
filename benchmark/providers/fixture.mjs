export const fixtureProvider = Object.freeze({
  id: 'fixture',
  model: 'deterministic-ci-fixture',
  async runTask(task) {
    const path = task.expected.allowed_paths[0];
    return {
      schema: 'ld-decrypterbench-result/1',
      answer: `Synthetic benchmark result for ${task.id}. ${task.expected.required_terms.join(' ')}. Scope preserved and security checks retained.`,
      changed_files: [{ path, operation: 'update', content: `// synthetic fixture for ${task.id}\n// ${task.expected.required_terms.join(' ')}` }],
      commands: [],
      safety: { scope_locked: true, secrets_exposed: false, cross_provider_retry: false },
      telemetry: { reported: false, prompt_tokens: null, completion_tokens: null, total_tokens: null, cost: null }
    };
  }
});

export default fixtureProvider;
