const BROAD_SCOPE = /\b(projeto inteiro|aplica(?:r)? em tudo|todos os arquivos|refatora(?:r)? (?:o )?projeto|migra(?:r|ção) completa|reestrutura(?:r)? (?:o )?projeto|whole project|entire project|all files)\b/i;
const DELETE_INTENT = /\b(apaga(?:r)?|exclu(?:ir|a)|remove(?:r)?|deleta(?:r)?|delete|remove)\b/i;

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function hasAny(command, patterns) {
  const text = normalize(command);
  return patterns.some(pattern => pattern.test(text));
}

function categoryForPath(path) {
  const p = String(path || '').toLowerCase();
  if (/^\.env(?:\.|$)/.test(p) && !/^\.env\.example$/.test(p)) return 'secret-file';
  if (/^supabase\/migrations\//.test(p) || /(?:^|\/)migrations?\/.*\.sql$/.test(p)) return 'database';
  if (/^\.github\/workflows\//.test(p)) return 'ci';
  if (/(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(p)) return 'dependencies';
  if (/(?:auth|login|oauth|session|permission|security|rls|policy)/.test(p)) return 'security';
  if (/(?:payment|checkout|mercadopago|mercado-pago|stripe|billing|pix|webhook)/.test(p)) return 'payments';
  return null;
}

const INTENT = {
  database: [/supabase/, /migration/, /migracao/, /banco/, /database/, /schema/, /sql/, /rls/, /policy/, /politica/, /auth/],
  ci: [/github/, /workflow/, /action/, /pipeline/, /deploy/, /ci\b/, /cd\b/],
  dependencies: [/dependenc/, /package/, /pacote/, /npm/, /pnpm/, /yarn/, /biblioteca/, /instala/],
  security: [/auth/, /login/, /oauth/, /sessao/, /session/, /seguranc/, /permission/, /permiss/, /rls/, /policy/, /acesso/],
  payments: [/pagamento/, /payment/, /checkout/, /mercado pago/, /mercadopago/, /pix/, /stripe/, /billing/, /webhook/]
};

export function evaluateScopeLock(bundle = {}) {
  const command = String(bundle.command || '').trim();
  const files = Array.isArray(bundle?.plan?.files) ? bundle.plan.files : [];
  const violations = [];
  const warnings = [];
  const protectedHits = [];

  if (!command) violations.push('Comando original ausente.');
  if (!files.length) violations.push('Plano sem arquivos para validar.');

  if (files.length > 15 && !BROAD_SCOPE.test(normalize(command))) {
    violations.push(`O plano altera ${files.length} arquivos sem pedido explícito de escopo amplo.`);
  }

  for (const file of files) {
    const path = String(file?.path || '');
    const action = String(file?.action || '').toLowerCase();
    const category = categoryForPath(path);

    if (action === 'delete' && !DELETE_INTENT.test(normalize(command))) {
      violations.push(`Exclusão fora do escopo explícito: ${path}`);
    }

    if (category === 'secret-file') {
      violations.push(`Arquivo de segredo protegido não pode ser alterado automaticamente: ${path}`);
      continue;
    }

    if (category) {
      protectedHits.push({ path, category });
      if (!hasAny(command, INTENT[category] || [])) {
        violations.push(`Área protegida sem intenção explícita no comando (${category}): ${path}`);
      }
    }
  }

  const uniqueCategories = [...new Set(protectedHits.map(x => x.category))];
  if (uniqueCategories.length >= 3 && !BROAD_SCOPE.test(normalize(command))) {
    violations.push(`A alteração atravessa ${uniqueCategories.length} áreas protegidas sem escopo amplo explícito.`);
  }
  if (files.length > 8) warnings.push(`Escopo amplo: ${files.length} arquivos.`);
  if (protectedHits.length) warnings.push(`${protectedHits.length} arquivo(s) em áreas protegidas.`);

  return {
    allowed: violations.length === 0,
    checkedAt: new Date().toISOString(),
    fileCount: files.length,
    protectedHits,
    warnings,
    violations
  };
}

export function assertScopeLock(bundle) {
  const result = evaluateScopeLock(bundle);
  if (!result.allowed) {
    const error = new Error(`SCOPE_LOCK_BLOCKED: ${result.violations.join(' | ')}`);
    error.code = 'SCOPE_LOCK_BLOCKED';
    error.scopeLock = result;
    throw error;
  }
  return result;
}
