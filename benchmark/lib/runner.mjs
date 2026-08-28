import { benchmarkManifest, buildTaskCatalog, validateCatalog } from './catalog.mjs';
import { REPORT_SCHEMA, evaluateTask, summarizeEvaluations } from './evaluator.mjs';

function nowIso() { return new Date().toISOString(); }

function reportedNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function sanitizeTelemetry(telemetry) {
  if (!telemetry || typeof telemetry !== 'object') return { reported: false, prompt_tokens: null, completion_tokens: null, total_tokens: null, cost: null };
  return {
    reported: telemetry.reported === true,
    prompt_tokens: reportedNumber(telemetry.prompt_tokens),
    completion_tokens: reportedNumber(telemetry.completion_tokens),
    total_tokens: reportedNumber(telemetry.total_tokens),
    cost: reportedNumber(telemetry.cost)
  };
}

function validateSelection(tasks) {
  const canonical = buildTaskCatalog();
  const validation = validateCatalog(canonical);
  if (!validation.ok) throw new Error(`Invalid benchmark catalog:\n${validation.errors.join('\n')}`);
  const byId = new Map(canonical.map(task => [task.id, task]));
  const seen = new Set();
  for (const task of tasks) {
    const official = byId.get(task?.id);
    if (!official) throw new Error(`Unknown benchmark task: ${task?.id || '<missing-id>'}`);
    if (seen.has(task.id)) throw new Error(`Duplicate selected task: ${task.id}`);
    if (official.task_hash !== task.task_hash) throw new Error(`Task hash mismatch: ${task.id}`);
    seen.add(task.id);
  }
  return validation;
}

export async function runBenchmark({ provider, tasks = buildTaskCatalog(), metadata = {}, onTask } = {}) {
  if (!provider || typeof provider.runTask !== 'function') throw new Error('Provider adapter must expose runTask(task, context)');
  if (!Array.isArray(tasks) || tasks.length < 1) throw new Error('At least one benchmark task is required');
  validateSelection(tasks);
  const manifest = benchmarkManifest();
  const startedAt = nowIso();
  const evaluations = [];
  const results = [];
  let reportedPrompt = 0;
  let reportedCompletion = 0;
  let reportedTotal = 0;
  let anyUsage = false;
  let reportedCost = 0;
  let anyCost = false;

  for (const task of tasks) {
    let result;
    let error = null;
    const taskStartedAt = nowIso();
    try {
      result = await provider.runTask(task, { benchmark: manifest, metadata });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      result = { schema: 'ld-decrypterbench-result/1', answer: '', changed_files: [], commands: [], error };
    }
    const evaluation = evaluateTask(task, result);
    const telemetry = sanitizeTelemetry(result?.telemetry);
    if (telemetry.reported) {
      anyUsage = true;
      reportedPrompt += telemetry.prompt_tokens || 0;
      reportedCompletion += telemetry.completion_tokens || 0;
      reportedTotal += telemetry.total_tokens || 0;
    }
    if (telemetry.cost !== null) {
      anyCost = true;
      reportedCost += telemetry.cost;
    }
    const record = {
      task_id: task.id,
      task_hash: task.task_hash,
      category: task.category,
      provider: provider.id || 'unknown',
      model: provider.model || null,
      started_at: taskStartedAt,
      error,
      telemetry,
      evaluation
    };
    evaluations.push(evaluation);
    results.push(record);
    if (onTask) await onTask(record, task);
  }

  return {
    schema: REPORT_SCHEMA,
    benchmark: manifest,
    selection: {
      task_count: tasks.length,
      task_ids: tasks.map(task => task.id)
    },
    provider: {
      id: provider.id || 'unknown',
      model: provider.model || null,
      provider_independent_protocol: true
    },
    metadata,
    started_at: startedAt,
    completed_at: nowIso(),
    summary: summarizeEvaluations(evaluations),
    telemetry: {
      reported: anyUsage,
      prompt_tokens: anyUsage ? reportedPrompt : null,
      completion_tokens: anyUsage ? reportedCompletion : null,
      total_tokens: anyUsage ? reportedTotal : null,
      cost: anyCost ? Math.round(reportedCost * 1e8) / 1e8 : null
    },
    results
  };
}
