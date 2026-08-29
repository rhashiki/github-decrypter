(() => {
  'use strict';
  if (window.__LD2_PROJECT_RECOVERY_DOCTOR_CORE__) return;
  window.__LD2_PROJECT_RECOVERY_DOCTOR_CORE__ = true;

  const ASSET_EXT = /\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp|tiff?|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|wav|ogg|pdf)$/i;
  const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  const INDEX_NAMES = CODE_EXT.map(ext => `index${ext}`);
  const text = value => String(value ?? '').trim();
  const unique = values => [...new Set(values.map(text).filter(Boolean))];
  const basename = path => text(path).replace(/\\/g, '/').split('/').pop() || '';
  const dirname = path => {
    const clean = text(path).replace(/\\/g, '/');
    const idx = clean.lastIndexOf('/');
    return idx < 0 ? '' : clean.slice(0, idx);
  };

  function normalizePath(value) {
    const raw = text(value).replace(/\\/g, '/').replace(/[?#].*$/, '');
    const out = [];
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return out.join('/');
  }

  function resolveLocalReference(sourcePath, ref) {
    const raw = text(ref);
    if (!raw || /^(?:data:|blob:|mailto:|tel:|#)/i.test(raw)) return '';
    if (/^https?:\/\//i.test(raw)) return '';
    if (raw.startsWith('/')) return normalizePath(`public/${raw.slice(1)}`);
    if (raw.startsWith('@/')) return normalizePath(`src/${raw.slice(2)}`);
    if (raw.startsWith('~/')) return normalizePath(`src/${raw.slice(2)}`);
    if (raw.startsWith('./') || raw.startsWith('../')) {
      return normalizePath(`${dirname(sourcePath)}/${raw}`);
    }
    return '';
  }

  function moduleCandidates(sourcePath, specifier) {
    const base = resolveLocalReference(sourcePath, specifier);
    if (!base) return [];
    if (/\.[a-z0-9]+$/i.test(base)) return [base];
    return unique([
      base,
      ...CODE_EXT.map(ext => `${base}${ext}`),
      ...INDEX_NAMES.map(name => `${base}/${name}`)
    ]);
  }

  function assetTarget(sourcePath, ref) {
    const clean = text(ref);
    if (!clean) return { kind: 'unknown', target: '', url: '' };
    if (/^https?:\/\//i.test(clean)) return { kind: 'remote', target: '', url: clean };
    if (/^(?:data:|blob:)/i.test(clean)) return { kind: 'embedded', target: '', url: clean };
    const target = resolveLocalReference(sourcePath, clean);
    return target ? { kind: 'local', target, url: '' } : { kind: 'unknown', target: '', url: '' };
  }

  function pushMatches(content, regex, cb) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content))) cb(match);
  }

  function extractFileFacts(path, content) {
    const source = String(content || '');
    const facts = {
      path,
      imports: [],
      assets: [],
      routes: [],
      tables: [],
      rpcs: [],
      edgeInvokes: [],
      storageBuckets: [],
      oauthProviders: [],
      redirectUrls: [],
      envNames: [],
      mercadoPagoSignals: []
    };

    pushMatches(source, /\b(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g, m => {
      const specifier = text(m[1]);
      facts.imports.push({ specifier, asset: ASSET_EXT.test(specifier) });
      if (ASSET_EXT.test(specifier)) facts.assets.push({ raw: specifier, kind: 'import' });
    });
    pushMatches(source, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, m => {
      const specifier = text(m[1]);
      facts.imports.push({ specifier, asset: ASSET_EXT.test(specifier) });
      if (ASSET_EXT.test(specifier)) facts.assets.push({ raw: specifier, kind: 'require' });
    });

    pushMatches(source, /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/g, m => {
      const ref = text(m[1]);
      if (ASSET_EXT.test(ref) || /^https?:\/\//i.test(ref)) facts.assets.push({ raw: ref, kind: 'markup' });
    });
    pushMatches(source, /\b(?:src|href|poster)\s*:\s*["']([^"']+)["']/g, m => {
      const ref = text(m[1]);
      if (ASSET_EXT.test(ref) || /^https?:\/\//i.test(ref)) facts.assets.push({ raw: ref, kind: 'object' });
    });
    pushMatches(source, /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, m => {
      const ref = text(m[2]);
      if (ref) facts.assets.push({ raw: ref, kind: 'css' });
    });
    pushMatches(source, /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g, m => {
      facts.assets.push({ raw: text(m[1]), kind: 'new_url' });
    });
    pushMatches(source, /(?:content|image|icon|logo|favicon)\s*[:=]\s*['"]([^'"]+\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp))['"]/gi, m => {
      facts.assets.push({ raw: text(m[1]), kind: 'metadata' });
    });

    pushMatches(source, /<Route\b[^>]*\bpath\s*=\s*['"]([^'"]+)['"]/g, m => facts.routes.push(text(m[1])));
    pushMatches(source, /\bcreate(?:File)?Route\(\s*['"]([^'"]+)['"]/g, m => facts.routes.push(text(m[1])));
    pushMatches(source, /\bpath\s*:\s*['"]([^'"]+)['"]/g, m => {
      const route = text(m[1]);
      if (route.startsWith('/') || route.includes(':') || route === '*') facts.routes.push(route);
    });

    pushMatches(source, /\.from\(\s*['"]([^'"]+)['"]\s*\)/g, m => facts.tables.push(text(m[1])));
    pushMatches(source, /\.rpc\(\s*['"]([^'"]+)['"]/g, m => facts.rpcs.push(text(m[1])));
    pushMatches(source, /\.functions\.invoke\(\s*['"]([^'"]+)['"]/g, m => facts.edgeInvokes.push(text(m[1])));
    pushMatches(source, /\.storage\.from\(\s*['"]([^'"]+)['"]\s*\)/g, m => facts.storageBuckets.push(text(m[1])));
    pushMatches(source, /\bprovider\s*:\s*['"]([^'"]+)['"]/g, m => facts.oauthProviders.push(text(m[1]).toLowerCase()));
    pushMatches(source, /\bredirectTo\s*:\s*['"]([^'"]+)['"]/g, m => facts.redirectUrls.push(text(m[1])));
    pushMatches(source, /Deno\.env\.get\(\s*['"]([A-Z0-9_]+)['"]\s*\)/g, m => facts.envNames.push(text(m[1])));
    pushMatches(source, /import\.meta\.env\.([A-Z0-9_]+)/g, m => facts.envNames.push(text(m[1])));
    pushMatches(source, /process\.env\.([A-Z0-9_]+)/g, m => facts.envNames.push(text(m[1])));

    if (/mercado\s*pago|mercadopago|mercado_pago|MERCADOPAGO_|MP_ACCESS_TOKEN|preference_id|preapproval_id/i.test(source)) {
      facts.mercadoPagoSignals.push(path);
    }

    for (const key of Object.keys(facts)) {
      if (Array.isArray(facts[key]) && key !== 'imports' && key !== 'assets') facts[key] = unique(facts[key]);
    }
    const assetSeen = new Set();
    facts.assets = facts.assets.filter(item => {
      const key = `${item.kind}:${item.raw}`;
      if (!item.raw || assetSeen.has(key)) return false;
      assetSeen.add(key);
      return true;
    });
    const importSeen = new Set();
    facts.imports = facts.imports.filter(item => {
      const key = `${item.specifier}:${item.asset ? 1 : 0}`;
      if (!item.specifier || importSeen.has(key)) return false;
      importSeen.add(key);
      return true;
    });
    return facts;
  }

  function parseSupabaseStorageUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (!/\.supabase\.co$/i.test(url.hostname)) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/i);
      if (!match) return null;
      return {
        projectRef: url.hostname.split('.')[0],
        bucket: decodeURIComponent(match[1]),
        object: decodeURIComponent(match[2])
      };
    } catch (_) {
      return null;
    }
  }

  function issue(id, severity, category, title, detail, meta = {}) {
    return { id, severity, category, title, detail, ...meta };
  }

  function analyze({ files = [], contents = {}, graph = {} } = {}) {
    const workspacePaths = new Set();
    const githubPaths = new Set();
    for (const entry of graph.files?.entries || []) {
      if (entry?.lovable?.exists) workspacePaths.add(text(entry.path));
      if (entry?.github?.exists) githubPaths.add(text(entry.path));
    }
    for (const file of files) if (file?.path) workspacePaths.add(text(file.path));

    const facts = [];
    for (const [path, content] of Object.entries(contents || {})) facts.push(extractFileFacts(path, content));

    const routes = unique(facts.flatMap(f => f.routes)).sort();
    const tablesUsed = unique(facts.flatMap(f => f.tables)).sort();
    const rpcsUsed = unique(facts.flatMap(f => f.rpcs)).sort();
    const edgeInvokes = unique(facts.flatMap(f => f.edgeInvokes)).sort();
    const storageBucketsUsed = unique(facts.flatMap(f => f.storageBuckets)).sort();
    const oauthProviders = unique(facts.flatMap(f => f.oauthProviders)).sort();
    const redirectUrls = unique(facts.flatMap(f => f.redirectUrls)).sort();
    const envNames = unique(facts.flatMap(f => f.envNames)).sort();
    const mercadoPagoDetected = facts.some(f => f.mercadoPagoSignals.length > 0);

    const dbRelations = new Set((graph.database?.relations || []).map(r => text(r?.relation_name || r?.table_name)));
    const dbRoutines = new Set((graph.database?.routines || []).map(r => text(r?.routine_name)));
    const deployedFunctions = new Set((graph.edgeFunctions?.deployed || []).map(f => text(f?.slug || f?.name)));
    const storageBuckets = new Set((graph.storage?.buckets || []).map(b => text(b?.name || b?.id)));
    const storageObjects = (graph.storage?.objects || []).map(o => ({
      bucket: text(o?.bucket_id || o?.bucket),
      name: text(o?.name),
      mimeType: text(o?.mime_type),
      size: Number.isFinite(Number(o?.size)) ? Number(o.size) : null
    })).filter(o => o.bucket && o.name);
    const secretNames = new Set((graph.secretNames || []).map(text));

    const issues = [];
    const missingImports = [];
    for (const fact of facts) {
      for (const item of fact.imports) {
        if (item.asset) continue;
        const spec = item.specifier;
        if (!(spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('~/'))) continue;
        const candidates = moduleCandidates(fact.path, spec);
        if (candidates.length && !candidates.some(path => workspacePaths.has(path))) {
          missingImports.push({ source: fact.path, specifier: spec, candidates });
        }
      }
    }
    for (const item of missingImports) {
      issues.push(issue(
        `import:${item.source}:${item.specifier}`, 'high', 'routes_imports',
        'Import local não resolvido',
        `${item.source} referencia ${item.specifier}, mas nenhum arquivo candidato existe no Workspace Lovable.`,
        { sourcePath: item.source, reference: item.specifier, candidates: item.candidates }
      ));
    }

    const assetRefs = [];
    const assetKey = new Set();
    for (const fact of facts) {
      for (const ref of fact.assets) {
        const resolved = assetTarget(fact.path, ref.raw);
        const row = {
          sourcePath: fact.path,
          reference: ref.raw,
          referenceKind: ref.kind,
          target: resolved.target,
          url: resolved.url,
          state: 'unknown',
          recovery: null
        };
        if (resolved.kind === 'embedded') {
          row.state = 'embedded';
        } else if (resolved.kind === 'local') {
          if (workspacePaths.has(resolved.target)) row.state = 'present';
          else if (githubPaths.has(resolved.target)) {
            row.state = 'github_only';
            row.recovery = { type: 'github_copy_candidate', source: resolved.target };
          } else {
            const fileName = basename(resolved.target).toLowerCase();
            const storageMatches = storageObjects.filter(o => basename(o.name).toLowerCase() === fileName);
            row.state = 'missing';
            if (storageMatches.length === 1) {
              row.recovery = {
                type: 'supabase_storage_candidate',
                bucket: storageMatches[0].bucket,
                object: storageMatches[0].name
              };
            }
          }
        } else if (resolved.kind === 'remote') {
          const sb = parseSupabaseStorageUrl(resolved.url);
          if (sb) {
            const found = storageObjects.some(o => o.bucket === sb.bucket && o.name === sb.object);
            row.state = found ? 'remote_supabase_present' : 'remote_supabase_unverified';
            row.recovery = { type: 'remote_url', url: resolved.url, verifiedMetadata: found };
          } else {
            let host = '';
            try { host = new URL(resolved.url).hostname; } catch (_) {}
            row.state = /lovable/i.test(host) ? 'remote_lovable' : 'remote_external';
            row.recovery = { type: 'remote_url', url: resolved.url, verifiedMetadata: false };
          }
        }
        const key = `${row.sourcePath}:${row.reference}:${row.target}:${row.url}`;
        if (!assetKey.has(key)) {
          assetKey.add(key);
          assetRefs.push(row);
        }
      }
    }

    for (const asset of assetRefs) {
      if (asset.state === 'missing') {
        issues.push(issue(
          `asset:${asset.sourcePath}:${asset.reference}`, 'high', 'assets',
          'Asset referenciado não existe',
          `${asset.sourcePath} referencia ${asset.reference}, mas o arquivo não existe no Workspace Lovable.`,
          {
            sourcePath: asset.sourcePath,
            reference: asset.reference,
            target: asset.target,
            recoverable: !!asset.recovery,
            recovery: asset.recovery
          }
        ));
      } else if (asset.state === 'github_only') {
        issues.push(issue(
          `asset-github:${asset.sourcePath}:${asset.reference}`, 'medium', 'assets',
          'Asset está apenas no GitHub',
          `${asset.reference} existe no GitHub, mas não no Workspace Lovable atual.`,
          { sourcePath: asset.sourcePath, reference: asset.reference, target: asset.target, recovery: asset.recovery }
        ));
      } else if (asset.state === 'remote_lovable') {
        issues.push(issue(
          `asset-lovable:${asset.sourcePath}:${asset.reference}`, 'medium', 'assets',
          'Asset ainda depende de uma origem Lovable',
          `${asset.reference} é remoto e pode deixar de funcionar fora do ambiente original.`,
          { sourcePath: asset.sourcePath, reference: asset.reference, recovery: asset.recovery }
        ));
      }
    }

    const missingTables = tablesUsed.filter(name => !dbRelations.has(name));
    for (const name of missingTables) {
      issues.push(issue(`table:${name}`, 'critical', 'database', 'Tabela/visão usada pelo frontend não existe', `O código usa supabase.from('${name}'), mas ${name} não foi encontrada no Supabase inspecionado.`, { object: name }));
    }

    const missingRpcs = rpcsUsed.filter(name => !dbRoutines.has(name));
    for (const name of missingRpcs) {
      issues.push(issue(`rpc:${name}`, 'critical', 'database', 'RPC usada pelo frontend não existe', `O código usa supabase.rpc('${name}'), mas a rotina não foi encontrada no Supabase inspecionado.`, { object: name }));
    }

    const missingFunctions = edgeInvokes.filter(name => !deployedFunctions.has(name));
    for (const name of missingFunctions) {
      issues.push(issue(`edge:${name}`, 'critical', 'edge_functions', 'Edge Function chamada pelo frontend não está implantada', `O código invoca ${name}, mas a função não aparece no projeto Supabase conectado.`, { object: name }));
    }

    const missingBuckets = storageBucketsUsed.filter(name => !storageBuckets.has(name));
    for (const name of missingBuckets) {
      issues.push(issue(`bucket:${name}`, 'high', 'storage', 'Bucket usado pelo código não existe', `O código usa supabase.storage.from('${name}'), mas o bucket não foi encontrado.`, { object: name }));
    }

    for (const version of graph.migrations?.missing || []) {
      issues.push(issue(`migration-missing:${version}`, 'high', 'migrations', 'Migration esperada não está aplicada', `A migration ${version} existe no projeto, mas não aparece no histórico aplicado do Supabase.`, { migration: version }));
    }
    for (const version of graph.migrations?.remoteOnly || []) {
      issues.push(issue(`migration-remote:${version}`, 'medium', 'migrations', 'Migration aplicada não existe no Workspace', `O Supabase registra ${version}, mas o arquivo correspondente não está no Workspace Lovable atual.`, { migration: version }));
    }

    if (graph.backend?.state === 'mismatch') {
      issues.push(issue('backend:mismatch', 'critical', 'backend', 'Projeto Supabase divergente', 'Lovable, mapeamento da extensão e Supabase inspecionado não apontam para o mesmo project_ref.', { refs: graph.backend?.refs || [] }));
    }

    const googleUsed = oauthProviders.includes('google');
    const google = graph.auth?.google || null;
    if (googleUsed) {
      if (!google?.enabled) issues.push(issue('oauth:google-disabled', 'critical', 'oauth', 'Google OAuth usado no código, mas desabilitado no Supabase', 'O frontend chama signInWithOAuth com Google, porém o provider Google não está habilitado no projeto Supabase.'));
      if (!google?.client_id_present) issues.push(issue('oauth:google-client-id', 'critical', 'oauth', 'Google OAuth sem Client ID', 'O provider Google não possui Client ID detectável na configuração do Supabase.'));
      if (!google?.client_secret_present) issues.push(issue('oauth:google-client-secret', 'critical', 'oauth', 'Google OAuth sem Client Secret', 'O provider Google não possui Client Secret detectável na configuração do Supabase.'));
      if (!text(graph.auth?.site_url)) issues.push(issue('oauth:site-url', 'high', 'oauth', 'Site URL do Supabase Auth ausente', 'Não foi detectada Site URL para o fluxo de autenticação.'));
      const allow = new Set((graph.auth?.uri_allow_list || []).map(text));
      for (const redirect of redirectUrls) {
        if (/^https?:\/\//i.test(redirect) && !allow.has(redirect) && text(graph.auth?.site_url) !== redirect) {
          issues.push(issue(`oauth:redirect:${redirect}`, 'high', 'oauth', 'Redirect OAuth não está allowlisted', `${redirect} aparece no frontend, mas não coincide com Site URL nem com a lista de redirects do Supabase Auth.`, { redirect }));
        }
      }
    }

    const mercadoEnv = envNames.filter(name => /MERCADO|MERCADOPAGO|^MP_/i.test(name));
    const missingMercadoSecrets = mercadoEnv.filter(name => !secretNames.has(name));
    if (mercadoPagoDetected) {
      for (const name of missingMercadoSecrets) {
        issues.push(issue(`mp-secret:${name}`, 'critical', 'mercado_pago', 'Secret do Mercado Pago ausente', `${name} é exigido pelo código, mas não aparece entre os secrets configurados no Supabase.`, { secretName: name }));
      }
      const mpFunctions = unique([
        ...edgeInvokes.filter(name => /mercado|payment|checkout|preference/i.test(name)),
        ...facts.map(f => f.path.match(/^supabase\/functions\/([^/]+)\//i)?.[1] || '').filter(name => /mercado|payment|checkout|preference/i.test(name))
      ]);
      const missingMpFunctions = mpFunctions.filter(name => !deployedFunctions.has(name));
      for (const name of missingMpFunctions) {
        if (issues.some(i => i.id === `edge:${name}`)) continue;
        issues.push(issue(`mp-edge:${name}`, 'critical', 'mercado_pago', 'Função do Mercado Pago não está implantada', `${name} foi detectada como parte da integração, mas não está implantada no Supabase.`, { functionSlug: name }));
      }
      const hasWebhook = [...deployedFunctions].some(name => /mercado.*webhook|payment.*webhook|webhook.*mercado/i.test(name));
      if (!hasWebhook) issues.push(issue('mp-webhook', 'high', 'mercado_pago', 'Webhook do Mercado Pago não foi identificado', 'A integração Mercado Pago foi detectada, mas nenhuma Edge Function de webhook correspondente apareceu no projeto Supabase.'));
    }

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const item of issues) counts[item.severity] = (counts[item.severity] || 0) + 1;

    const assetCounts = {
      total: assetRefs.length,
      present: assetRefs.filter(a => a.state === 'present' || a.state === 'embedded' || a.state === 'remote_supabase_present').length,
      missing: assetRefs.filter(a => a.state === 'missing').length,
      githubOnly: assetRefs.filter(a => a.state === 'github_only').length,
      remoteLovable: assetRefs.filter(a => a.state === 'remote_lovable').length,
      remoteExternal: assetRefs.filter(a => a.state === 'remote_external' || a.state === 'remote_supabase_unverified').length,
      recoverable: assetRefs.filter(a => !!a.recovery).length
    };
    const portability = {
      portable: assetCounts.missing === 0 && assetCounts.remoteLovable === 0 && missingImports.length === 0,
      assetCounts,
      reasons: [
        ...(assetCounts.missing ? [`${assetCounts.missing} asset(s) local(is) ausente(s)`] : []),
        ...(assetCounts.remoteLovable ? [`${assetCounts.remoteLovable} asset(s) ainda hospedado(s) no Lovable`] : []),
        ...(missingImports.length ? [`${missingImports.length} import(s) local(is) quebrado(s)`] : [])
      ]
    };

    const plan = [];
    if (graph.backend?.state === 'mismatch') plan.push({ order: plan.length + 1, area: 'backend', action: 'Reconciliar o project_ref antes de qualquer reparo.' });
    if ((graph.migrations?.missing || []).length) plan.push({ order: plan.length + 1, area: 'migrations', action: 'Gerar migration corretiva mínima e idempotente a partir do schema real.' });
    if (missingTables.length || missingRpcs.length) plan.push({ order: plan.length + 1, area: 'database', action: 'Reconciliar tabelas/RPCs usadas pelo código com o schema real.' });
    if (missingFunctions.length) plan.push({ order: plan.length + 1, area: 'edge_functions', action: 'Restaurar ou substituir Edge Functions chamadas pelo frontend.' });
    if (googleUsed && issues.some(i => i.category === 'oauth')) plan.push({ order: plan.length + 1, area: 'oauth', action: 'Reconfigurar Google OAuth, Site URL e redirects permitidos.' });
    if (mercadoPagoDetected && issues.some(i => i.category === 'mercado_pago')) plan.push({ order: plan.length + 1, area: 'mercado_pago', action: 'Reconfigurar secrets, funções e webhook do Mercado Pago.' });
    if (assetCounts.missing || assetCounts.githubOnly || assetCounts.remoteLovable) plan.push({ order: plan.length + 1, area: 'assets', action: 'Recuperar assets candidatos e restaurar os caminhos originais quando possível.' });
    if (missingImports.length) plan.push({ order: plan.length + 1, area: 'routes_imports', action: 'Reparar imports/rotas locais somente após confirmar o arquivo de origem correto.' });
    plan.push({ order: plan.length + 1, area: 'validation', action: 'Reexecutar Recovery Doctor e exigir zero regressão crítica antes de concluir.' });

    return {
      schema: 'ld-project-recovery-report/1',
      generatedAt: new Date().toISOString(),
      status: counts.critical ? 'broken' : counts.high ? 'degraded' : counts.medium ? 'warning' : 'healthy',
      counts,
      summary: {
        analyzedFiles: facts.length,
        routes: routes.length,
        tablesUsed: tablesUsed.length,
        rpcsUsed: rpcsUsed.length,
        edgeFunctionsInvoked: edgeInvokes.length,
        storageBucketsUsed: storageBucketsUsed.length,
        googleOAuthDetected: googleUsed,
        mercadoPagoDetected
      },
      routes,
      dependencies: {
        missingImports,
        tablesUsed,
        missingTables,
        rpcsUsed,
        missingRpcs,
        edgeInvokes,
        missingFunctions,
        storageBucketsUsed,
        missingBuckets
      },
      oauth: {
        googleUsed,
        providerState: google,
        redirectUrls,
        siteUrl: text(graph.auth?.site_url),
        uriAllowList: graph.auth?.uri_allow_list || []
      },
      mercadoPago: {
        detected: mercadoPagoDetected,
        expectedSecretNames: mercadoEnv,
        missingSecretNames: missingMercadoSecrets
      },
      assets: assetRefs,
      portability,
      issues,
      plan,
      guarantees: {
        readOnly: true,
        automaticRepair: false,
        secretValuesIncluded: false,
        arbitraryRemoteAssetFetch: false
      }
    };
  }

  window.LovableDecrypterProjectRecoveryDoctorCore = Object.freeze({
    schema: 'ld-project-recovery-doctor-core/1',
    normalizePath,
    resolveLocalReference,
    moduleCandidates,
    assetTarget,
    parseSupabaseStorageUrl,
    extractFileFacts,
    analyze
  });
})();