import { getSettings } from '../storage/settings-store.js';
import { GitAdapter } from '../github/git-adapter.js';
import { testSupabase, runSupabaseSql } from '../tools/supabase-tools.js';

const PORT_NAME = 'ld2-project-migration';
const PLAN_PREFIX = 'ld2_project_migration_plan_';
const MAX_SQL_BYTES = 2_000_000;
const MAX_MIGRATIONS = 300;

function activeGithub(settings, projectId = '') {
  const mapped = projectId && settings.projectMappings?.[projectId];
  return { ...(settings.github || {}), ...(mapped || {}) };
}

function activeSupabaseRef(settings, projectId = '') {
  const mapped = projectId && settings.supabaseMappings?.[projectId];
  return String(mapped?.projectRef || settings.supabase?.projectRef || '').trim();
}

function riskFlags(sql = '') {
  const text = String(sql || '');
  const flags = [];
  if (/\bdrop\s+(table|schema|type|function|view|policy|extension)\b/i.test(text)) flags.push('DROP');
  if (/\btruncate\b/i.test(text)) flags.push('TRUNCATE');
  if (/\bdelete\s+from\b/i.test(text)) flags.push('DELETE');
  if (/\bsecurity\s+definer\b/i.test(text)) flags.push('SECURITY DEFINER');
  if (/\balter\s+(role|user)\b/i.test(text)) flags.push('ALTER ROLE');
  if (/\bcreate\s+extension\b/i.test(text)) flags.push('EXTENSION');
  return [...new Set(flags)];
}

async function planKey(id) { return `${PLAN_PREFIX}${id}`; }

async function savePlan(plan) {
  const key = await planKey(plan.id);
  await chrome.storage.session.set({ [key]: plan });
}

async function loadPlan(id) {
  const key = await planKey(id);
  const data = await chrome.storage.session.get(key);
  return data[key] || null;
}

async function removePlan(id) {
  await chrome.storage.session.remove(await planKey(id));
}

async function analyze(projectId = '') {
  const settings = await getSettings();
  const github = activeGithub(settings, projectId);
  if (!github.owner || !github.repo) throw new Error('GitHub não conectado a este projeto Lovable.');
  const projectRef = activeSupabaseRef(settings, projectId);
  if (!/^[a-z0-9]{8,32}$/i.test(projectRef)) throw new Error('Selecione um projeto Supabase no Control Center primeiro.');

  const target = await testSupabase({ projectId, projectRef });
  const adapter = new GitAdapter(github);
  const [repo, ref, tree] = await Promise.all([
    adapter.getRepo(),
    adapter.getRef(github.branch),
    adapter.getTree(github.branch, true)
  ]);
  const headSha = String(ref?.object?.sha || '');
  if (!headSha) throw new Error('Não foi possível resolver o HEAD da branch GitHub.');
  if (tree?.truncated) throw new Error('A árvore do repositório foi truncada pelo GitHub. Reduza o projeto ou divida a migração.');

  const migrationNodes = (tree.tree || [])
    .filter(item => item.type === 'blob' && /^supabase\/migrations\/[^/]+\.sql$/i.test(item.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!migrationNodes.length) throw new Error('Nenhuma migration em supabase/migrations/*.sql foi encontrada.');
  if (migrationNodes.length > MAX_MIGRATIONS) throw new Error(`Há migrations demais (${migrationNodes.length}). Limite desta etapa: ${MAX_MIGRATIONS}.`);

  const migrations = [];
  let totalBytes = 0;
  for (const node of migrationNodes) {
    const sql = await adapter.getBlob(node.sha);
    const bytes = new TextEncoder().encode(sql).byteLength;
    totalBytes += bytes;
    if (totalBytes > MAX_SQL_BYTES) throw new Error('O conjunto de migrations ultrapassa 2 MB. Divida a migração em lotes menores.');
    migrations.push({
      path: node.path,
      sha: node.sha,
      bytes,
      risk: riskFlags(sql),
      sql
    });
  }

  const edgeFunctionFiles = (tree.tree || []).filter(item => item.type === 'blob' && /^supabase\/functions\/(?!_shared\/)[^/]+\//i.test(item.path));
  const edgeFunctionSlugs = [...new Set(edgeFunctionFiles.map(item => item.path.split('/')[2]).filter(Boolean))].sort();
  const seed = (tree.tree || []).find(item => item.type === 'blob' && /^supabase\/seed\.sql$/i.test(item.path));
  const config = (tree.tree || []).find(item => item.type === 'blob' && /^supabase\/config\.toml$/i.test(item.path));

  const id = crypto.randomUUID();
  const plan = {
    id,
    createdAt: new Date().toISOString(),
    projectId,
    projectRef,
    repo: repo.full_name || `${github.owner}/${github.repo}`,
    branch: github.branch,
    headSha,
    migrations: migrations.map(({ path, sha, bytes, risk }) => ({ path, sha, bytes, risk }))
  };
  await savePlan(plan);

  return {
    planId: id,
    source: { repo: plan.repo, branch: plan.branch, headSha },
    target: {
      projectRef,
      name: target?.project?.name || target?.project?.ref || projectRef,
      status: target?.project?.status || '',
      databaseAccess: !!target?.database_access
    },
    migrations,
    totalBytes,
    warnings: migrations.flatMap(m => m.risk.map(flag => `${m.path}: ${flag}`)),
    detected: {
      edgeFunctions: edgeFunctionSlugs,
      seedSql: !!seed,
      configToml: !!config
    }
  };
}

async function apply(planId, emit) {
  const plan = await loadPlan(planId);
  if (!plan) throw new Error('Plano de migração expirado. Analise o projeto novamente.');
  const settings = await getSettings();
  const github = activeGithub(settings, plan.projectId || '');
  const currentRef = activeSupabaseRef(settings, plan.projectId || '');
  if (currentRef !== plan.projectRef) throw new Error('O projeto Supabase selecionado mudou. Analise novamente antes de aplicar.');
  await testSupabase({ projectId: plan.projectId || '', projectRef: plan.projectRef });

  const adapter = new GitAdapter(github);
  const ref = await adapter.getRef(plan.branch);
  const currentHead = String(ref?.object?.sha || '');
  if (!currentHead || currentHead !== plan.headSha) throw new Error('A branch GitHub mudou desde a análise. Analise novamente antes de aplicar.');

  const results = [];
  for (let index = 0; index < plan.migrations.length; index++) {
    const item = plan.migrations[index];
    emit({ phase: 'applying', index, total: plan.migrations.length, path: item.path });
    const sql = await adapter.getBlob(item.sha);
    const bytes = new TextEncoder().encode(sql).byteLength;
    if (bytes !== item.bytes) throw new Error(`A migration ${item.path} mudou desde a análise.`);
    try {
      await runSupabaseSql({
        projectId: plan.projectId || '',
        projectRef: plan.projectRef,
        sql
      });
      results.push({ path: item.path, ok: true });
      emit({ phase: 'applied', index, total: plan.migrations.length, path: item.path });
    } catch (error) {
      results.push({ path: item.path, ok: false, error: error?.message || String(error) });
      emit({ phase: 'failed', index, total: plan.migrations.length, path: item.path, error: error?.message || String(error) });
      throw Object.assign(new Error(`Falha em ${item.path}: ${error?.message || String(error)}`), { migrationResults: results });
    }
  }

  await removePlan(planId);
  return {
    ok: true,
    projectRef: plan.projectRef,
    source: `${plan.repo}@${plan.branch}`,
    headSha: plan.headSha,
    applied: results
  };
}

export function installProjectMigrationRuntime() {
  if (globalThis.__LD2_PROJECT_MIGRATION_RUNTIME__) return;
  globalThis.__LD2_PROJECT_MIGRATION_RUNTIME__ = true;

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== PORT_NAME) return;
    const send = payload => { try { port.postMessage(payload); } catch (_) {} };
    const handler = async message => {
      const id = String(message?.id || '');
      const action = String(message?.action || '');
      try {
        if (action === 'analyze') {
          const data = await analyze(String(message?.projectId || ''));
          send({ id, ok: true, data });
          return;
        }
        if (action === 'apply') {
          const data = await apply(String(message?.planId || ''), progress => send({ id, ok: true, progress }));
          send({ id, ok: true, data });
          return;
        }
        throw new Error('Ação de migração desconhecida.');
      } catch (error) {
        send({ id, ok: false, error: error?.message || String(error), migrationResults: error?.migrationResults || null });
      }
    };
    port.onMessage.addListener(handler);
  });
}
