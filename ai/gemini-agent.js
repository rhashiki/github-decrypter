import { parseJsonOutput, extractOutputText } from '../core/response-parser.js';
import { assertSafeRepoPath } from '../core/utils.js';
import { DEFAULT_FREE_MODEL, DEFAULT_FREE_ADVANCED_MODEL, isVerifiedFreeModel, isSpecializedGeminiModel, normalizeGeminiModelId } from '../settings/config.js';

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    plan: { type: 'array', items: { type: 'string' } },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          content: { type: 'string' },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                search: { type: 'string' },
                replace: { type: 'string' }
              },
              required: ['search', 'replace']
            }
          },
          explanation: { type: 'string' }
        },
        required: ['path', 'action', 'content', 'edits', 'explanation']
      }
    },
    dependencies: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    commit_message: { type: 'string' }
  },
  required: ['summary', 'plan', 'files', 'dependencies', 'warnings', 'commit_message']
};




const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    plan: { type: 'array', items: { type: 'string' } },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['path', 'reason']
      }
    },
    warnings: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'plan', 'files', 'warnings']
};

const TRAIN_SCHEMA = {
  type: 'object',
  properties: {
    project_summary: { type: 'string' },
    architecture: { type: 'array', items: { type: 'string' } },
    rules: { type: 'array', items: { type: 'string' } },
    important_paths: { type: 'array', items: { type: 'string' } },
    validation_checklist: { type: 'array', items: { type: 'string' } }
  },
  required: ['project_summary', 'architecture', 'rules', 'important_paths', 'validation_checklist']
};

export class GeminiAgent {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = normalizeGeminiModelId(config.model || DEFAULT_FREE_MODEL);
    this.advancedModel = normalizeGeminiModelId(config.advancedModel || DEFAULT_FREE_ADVANCED_MODEL);
    this.maxOutputTokens = Number(config.maxOutputTokens || 32768);
    this.billingMode = config.billingMode === 'user_paid' ? 'user_paid' : 'free';
    this.zeroCost = this.billingMode !== 'user_paid' && config.zeroCost !== false;
    this.backendBase = String(config.backendBase || '').replace(/\/+$/, '');
    this.licenseKey = String(config.licenseKey || '');
    this.deviceId = String(config.deviceId || '');
  }

  async backendCommand(mode, command, context, agentRules = '', attachments = [], approvedPlan = null) {
    this.ensureKey();
    if (!this.backendBase) throw new Error('Backend do Lovable Decrypter não configurado.');
    if (!this.licenseKey) throw new Error('Faça login com uma KEY válida.');
    if (!this.deviceId) throw new Error('Dispositivo ainda não foi vinculado à licença.');
    const model = this.ensureZeroCostModel(this.model);
    const res = await fetch(`${this.backendBase}/ld-command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-license-key': this.licenseKey,
        'x-device-id': this.deviceId,
        'x-gemini-key': this.apiKey
      },
      body: JSON.stringify({
        mode,
        model,
        max_output_tokens: this.maxOutputTokens,
        gemini_billing_mode: this.billingMode,
        command_id: crypto.randomUUID(),
        command,
        project_context: context,
        agent_rules: agentRules || '',
        approved_plan: approvedPlan || null,
        attachments: (attachments || []).map(a => ({
          name: a.name || 'anexo',
          mime_type: a.mimeType || 'application/octet-stream',
          size: Number(a.size || 0),
          data: a.data || ''
        }))
      })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      const detail = body?.error || body?.message || body?.code || `HTTP ${res.status}`;
      throw new Error(`Backend Lovable Decrypter: ${detail}`);
    }
    return body.result;
  }

  ensureKey() {
    if (!this.apiKey) throw new Error('Configure sua API Key do Gemini em Configurações.');
  }

  ensureZeroCostModel(model) {
    const id = normalizeGeminiModelId(model);
    if (this.zeroCost && !isVerifiedFreeModel(id)) {
      throw new Error(`ZERO COST bloqueou ${id}: este modelo não possui Free Tier verificado na lista de segurança desta versão.`);
    }
    return id;
  }

  async listModels() {
    this.ensureKey();
    const models = [];
    let pageToken = '';
    do {
      const qs = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) qs.set('pageToken', pageToken);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${qs}`, {
        headers: { 'x-goog-api-key': this.apiKey }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || `Gemini Models HTTP ${res.status}`);
      for (const raw of data?.models || []) {
        const id = normalizeGeminiModelId(raw.name || raw.baseModelId || '');
        if (!id) continue;
        const methods = Array.isArray(raw.supportedGenerationMethods) ? raw.supportedGenerationMethods : [];
        const generateContent = methods.includes('generateContent');
        models.push({
          id,
          displayName: raw.displayName || id,
          description: raw.description || '',
          inputTokenLimit: raw.inputTokenLimit || null,
          outputTokenLimit: raw.outputTokenLimit || null,
          supportedGenerationMethods: methods,
          compatible: generateContent && !isSpecializedGeminiModel(id),
          freeTierVerified: isVerifiedFreeModel(id)
        });
      }
      pageToken = data?.nextPageToken || '';
    } while (pageToken);
    models.sort((a, b) => {
      if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
      if (a.freeTierVerified !== b.freeTierVerified) return a.freeTierVerified ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, 'pt-BR', { numeric: true });
    });
    return models;
  }

  async call({ input, model = this.model, schema = null, maxOutputTokens = this.maxOutputTokens }) {
    this.ensureKey();
    model = this.ensureZeroCostModel(model);
    const body = {
      model,
      input,
      store: false,
      generation_config: { max_output_tokens: maxOutputTokens }
    };
    if (schema) {
      body.response_format = {
        type: 'text',
        mime_type: 'application/json',
        schema
      };
    }
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
    const status = data?.status || 'completed';
    if (status === 'failed') throw new Error(data?.error?.message || 'A interação Gemini falhou.');
    if (status === 'incomplete') {
      const used = data?.usage?.total_output_tokens ?? null;
      throw new Error(`Gemini interrompeu a resposta por limite de tokens${used != null ? ` (${used} tokens de saída)` : ''}. Aumente o limite de saída e tente novamente.`);
    }
    if (status === 'budget_exceeded') throw new Error('Gemini interrompeu a resposta porque o orçamento de tokens foi excedido.');
    if (status === 'cancelled') throw new Error('A interação Gemini foi cancelada.');
    if (status === 'requires_action') throw new Error('O Gemini solicitou uma ação externa inesperada durante esta operação.');
    if (status !== 'completed') throw new Error(`Gemini retornou estado inesperado: ${status}.`);
    return data;
  }

  async test() {
    const data = await this.call({ input: 'Responda somente com a palavra OK.', maxOutputTokens: 256 });
    const text = extractOutputText(data).trim();
    if (!text) throw new Error('Gemini respondeu sem texto no teste de conexão.');
    return text;
  }

  buildEditPrompt(command, context, agentRules = '', attachments = [], approvedPlan = null) {
    const filesBlock = context.files.map(f => `\n===== FILE: ${f.path} =====\n${f.content}`).join('\n');
    const treePreview = context.treePaths.slice(0, 3000).join('\n');
    const attachmentBlock = attachments.length
      ? attachments.map(a => `- ${a.name} (${a.mimeType || 'application/octet-stream'}, ${a.size || 0} bytes)`).join('\n')
      : '(nenhum anexo)';
    const approvedPlanBlock = approvedPlan
      ? `\n\nPLANO EXPLICITAMENTE APROVADO PELO USUÁRIO\nResumo: ${approvedPlan.summary || ''}\nEtapas:\n${(approvedPlan.plan || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}\nArquivos previstos:\n${(approvedPlan.files || []).map(f => `- ${f.path}: ${f.reason || ''}`).join('\n')}\n\nREGRAS DO PLANO APROVADO\n- Execute o plano aprovado como escopo autoritativo desta tarefa.\n- Não acrescente etapas, arquivos, refatorações ou melhorias que não estejam no plano ou no pedido original.\n- Se alguma etapa do plano não puder ser executada com segurança, pare em vez de improvisar.\n`
      : '';
    return `Você é o agente de programação do Lovable Decrypter v2.0. Você trabalha EXCLUSIVAMENTE sobre o repositório GitHub fornecido pelo usuário.\n\nOBJETIVO DO USUÁRIO\n${command}${approvedPlanBlock}\n\nGUARDRAILS ABSOLUTOS DE ESCOPO\n- Faça SOMENTE o que o usuário solicitou explicitamente. Nada além disso.\n- É PROIBIDO aproveitar a tarefa para refatorar, reorganizar, renomear, formatar, limpar, modernizar, otimizar ou alterar código não solicitado.\n- Preserve integralmente comportamento, UI, estilos, textos, imports, comentários, formatação e estrutura que não sejam necessários para cumprir o pedido.\n- Se uma mudança adicional parecer boa prática mas não for indispensável ao pedido, NÃO faça.\n- Não altere dependências, configurações, rotas, banco de dados ou outros arquivos salvo quando forem estritamente necessários ao pedido explícito.\n- Anexos são somente contexto/referência. NÃO os adicione ao repositório, NÃO crie assets e NÃO altere arquivos por causa deles, exceto se o usuário pedir explicitamente.\n\nEDIÇÃO MÍNIMA OBRIGATÓRIA\n- Para action=update, NÃO devolva o arquivo inteiro em content. content deve ser string vazia.\n- Para action=update, use edits com pares search/replace. Cada search deve copiar EXATAMENTE um trecho existente do arquivo fornecido e ser o MENOR trecho que identifique unicamente a alteração.\n- Cada edit deve modificar somente as linhas indispensáveis. Não substitua funções/componentes/arquivos inteiros quando poucas linhas bastarem.\n- Não inclua linhas vizinhas desnecessárias em search/replace.\n- Para action=create, edits deve ser [] e content contém apenas o novo arquivo completo solicitado.\n- Para action=delete, somente use se a exclusão foi explicitamente solicitada; content deve ser vazio e edits deve ser [].\n- Nunca use um update para reescrever o arquivo inteiro. A extensão rejeitará patches excessivamente amplos.\n\nREGRAS TÉCNICAS\n- Não use APIs internas, tokens de sessão ou endpoints privados do Lovable.\n- Não modifique a interface da plataforma Lovable; altere apenas arquivos do repositório do projeto.\n- Não use placeholders, mocks ou pseudocódigo quando a implementação real puder ser feita.\n- Respeite o stack e padrões encontrados no repositório.\n- Valide mentalmente imports, TypeScript, build e responsividade mobile/desktop quando aplicável.\n- Não invente arquivos existentes: consulte a árvore abaixo.\n- Se o pedido puder ser atendido em um único arquivo, não toque em outros.\n\nREGRAS DO AGENTE/PERSONALIZAÇÃO\n${agentRules || '(nenhuma regra adicional cadastrada)'}\n\nBRANCH DE TRABALHO\n${context.branch}\n\nANEXOS RECEBIDOS\n${attachmentBlock}\n\nÁRVORE DO REPOSITÓRIO\n${treePreview}\n\nARQUIVOS DE CONTEXTO\n${filesBlock}\n\nRetorne somente a estrutura JSON solicitada pelo schema.`;
  }

  attachmentParts(attachments = []) {
    const parts = [];
    for (const a of attachments) {
      const mime = String(a?.mimeType || 'application/octet-stream').toLowerCase();
      const data = String(a?.data || '');
      if (!data) continue;
      let type = 'document';
      if (mime.startsWith('image/')) type = 'image';
      else if (mime.startsWith('audio/')) type = 'audio';
      else if (mime.startsWith('video/')) type = 'video';
      parts.push({ type: 'text', text: `ANEXO DE REFERÊNCIA: ${a.name || 'arquivo'} (${mime})` });
      parts.push({ type, data, mime_type: mime });
    }
    return parts;
  }

  async planCommand(command, context, agentRules = '', attachments = []) {
    if (this.backendBase) {
      const result = await this.backendCommand('plan', command, context, agentRules, attachments, null);
      result.plan = Array.isArray(result.plan) ? result.plan.map(String) : [];
      result.files = Array.isArray(result.files) ? result.files.map(file => ({
        path: assertSafeRepoPath(file.path),
        reason: String(file.reason || '')
      })) : [];
      result.warnings = Array.isArray(result.warnings) ? result.warnings.map(String) : [];
      result.summary = String(result.summary || 'Plano gerado.');
      return result;
    }
    const filesBlock = context.files.map(f => `\n===== FILE: ${f.path} =====\n${f.content}`).join('\n');
    const treePreview = context.treePaths.slice(0, 3000).join('\n');
    const attachmentBlock = attachments.length
      ? attachments.map(a => `- ${a.name} (${a.mimeType || 'application/octet-stream'}, ${a.size || 0} bytes)`).join('\n')
      : '(nenhum anexo)';
    const prompt = `Você é o agente de planejamento do Lovable Decrypter v2.0.\n\nMODO PLANEJAR\n- NÃO escreva código.\n- NÃO proponha conteúdo completo de arquivos.\n- NÃO altere GitHub, branch, banco de dados ou dependências.\n- Analise o pedido e produza somente um plano objetivo de implementação.\n- O plano deve limitar-se estritamente ao que o usuário solicitou.\n- Não inclua refatorações, melhorias, limpezas ou alterações extras.\n- Liste somente os arquivos que provavelmente precisarão ser tocados e explique por quê.\n- Preserve todo comportamento não relacionado ao pedido.\n\nPEDIDO DO USUÁRIO\n${command}\n\nREGRAS DO AGENTE\n${agentRules || '(nenhuma regra adicional cadastrada)'}\n\nANEXOS RECEBIDOS\n${attachmentBlock}\n\nBRANCH ATUAL\n${context.branch}\n\nÁRVORE DO REPOSITÓRIO\n${treePreview}\n\nARQUIVOS DE CONTEXTO\n${filesBlock}\n\nRetorne somente a estrutura JSON solicitada pelo schema.`;
    const input = attachments.length
      ? [{ type: 'text', text: prompt }, ...this.attachmentParts(attachments)]
      : prompt;
    const data = await this.call({ input, schema: PLAN_SCHEMA, model: this.model });
    const result = parseJsonOutput(data);
    result.plan = Array.isArray(result.plan) ? result.plan.map(String) : [];
    result.files = Array.isArray(result.files) ? result.files.map(file => ({
      path: assertSafeRepoPath(file.path),
      reason: String(file.reason || '')
    })) : [];
    result.warnings = Array.isArray(result.warnings) ? result.warnings.map(String) : [];
    result.summary = String(result.summary || 'Plano gerado.');
    return result;
  }

  async processCommand(command, context, agentRules = '', attachments = [], approvedPlan = null) {
    if (this.backendBase) {
      const result = await this.backendCommand('build', command, context, agentRules, attachments, approvedPlan);
      if (!Array.isArray(result.files)) result.files = [];
      result.files = result.files.map(file => ({
        path: assertSafeRepoPath(file.path),
        action: String(file.action || 'update').toLowerCase(),
        content: typeof file.content === 'string' ? file.content : '',
        edits: Array.isArray(file.edits) ? file.edits.map(edit => ({
          search: typeof edit?.search === 'string' ? edit.search : '',
          replace: typeof edit?.replace === 'string' ? edit.replace : ''
        })) : [],
        explanation: String(file.explanation || '')
      }));
      return result;
    }
    const prompt = this.buildEditPrompt(command, context, agentRules, attachments, approvedPlan);
    const input = attachments.length
      ? [{ type: 'text', text: prompt }, ...this.attachmentParts(attachments)]
      : prompt;
    const data = await this.call({ input, schema: EDIT_SCHEMA });
    const result = parseJsonOutput(data);
    if (!Array.isArray(result.files)) result.files = [];
    result.files = result.files.map(file => ({
      path: assertSafeRepoPath(file.path),
      action: String(file.action || 'update').toLowerCase(),
      content: typeof file.content === 'string' ? file.content : '',
      edits: Array.isArray(file.edits) ? file.edits.map(edit => ({
        search: typeof edit?.search === 'string' ? edit.search : '',
        replace: typeof edit?.replace === 'string' ? edit.replace : ''
      })) : [],
      explanation: String(file.explanation || '')
    }));
    return result;
  }


  async trainAgent(context) {
    const input = `Analise este repositório e gere um perfil técnico persistente para orientar futuras alterações de código.\nNão invente arquitetura: derive apenas do conteúdo fornecido.\nIdentifique stack, convenções, caminhos importantes, padrões de segurança, validações e regras que um agente deve respeitar.\n\nÁRVORE:\n${context.treePaths.slice(0, 4000).join('\n')}\n\nARQUIVOS:\n${context.files.map(f => `\n===== ${f.path} =====\n${f.content}`).join('\n')}`;
    const data = await this.call({ input, model: this.advancedModel || this.model, schema: TRAIN_SCHEMA });
    return parseJsonOutput(data);
  }
}
