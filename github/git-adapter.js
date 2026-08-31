import { assertSafeRepoPath, decodeBase64Utf8, encodeBase64Utf8, slugify } from '../core/utils.js';
import { getSettings } from '../storage/settings-store.js';
import { DEFAULT_BACKEND_BASE } from '../settings/config.js';

const API_VERSION = '2026-03-10';
const REQUEST_TIMEOUT_MS = 45000;
const TOKEN_SKEW_MS = 120000;
const installationTokenCache = new Map();

function trustedGitHubDownloadUrl(value = '') {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new Error('GitHub retornou uma URL de download inválida.'); }
  const host = url.hostname.toLowerCase();
  const trusted = url.protocol === 'https:' && (
    host === 'github.com' ||
    host === 'api.github.com' ||
    host === 'codeload.github.com' ||
    host.endsWith('.githubusercontent.com')
  );
  if (!trusted) throw new Error(`GitHub retornou uma origem de download não confiável: ${host || 'desconhecida'}.`);
  return url.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: options.signal || controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('GitHub não respondeu dentro do tempo limite.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function installationAccessToken(installationId) {
  const id = Number(installationId || 0);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Conecte o GitHub pelo botão GitHub do Lovable Decrypter antes de executar comandos.');

  const cached = installationTokenCache.get(id);
  if (cached?.token && Number(cached.expiresAt || 0) - TOKEN_SKEW_MS > Date.now()) return cached.token;

  const settings = await getSettings();
  const licenseKey = String(settings.auth?.licenseKey || '').trim();
  const deviceId = String(settings.auth?.deviceId || '').trim();
  if (!licenseKey || !deviceId) throw new Error('Faça login com uma KEY válida antes de conectar o GitHub.');

  const backendBase = String(settings.auth?.backendBase || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  const res = await fetchWithTimeout(`${backendBase}/ld-github-app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-license-key': licenseKey,
      'x-device-id': deviceId
    },
    body: JSON.stringify({ action: 'token' })
  }, 30000);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok || !body?.token) {
    const code = body?.code || `HTTP_${res.status}`;
    throw new Error(`GitHub App indisponível: ${code}. Abra GitHub no Control Center e reconecte.`);
  }
  if (Number(body.installation_id || 0) !== id) throw new Error('A instalação GitHub ativa não corresponde ao projeto configurado. Reconecte o GitHub.');

  const expiresAt = Date.parse(body.expires_at || '') || (Date.now() + 45 * 60 * 1000);
  installationTokenCache.set(id, { token: String(body.token), expiresAt });
  return String(body.token);
}

export class GitAdapter {
  constructor(config = {}) {
    this.owner = config.owner || '';
    this.repo = config.repo || '';
    this.branch = config.branch || 'main';
    this.authMode = config.authMode === 'legacy_token' ? 'legacy_token' : 'github_app';
    this.installationId = Number(config.installationId || 0) || null;
    this.token = this.authMode === 'legacy_token' ? String(config.token || '') : '';
  }

  ensureRepo() {
    if (!this.owner || !this.repo) throw new Error('Selecione um repositório GitHub para este projeto primeiro.');
  }

  async resolveToken() {
    if (this.authMode === 'legacy_token') {
      if (!this.token) throw new Error('Token legado ausente. Reconecte usando GitHub App.');
      return this.token;
    }
    return installationAccessToken(this.installationId);
  }

  async request(path, options = {}) {
    this.ensureRepo();
    const token = await this.resolveToken();
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };
    const res = await fetchWithTimeout(`https://api.github.com${path}`, { ...options, headers });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) body = await res.json().catch(() => null);
    else body = await res.text().catch(() => '');
    if (!res.ok) {
      const msg = body?.message || body?.error || body || `GitHub HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) installationTokenCache.delete(Number(this.installationId || 0));
      throw new Error(String(msg));
    }
    return body;
  }

  async test() {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`);
  }

  async getRepo() { return this.test(); }

  async getRef(branch = this.branch) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/ref/heads/${encodeURIComponent(branch)}`);
  }

  async getCommit(sha) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/commits/${encodeURIComponent(sha)}`);
  }

  async listCommits(branch = this.branch, { path = '', limit = 12 } = {}) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit || 12)));
    const params = new URLSearchParams({ sha: String(branch || this.branch), per_page: String(safeLimit) });
    if (path) params.set('path', assertSafeRepoPath(path));
    const rows = await this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/commits?${params}`);
    return Array.isArray(rows) ? rows : [];
  }

  async compareCommits(base, head) {
    const from = String(base || '').trim();
    const to = String(head || '').trim();
    if (!from || !to) throw new Error('Base e head são obrigatórios para comparar commits.');
    const range = `${encodeURIComponent(from)}...${encodeURIComponent(to)}`;
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/compare/${range}`);
  }

  async getTree(ref = this.branch, recursive = true) {
    const suffix = recursive ? '?recursive=1' : '';
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/trees/${encodeURIComponent(ref)}${suffix}`);
  }

  async getBlob(sha) {
    const data = await this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/blobs/${encodeURIComponent(sha)}`);
    if (data.encoding !== 'base64') throw new Error('Blob GitHub em codificação não suportada.');
    return decodeBase64Utf8(data.content || '');
  }

  async getFileByPath(path, ref = this.branch) {
    const safe = assertSafeRepoPath(path);
    const data = await this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/contents/${safe.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
    if (Array.isArray(data)) throw new Error(`${safe} é um diretório.`);
    if (data.encoding === 'base64' && typeof data.content === 'string') return { ...data, text: decodeBase64Utf8(data.content) };
    if (data.download_url) {
      const downloadUrl = trustedGitHubDownloadUrl(data.download_url);
      const token = await this.resolveToken();
      const res = await fetchWithTimeout(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Falha ao ler ${safe}.`);
      return { ...data, text: await res.text() };
    }
    throw new Error(`Não foi possível ler ${safe}.`);
  }

  async createBlob(content) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: encodeBase64Utf8(content), encoding: 'base64' })
    });
  }

  async createTree(baseTree, entries) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTree, tree: entries })
    });
  }

  async createCommit(message, treeSha, parentSha) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
    });
  }

  async createBranch(name, fromSha) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha })
    });
  }

  async updateBranch(name, sha) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/refs/heads/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha, force: false })
    });
  }

  async deleteBranch(name) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/git/refs/heads/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
  }

  async listActionsRuns(branch) {
    const data = await this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/actions/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=20`);
    return Array.isArray(data?.workflow_runs) ? data.workflow_runs : [];
  }

  async createPullRequest({ title, body, head, base }) {
    return this.request(`/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, head, base })
    });
  }

  async atomicCommit({ files, message, baseBranch = this.branch, createBranch = true, createPr = true, branchName = '' }) {
    if (!Array.isArray(files) || !files.length) throw new Error('Nenhuma alteração para aplicar.');
    const baseRef = await this.getRef(baseBranch);
    const baseCommitSha = baseRef.object?.sha;
    if (!baseCommitSha) throw new Error('Não foi possível resolver o commit base.');
    const baseCommit = await this.getCommit(baseCommitSha);
    const baseTree = baseCommit.tree?.sha;
    if (!baseTree) throw new Error('Não foi possível resolver a árvore base.');

    let targetBranch = baseBranch;
    if (createBranch) {
      targetBranch = branchName || `ld/${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)}-${slugify(message)}`;
      await this.createBranch(targetBranch, baseCommitSha);
    }

    const entries = [];
    for (const file of files) {
      const path = assertSafeRepoPath(file.path);
      const action = String(file.action || 'update').toLowerCase();
      if (action === 'delete') {
        entries.push({ path, mode: '100644', type: 'blob', sha: null });
      } else {
        if (typeof file.content !== 'string') throw new Error(`Conteúdo ausente para ${path}.`);
        const blob = await this.createBlob(file.content);
        entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }
    }

    const tree = await this.createTree(baseTree, entries);
    const commit = await this.createCommit(message || 'chore: apply Lovable Decrypter changes', tree.sha, baseCommitSha);
    await this.updateBranch(targetBranch, commit.sha);

    let pr = null;
    if (createPr && createBranch) {
      pr = await this.createPullRequest({
        title: message || 'Lovable Decrypter changes',
        body: 'Alterações geradas pelo Lovable Decrypter e aprovadas pelo usuário após revisão do diff.',
        head: targetBranch,
        base: baseBranch
      });
    }

    return {
      branch: targetBranch,
      commitSha: commit.sha,
      commitUrl: `https://github.com/${this.owner}/${this.repo}/commit/${commit.sha}`,
      pullRequest: pr ? { number: pr.number, url: pr.html_url } : null
    };
  }

  async fetchZipBytes(branch = this.branch) {
    this.ensureRepo();
    const token = await this.resolveToken();
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
    const res = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/zipball/${encodeURIComponent(branch)}`, { headers, redirect: 'follow' }, 120000);
    if (!res.ok) throw new Error(`Falha ao baixar ZIP (${res.status}).`);
    return Array.from(new Uint8Array(await res.arrayBuffer()));
  }
}
