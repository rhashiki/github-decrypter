import { assertSafeRepoPath, decodeBase64Utf8, encodeBase64Utf8, slugify } from '../core/utils.js';

const API_VERSION = '2026-03-10';

export class GitAdapter {
  constructor(config = {}) {
    this.owner = config.owner || '';
    this.repo = config.repo || '';
    this.branch = config.branch || 'main';
    this.token = config.token || '';
  }

  ensureRepo() {
    if (!this.owner || !this.repo) throw new Error('Configure o repositório GitHub primeiro.');
  }

  async request(path, options = {}) {
    this.ensureRepo();
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      ...(options.headers || {})
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`https://api.github.com${path}`, { ...options, headers });
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) body = await res.json().catch(() => null);
    else body = await res.text().catch(() => '');
    if (!res.ok) {
      const msg = body?.message || body?.error || body || `GitHub HTTP ${res.status}`;
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
      const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
      const res = await fetch(data.download_url, { headers });
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
        body: 'Alterações geradas pelo Lovable Decrypter v2.0 e aprovadas pelo usuário após revisão do diff.',
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
    const headers = { Accept: 'application/vnd.github+json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/zipball/${encodeURIComponent(branch)}`, { headers, redirect: 'follow' });
    if (!res.ok) throw new Error(`Falha ao baixar ZIP (${res.status}).`);
    return Array.from(new Uint8Array(await res.arrayBuffer()));
  }
}
