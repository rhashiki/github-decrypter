export function extractOutputText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.outputs)) {
    return data.outputs.map(o => o?.text || o?.content?.map?.(c => c?.text || '').join('') || '').join('\n').trim();
  }
  if (Array.isArray(data.steps)) {
    const texts = [];
    for (const step of data.steps) {
      if (typeof step?.text === 'string') texts.push(step.text);
      if (Array.isArray(step?.content)) for (const c of step.content) if (c?.text) texts.push(c.text);
    }
    return texts.join('\n').trim();
  }
  return '';
}

export function parseJsonOutput(data) {
  const text = extractOutputText(data).trim();
  if (!text) throw new Error('Gemini não retornou conteúdo utilizável.');
  try { return JSON.parse(text); } catch (_) {}
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(unfenced); } catch (_) {}
  const start = unfenced.indexOf('{'), end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch (_) {}
  }
  throw new Error('Resposta da IA não pôde ser interpretada como JSON estruturado.');
}
