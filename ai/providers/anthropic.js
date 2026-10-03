import { postJson } from './http.js';
export function anthropicProvider({ apiKey, model, baseUrl }) {
  return {
    name: 'anthropic',
    async complete({ system, prompt, maxTokens = 4000 }) {
      const data = await postJson(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`,
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] });
      return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    },
  };
}
