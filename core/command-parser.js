const RULES = [
  ['create', /\b(criar|crie|adicionar|adicione|novo|nova)\b/i],
  ['delete', /\b(remover|remova|excluir|exclua|deletar|delete)\b/i],
  ['refactor', /\b(refatorar|refatore|refactor)\b/i],
  ['fix', /\b(corrigir|corrija|arrumar|consertar|fix|bug|erro)\b/i],
  ['rename', /\b(renomear|renomeie|rename)\b/i],
  ['move', /\b(mover|mova|move)\b/i],
  ['update', /\b(atualizar|atualize|modificar|modifique|editar|edite|alterar|altere)\b/i]
];

export function parseCommand(command) {
  const text = String(command || '').trim();
  if (!text) return { action: 'unknown', confidence: 0, description: '' };
  for (const [action, rx] of RULES) if (rx.test(text)) return { action, confidence: 0.86, description: text };
  return { action: 'update', confidence: 0.55, description: text };
}
