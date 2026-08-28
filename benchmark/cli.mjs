#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { benchmarkManifest, buildTaskCatalog, validateCatalog } from './lib/catalog.mjs';
import { runBenchmark } from './lib/runner.mjs';
import fixtureProvider from './providers/fixture.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'validate';
const option = name => {
  const prefix = `--${name}=`;
  const found = args.find(arg => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

async function loadProvider() {
  const modulePath = option('provider-module');
  if (!modulePath || modulePath === 'fixture') return fixtureProvider;
  const imported = await import(pathToFileURL(resolve(modulePath)).href);
  const provider = imported.default || imported.provider;
  if (!provider?.runTask) throw new Error('Provider module must export default/provider with runTask(task, context)');
  return provider;
}

if (command === 'validate') {
  const validation = validateCatalog();
  console.log(JSON.stringify({ schema: 'ld-decrypterbench-validation/1', ...validation }, null, 2));
  if (!validation.ok) process.exitCode = 1;
} else if (command === 'manifest') {
  console.log(JSON.stringify(benchmarkManifest(), null, 2));
} else if (command === 'catalog') {
  console.log(JSON.stringify(buildTaskCatalog(), null, 2));
} else if (command === 'run') {
  const provider = await loadProvider();
  const category = option('category');
  const limitRaw = option('limit');
  const limit = limitRaw ? Number(limitRaw) : null;
  let tasks = buildTaskCatalog();
  if (category) tasks = tasks.filter(task => task.category === category);
  if (Number.isFinite(limit) && limit > 0) tasks = tasks.slice(0, limit);
  const report = await runBenchmark({
    provider,
    tasks,
    metadata: {
      commit: process.env.GITHUB_SHA || process.env.LD_BENCH_COMMIT || null,
      runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local'
    }
  });
  const output = option('output');
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    schema: report.schema,
    benchmark: report.benchmark,
    provider: report.provider,
    summary: report.summary,
    telemetry: report.telemetry,
    output: output || null
  }, null, 2));
} else {
  throw new Error(`Unknown command: ${command}`);
}
