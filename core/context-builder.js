import { isTextPath } from './utils.js';
import { getCachedText } from './repo-cache.js';

const ALWAYS = [
  'package.json', 'vite.config.ts', 'vite.config.js', 'tsconfig.json', 'README.md',
  'src/main.tsx', 'src/App.tsx', 'src/routes.tsx', 'src/router.tsx',
  'supabase/config.toml', '.env.example', 'AGENTS.md', 'CLAUDE.md'
];

function words(text) {
  return [...new Set(String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9_-]{3,}/g) || [])];
}

function scorePath(path, commandWords) {
  const p = path.toLowerCase();
  let score = 0;
  if (ALWAYS.some(x => p.endsWith(x.toLowerCase()))) score += 100;
  if (/^(src|app|pages|components|supabase|server|api)\//i.test(path)) score += 12;
  if (/test|spec|stories|fixtures|generated|lock|dist|build/i.test(path)) score -= 8;
  for (const w of commandWords) if (p.includes(w)) score += 14;
  return score;
}

export async function buildProjectContext(adapter, command, options = {}) {
  const maxFiles = Math.max(5, Math.min(40, Number(options.maxFiles || 18)));
  const maxBytes = Math.max(100000, Math.min(1500000, Number(options.maxContextBytes || 500000)));
  const tree = options.repoCache ? { tree: options.repoCache.tree || [], truncated: false } : await adapter.getTree(options.branch || adapter.branch, true);
  if (tree.truncated) throw new Error('Árvore do repositório muito grande para leitura recursiva. Reduza o projeto ou configure uma estratégia de contexto menor.');
  const commandWords = words(command);
  const candidates = (tree.tree || [])
    .filter(x => x.type === 'blob' && x.path && isTextPath(x.path) && Number(x.size || 0) <= 180000)
    .map(x => ({ ...x, score: scorePath(x.path, commandWords) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const selected = [];
  let bytes = 0;
  for (const item of candidates) {
    if (selected.length >= maxFiles) break;
    const size = Number(item.size || 0);
    if (bytes + size > maxBytes && selected.length >= 6) continue;
    try {
      const content = (await getCachedText(item.sha)) ?? (await adapter.getBlob(item.sha));
      const actual = new TextEncoder().encode(content).byteLength;
      if (bytes + actual > maxBytes && selected.length >= 6) continue;
      selected.push({ path: item.path, content, sha: item.sha, size: actual });
      bytes += actual;
    } catch (_) {}
  }

  return {
    branch: options.branch || adapter.branch,
    treePaths: (tree.tree || []).map(x => x.path).filter(Boolean),
    files: selected,
    bytes,
    totalFiles: (tree.tree || []).filter(x => x.type === 'blob').length
  };
}
