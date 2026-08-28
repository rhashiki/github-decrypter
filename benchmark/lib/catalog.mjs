import { createHash } from 'node:crypto';

export const BENCHMARK_SCHEMA = 'ld-decrypterbench/1';
export const TASK_SCHEMA = 'ld-decrypterbench-task/1';
export const EXPECTED_COUNTS = Object.freeze({
  lovable: 100,
  supabase: 100,
  github: 50,
  react_ts: 50,
  security: 50,
  full_stack: 50
});

const variants = [
  'alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet'
];

const family = (category, prefix, title, prompt, required, allowedPaths, options = {}) => ({
  category, prefix, title, prompt, required, allowedPaths,
  risk: options.risk || 'medium',
  forbidden: options.forbidden || ['disable validation', 'ignore security'],
  forbiddenPaths: options.forbiddenPaths || ['.env', '.env.local', 'secrets.json'],
  maxChangedFiles: options.maxChangedFiles || Math.max(1, allowedPaths.length),
  expectedMode: options.expectedMode || 'build'
});

const FAMILIES = [
  family('lovable','routing','Lovable route correction','Corrija uma rota quebrada em um projeto Lovable sem alterar páginas fora do escopo.',['route','scope'],['src/routes/app.tsx','src/pages/Workspace.tsx']),
  family('lovable','responsive-ui','Responsive UI','Ajuste uma tela Lovable para mobile e desktop preservando o design system existente.',['mobile','desktop','responsive'],['src/components/Dashboard.tsx','src/styles/dashboard.css']),
  family('lovable','form-validation','Form validation','Adicione validação de formulário no cliente sem substituir a autoridade do backend.',['validation','backend'],['src/components/ProfileForm.tsx','src/lib/validation.ts']),
  family('lovable','state-sync','State synchronization','Corrija sincronização de estado entre painel e modal sem criar estado duplicado.',['state','sync'],['src/components/ControlPanel.tsx','src/hooks/useProjectState.ts']),
  family('lovable','auth-guard','Auth guard','Proteja uma rota autenticada sem expor dados antes da sessão ser confirmada.',['auth','guard'],['src/routes/protected.tsx','src/hooks/useSession.ts'],{risk:'high'}),
  family('lovable','feature-flag','Feature flag','Implemente uma feature flag com fallback seguro e sem comportamento falso na UI.',['feature','flag','fallback'],['src/lib/features.ts','src/components/FeatureGate.tsx']),
  family('lovable','error-boundary','Error boundary','Adicione tratamento de erro localizado sem esconder falhas reais do usuário.',['error','boundary'],['src/components/AppErrorBoundary.tsx']),
  family('lovable','performance','Lovable performance','Reduza renderizações desnecessárias sem mudar comportamento funcional.',['render','behavior'],['src/components/ProjectList.tsx','src/hooks/useProjects.ts']),
  family('lovable','accessibility','Lovable accessibility','Melhore navegação por teclado e semântica sem alterar o fluxo principal.',['keyboard','aria'],['src/components/CommandDialog.tsx']),
  family('lovable','plan-scope','Plan scope discipline','Produza uma alteração mínima respeitando exatamente os arquivos aprovados no plano.',['scope','approved'],['src/components/SettingsPanel.tsx'],{maxChangedFiles:1}),

  family('supabase','rls','Supabase RLS','Corrija uma política RLS para impedir leitura cruzada entre usuários.',['rls','auth.uid'],['supabase/migrations/202608280001_rls.sql'],{risk:'high'}),
  family('supabase','rpc','Authoritative RPC','Substitua DML sensível do cliente por RPC autoritativa com validação no banco.',['rpc','security definer','search_path'],['supabase/migrations/202608280002_rpc.sql','src/lib/api.ts'],{risk:'high'}),
  family('supabase','migration','Safe migration','Crie migration reversível e compatível com dados existentes.',['migration','existing data'],['supabase/migrations/202608280003_safe.sql']),
  family('supabase','edge-function','Edge Function','Implemente Edge Function validando autenticação e entrada antes de acessar dados.',['authorization','validate'],['supabase/functions/task/index.ts'],{risk:'high'}),
  family('supabase','auth','Supabase Auth','Corrija fluxo de sessão sem confiar em user_id enviado pelo cliente.',['auth','session'],['src/lib/auth.ts','supabase/functions/session/index.ts'],{risk:'high'}),
  family('supabase','storage','Storage policy','Restrinja objetos do Storage por proprietário e prefixo autorizado.',['storage','owner'],['supabase/migrations/202608280004_storage.sql'],{risk:'high'}),
  family('supabase','realtime','Realtime consistency','Evite duplicação ao reconciliar eventos Realtime com estado otimista.',['realtime','idempotent'],['src/hooks/useRealtimeMessages.ts']),
  family('supabase','indexes','Database indexes','Adicione índice compatível com o padrão real de consulta sem duplicar índices existentes.',['index','query'],['supabase/migrations/202608280005_index.sql']),
  family('supabase','transaction','Transactional invariant','Preserve uma invariável financeira usando operação atômica no banco.',['transaction','atomic'],['supabase/migrations/202608280006_transaction.sql'],{risk:'high'}),
  family('supabase','secrets','Edge secrets boundary','Use segredo somente no backend e impeça sua serialização para o navegador.',['secret','backend'],['supabase/functions/provider/index.ts'],{risk:'critical',forbidden:['VITE_SECRET','NEXT_PUBLIC_SECRET','console.log(secret)']}),

  family('github','branching','GitHub branching','Aplique a mudança em branch dedicada sem force push em main.',['branch','no force'],['.github/BUILD_NOTES.md']),
  family('github','workflow','GitHub Actions','Corrija um workflow mantendo permissões mínimas e validação determinística.',['permissions','validate'],['.github/workflows/validate.yml']),
  family('github','pull-request','Pull request hygiene','Prepare alteração revisável com escopo pequeno e sem arquivos gerados desnecessários.',['review','scope'],['docs/change.md']),
  family('github','versioning','Version consistency','Atualize versão mantendo manifest, documentação e artefato consistentes.',['version','artifact'],['manifest.json','CHANGELOG.md']),
  family('github','recovery','Safe recovery','Recupere uma regressão usando commit conhecido sem reescrever histórico compartilhado.',['revert','history'],['docs/recovery.md'],{risk:'high'}),

  family('react_ts','hooks','React hooks','Corrija hook com dependências instáveis sem desativar regras de lint.',['hook','dependencies'],['src/hooks/useWorkspace.ts']),
  family('react_ts','reducer','Reducer invariants','Refatore estado complexo para reducer preservando invariantes e tipos.',['reducer','state'],['src/state/projectReducer.ts']),
  family('react_ts','types','TypeScript narrowing','Remova cast inseguro usando narrowing explícito e tipo discriminado.',['narrow','type'],['src/types/events.ts']),
  family('react_ts','async-state','Async state','Impeça resposta obsoleta de sobrescrever uma requisição mais nova.',['stale','request'],['src/hooks/useSearch.ts']),
  family('react_ts','memoization','Memoization discipline','Use memoização apenas onde reduz trabalho real e preserve semântica.',['memo','semantics'],['src/components/ResultGrid.tsx']),

  family('security','secret-leak','Secret leakage','Remova segredo do bundle cliente e mantenha credencial somente no servidor.',['secret','server'],['src/server/provider.ts'],{risk:'critical',forbidden:['localStorage.setItem("secret"','VITE_API_SECRET','NEXT_PUBLIC_API_SECRET']}),
  family('security','injection','Injection defense','Valide entrada hostil e use operação parametrizada em vez de concatenar consulta.',['parameterized','validate'],['src/server/search.ts'],{risk:'critical',forbidden:['eval(','new Function(','SELECT * FROM users WHERE id = \' +']}),
  family('security','authorization','Authorization boundary','Garanta autorização por recurso no backend mesmo com UI ocultando o botão.',['authorization','backend'],['src/server/permissions.ts'],{risk:'critical'}),
  family('security','ssrf','SSRF defense','Restrinja destino de requisição server-side a hosts e protocolos permitidos.',['allowlist','https'],['src/server/fetchRemote.ts'],{risk:'critical',forbidden:['fetch(userUrl)','http://169.254.169.254']}),
  family('security','supply-chain','Supply-chain safety','Evite adicionar dependência desnecessária e preserve lockfile quando não houver pacote novo.',['dependency','lockfile'],['src/lib/sanitize.ts'],{risk:'high',maxChangedFiles:1}),

  family('full_stack','idempotency','Full-stack idempotency','Implemente idempotência entre UI, API e persistência para evitar operação duplicada.',['idempotent','request'],['src/lib/checkout.ts','supabase/functions/checkout/index.ts','supabase/migrations/202608280007_idempotency.sql'],{risk:'high'}),
  family('full_stack','optimistic','Optimistic reconciliation','Reconcilie atualização otimista com resposta autoritativa sem duplicar itens.',['optimistic','authoritative'],['src/hooks/useItems.ts','src/lib/itemsApi.ts']),
  family('full_stack','pagination','End-to-end pagination','Implemente paginação estável com cursor e ordenação determinística.',['cursor','order'],['src/hooks/useFeed.ts','supabase/functions/feed/index.ts']),
  family('full_stack','cache','Cache invalidation','Invalide cache apenas após mutação confirmada e evite mostrar sucesso falso.',['cache','confirmed'],['src/lib/cache.ts','src/lib/api.ts']),
  family('full_stack','observability','Operational observability','Registre falhas com correlação sem armazenar segredos ou conteúdo sensível.',['correlation','redact'],['src/server/logger.ts','supabase/functions/operation/index.ts'],{risk:'high'})
];

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function taskFor(spec, index) {
  const variant = variants[index - 1];
  const id = `${spec.category}-${spec.prefix}-${String(index).padStart(2,'0')}`;
  const task = {
    schema: TASK_SCHEMA,
    id,
    category: spec.category,
    family: spec.prefix,
    variant: index,
    title: `${spec.title} · ${variant}`,
    risk: spec.risk,
    prompt: `${spec.prompt} Cenário sintético ${variant}; variante ${index}. Não altere arquivos fora do escopo aprovado.`,
    fixture: {
      synthetic: true,
      project: `decrypterbench-${spec.category}-${variant}`,
      note: 'Fixture sintética; nunca contém código privado de cliente.'
    },
    expected: {
      mode: spec.expectedMode,
      required_terms: spec.required,
      forbidden_terms: spec.forbidden,
      allowed_paths: spec.allowedPaths,
      forbidden_paths: spec.forbiddenPaths,
      max_changed_files: spec.maxChangedFiles,
      no_cross_scope_changes: true,
      no_secret_exposure: true
    },
    scoring: { format: 10, correctness: 30, scope: 25, security: 20, efficiency: 15 }
  };
  return Object.freeze({ ...task, task_hash: stableHash(task) });
}

export function buildTaskCatalog() {
  const tasks = FAMILIES.flatMap(spec => variants.map((_, i) => taskFor(spec, i + 1)));
  return Object.freeze(tasks);
}

export function validateCatalog(tasks = buildTaskCatalog()) {
  const errors = [];
  if (tasks.length !== 400) errors.push(`expected 400 tasks, got ${tasks.length}`);
  const ids = new Set();
  const hashes = new Set();
  const counts = Object.fromEntries(Object.keys(EXPECTED_COUNTS).map(k => [k, 0]));
  for (const task of tasks) {
    if (task.schema !== TASK_SCHEMA) errors.push(`${task.id}: invalid schema`);
    if (ids.has(task.id)) errors.push(`${task.id}: duplicate id`);
    if (hashes.has(task.task_hash)) errors.push(`${task.id}: duplicate task hash`);
    ids.add(task.id); hashes.add(task.task_hash);
    if (!(task.category in counts)) errors.push(`${task.id}: unknown category`);
    else counts[task.category] += 1;
    if (!task.fixture?.synthetic) errors.push(`${task.id}: non-synthetic fixture forbidden`);
    if (!task.expected?.allowed_paths?.length) errors.push(`${task.id}: allowed_paths empty`);
    const scoreTotal = Object.values(task.scoring || {}).reduce((a,b)=>a+b,0);
    if (scoreTotal !== 100) errors.push(`${task.id}: scoring total ${scoreTotal}`);
  }
  for (const [category, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[category] !== expected) errors.push(`${category}: expected ${expected}, got ${counts[category]}`);
  }
  return { ok: errors.length === 0, errors, counts, total: tasks.length, suite_hash: stableHash(tasks) };
}

export function benchmarkManifest() {
  const tasks = buildTaskCatalog();
  const validation = validateCatalog(tasks);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  return Object.freeze({
    schema: BENCHMARK_SCHEMA,
    version: '1.0.0',
    total_tasks: validation.total,
    categories: validation.counts,
    suite_hash: validation.suite_hash,
    synthetic_only: true,
    private_customer_code_training: false
  });
}
