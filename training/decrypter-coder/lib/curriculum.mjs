import { createHash } from 'node:crypto';
import { benchmarkManifest, buildTaskCatalog } from '../../../benchmark/lib/catalog.mjs';

export const CURRICULUM_SCHEMA = 'ld-decrypter-coder-example/1';
export const DATASET_SCHEMA = 'ld-decrypter-coder-dataset/1';
export const CURRICULUM_COUNTS = Object.freeze({
  lovable: 600,
  supabase: 600,
  github: 300,
  react_ts: 300,
  security: 300,
  full_stack: 300
});

const SYSTEM_PROMPT = `You are Decrypter-Coder, the code executor behind Lovable Decrypter. Return only one JSON object with summary, plan, files, dependencies, warnings and commit_message. For update actions content MUST be an empty string and edits MUST contain minimal exact search/replace patches. Never touch files outside the approved scope, never expose secrets, never disable validation, and never delete unless deletion is explicit.`;

const SPECS = Object.freeze({
  lovable: [
    ['route-guard','Preserve route authority while correcting one synthetic Lovable route.',['scope','route','guard'],['src/routes/synthetic.tsx']],
    ['responsive-contract','Keep one component responsive on mobile and desktop without replacing the design system.',['mobile','desktop','responsive'],['src/components/SyntheticPanel.tsx']],
    ['form-authority','Keep client validation helpful while backend validation remains authoritative.',['validation','backend','authority'],['src/components/SyntheticForm.tsx']],
    ['state-reconcile','Reconcile one state source without creating duplicate state.',['state','reconcile','single source'],['src/hooks/useSyntheticState.ts']],
    ['feature-truth','Keep feature state truthful and fail closed when unavailable.',['feature','truthful','fail closed'],['src/components/SyntheticFeature.tsx']],
    ['error-surface','Surface a localized error without hiding the real failure.',['error','surface','localized'],['src/components/SyntheticBoundary.tsx']]
  ],
  supabase: [
    ['rls-owner','Keep row access bound to the authenticated owner.',['rls','auth.uid','owner'],['supabase/migrations/209901010001_synthetic_rls.sql']],
    ['rpc-authority','Move one sensitive mutation behind an authoritative RPC boundary.',['rpc','security definer','search_path'],['supabase/migrations/209901010002_synthetic_rpc.sql']],
    ['edge-auth','Validate authorization and input before one Edge Function operation.',['authorization','validate','backend'],['supabase/functions/synthetic-task/index.ts']],
    ['storage-owner','Keep synthetic Storage access scoped to the resource owner.',['storage','owner','policy'],['supabase/migrations/209901010003_synthetic_storage.sql']],
    ['realtime-idempotent','Reconcile one Realtime event idempotently.',['realtime','idempotent','reconcile'],['src/hooks/useSyntheticRealtime.ts']],
    ['secret-boundary','Keep provider credentials exclusively on the backend.',['secret','backend','redact'],['supabase/functions/synthetic-provider/index.ts']]
  ],
  github: [
    ['branch-safe','Keep one change on a dedicated branch and avoid force operations.',['branch','no force','review'],['.github/SYNTHETIC_BUILD_NOTES.md']],
    ['workflow-least','Keep workflow permissions minimal and validation deterministic.',['permissions','validate','deterministic'],['.github/workflows/synthetic-validate.yml']],
    ['artifact-consistency','Keep version metadata and artifact naming consistent.',['version','artifact','consistent'],['docs/synthetic-version.md']],
    ['recovery-history','Recover one regression without rewriting shared history.',['revert','history','safe'],['docs/synthetic-recovery.md']]
  ],
  react_ts: [
    ['hook-stability','Fix one hook dependency contract without disabling lint rules.',['hook','dependencies','stable'],['src/hooks/useSyntheticWorkspace.ts']],
    ['type-narrow','Replace one unsafe cast with explicit narrowing.',['narrow','type','discriminated'],['src/types/synthetic-events.ts']],
    ['async-stale','Prevent an older async result from replacing a newer request.',['stale','request','abort'],['src/hooks/useSyntheticSearch.ts']],
    ['reducer-invariant','Preserve one typed reducer invariant.',['reducer','invariant','type'],['src/state/syntheticReducer.ts']]
  ],
  security: [
    ['secret-server','Keep one synthetic secret out of the browser bundle.',['secret','server','redact'],['src/server/synthetic-provider.ts']],
    ['parameterized-input','Validate hostile input and keep the operation parameterized.',['parameterized','validate','input'],['src/server/synthetic-search.ts']],
    ['resource-authz','Authorize the resource on the backend even when UI controls are hidden.',['authorization','backend','resource'],['src/server/synthetic-permissions.ts']],
    ['ssrf-allowlist','Allow only approved HTTPS destinations for one server-side fetch.',['allowlist','https','ssrf'],['src/server/synthetic-fetch.ts']]
  ],
  full_stack: [
    ['idempotent-flow','Keep one UI-to-backend operation idempotent end to end.',['idempotent','request','authoritative'],['src/lib/synthetic-checkout.ts']],
    ['optimistic-authority','Reconcile one optimistic item with the authoritative response.',['optimistic','authoritative','reconcile'],['src/hooks/useSyntheticItems.ts']],
    ['cursor-order','Keep cursor pagination stable with deterministic ordering.',['cursor','order','stable'],['src/hooks/useSyntheticFeed.ts']],
    ['cache-confirmed','Invalidate one cache only after the mutation is confirmed.',['cache','confirmed','mutation'],['src/lib/synthetic-cache.ts']]
  ]
});

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenSet(value) {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

function jaccard(a, b) {
  const aa = tokenSet(a), bb = tokenSet(b);
  if (!aa.size && !bb.size) return 1;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  return intersection / (aa.size + bb.size - intersection);
}

function sourceFor(path, id) {
  if (path.endsWith('.sql')) return `-- synthetic fixture ${id}\n-- TODO: preserve-authority\nselect 1;\n`;
  if (path.endsWith('.md')) return `# Synthetic fixture ${id}\n\nTODO: preserve-authority\n`;
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return `name: synthetic-${id}\n# TODO: preserve-authority\n`;
  return `export const syntheticMarker = '${id}';\n// TODO: preserve-authority\n`;
}

function patchFor(path, principles) {
  if (path.endsWith('.sql')) return { search: '-- TODO: preserve-authority', replace: `-- ${principles.join(' | ')}` };
  if (path.endsWith('.md')) return { search: 'TODO: preserve-authority', replace: `Validated methodology: ${principles.join(' | ')}` };
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return { search: '# TODO: preserve-authority', replace: `# ${principles.join(' | ')}` };
  return { search: '// TODO: preserve-authority', replace: `// ${principles.join(' | ')}` };
}

function makeExample(category, index, globalIndex) {
  const spec = SPECS[category][index % SPECS[category].length];
  const [family, directive, principles, allowedPaths] = spec;
  const serial = String(index + 1).padStart(4, '0');
  const id = `dc-train-${category}-${family}-${serial}`;
  const path = allowedPaths[globalIndex % allowedPaths.length];
  const original = sourceFor(path, id);
  const edit = patchFor(path, principles);
  const prompt = `Decrypter-Coder synthetic curriculum ${category}/${family} case ${serial}. ${directive} Apply the smallest valid patch to the approved file only. Required methodology: ${principles.join(', ')}. Fixture ID ${id}.`;
  const context = {
    synthetic: true,
    approved_scope: [path],
    files: [{ path, content: original }],
    rules: ['scope lock', 'no secret exposure', 'minimal patch', 'backend authority when applicable']
  };
  const output = {
    summary: `Apply the minimal synthetic ${family} correction while preserving scope and authority.`,
    plan: [`Patch only ${path}`, `Preserve ${principles.join(', ')}`, 'Return a reviewable minimal change'],
    files: [{
      path,
      action: 'update',
      content: '',
      edits: [edit],
      explanation: `Synthetic training patch for ${family}; keeps the approved scope and ${principles.join(', ')}.`
    }],
    dependencies: [],
    warnings: category === 'security' || category === 'supabase' ? ['Keep authorization and secrets server-side; fail closed on ambiguity.'] : [],
    commit_message: `train(${category}): ${family} synthetic case ${serial}`
  };
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${prompt}\nPROJECT_CONTEXT=${JSON.stringify(context)}` },
    { role: 'assistant', content: JSON.stringify(output) }
  ];
  const split = (globalIndex + 1) % 10 === 0 ? 'validation' : 'train';
  const base = {
    schema: CURRICULUM_SCHEMA,
    id,
    category,
    family,
    split,
    synthetic: true,
    private_customer_code: false,
    benchmark_holdout: true,
    prompt,
    context,
    messages
  };
  return Object.freeze({ ...base, example_hash: hash(base) });
}

export function buildCurriculum() {
  const examples = [];
  let globalIndex = 0;
  for (const [category, count] of Object.entries(CURRICULUM_COUNTS)) {
    for (let index = 0; index < count; index += 1) {
      examples.push(makeExample(category, index, globalIndex));
      globalIndex += 1;
    }
  }
  return Object.freeze(examples);
}

export function validateCurriculum(examples = buildCurriculum()) {
  const errors = [];
  const expectedTotal = Object.values(CURRICULUM_COUNTS).reduce((a, b) => a + b, 0);
  const ids = new Set();
  const hashes = new Set();
  const counts = Object.fromEntries(Object.keys(CURRICULUM_COUNTS).map(key => [key, 0]));
  const splits = { train: 0, validation: 0 };
  const benchmark = buildTaskCatalog();
  const benchmarkPrompts = new Set(benchmark.map(task => normalize(task.prompt)));
  let maxBenchmarkSimilarity = 0;

  if (examples.length !== expectedTotal) errors.push(`expected ${expectedTotal} examples, got ${examples.length}`);
  for (const example of examples) {
    if (example.schema !== CURRICULUM_SCHEMA) errors.push(`${example.id}: invalid schema`);
    if (!example.synthetic || example.private_customer_code !== false || !example.benchmark_holdout) errors.push(`${example.id}: privacy/holdout contract violated`);
    if (ids.has(example.id)) errors.push(`${example.id}: duplicate id`);
    if (hashes.has(example.example_hash)) errors.push(`${example.id}: duplicate hash`);
    ids.add(example.id); hashes.add(example.example_hash);
    if (!(example.category in counts)) errors.push(`${example.id}: unknown category`); else counts[example.category] += 1;
    if (!(example.split in splits)) errors.push(`${example.id}: invalid split`); else splits[example.split] += 1;
    if (benchmarkPrompts.has(normalize(example.prompt))) errors.push(`${example.id}: benchmark prompt copied into training`);
    for (const task of benchmark) maxBenchmarkSimilarity = Math.max(maxBenchmarkSimilarity, jaccard(example.prompt, task.prompt));
    if (!Array.isArray(example.messages) || example.messages.length !== 3) errors.push(`${example.id}: chat messages malformed`);
    const assistant = JSON.parse(example.messages?.[2]?.content || '{}');
    const files = Array.isArray(assistant.files) ? assistant.files : [];
    if (files.length !== 1 || files[0]?.action !== 'update' || files[0]?.content !== '' || !files[0]?.edits?.length) errors.push(`${example.id}: patch contract malformed`);
    const approved = new Set(example.context?.approved_scope || []);
    if (files.some(file => !approved.has(file.path))) errors.push(`${example.id}: output escapes approved scope`);
  }
  for (const [category, count] of Object.entries(CURRICULUM_COUNTS)) if (counts[category] !== count) errors.push(`${category}: expected ${count}, got ${counts[category]}`);
  if (splits.train !== 2160 || splits.validation !== 240) errors.push(`expected split 2160/240, got ${splits.train}/${splits.validation}`);
  if (maxBenchmarkSimilarity >= 0.82) errors.push(`benchmark leakage similarity too high: ${maxBenchmarkSimilarity}`);
  return {
    ok: errors.length === 0,
    errors,
    counts,
    splits,
    total: examples.length,
    dataset_hash: hash(examples.map(example => example.example_hash)),
    benchmark_suite_hash: benchmarkManifest().suite_hash,
    max_benchmark_prompt_similarity: Math.round(maxBenchmarkSimilarity * 10000) / 10000
  };
}

export function datasetManifest(examples = buildCurriculum()) {
  const validation = validateCurriculum(examples);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  return Object.freeze({
    schema: DATASET_SCHEMA,
    version: '1.0.0',
    synthetic_only: true,
    private_customer_code_training: false,
    decrypterbench_holdout: true,
    benchmark_suite_hash: validation.benchmark_suite_hash,
    max_benchmark_prompt_similarity: validation.max_benchmark_prompt_similarity,
    total_examples: validation.total,
    train_examples: validation.splits.train,
    validation_examples: validation.splits.validation,
    categories: validation.counts,
    dataset_hash: validation.dataset_hash
  });
}
