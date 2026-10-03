import { postJson } from './http.js';
// Works with OpenAI and any OpenAI-compatible endpoint (set AI_BASE_URL).
export function openaiProvider({ apiKey, model, baseUrl, reasoningEffort }) {
  return {
    name: 'openai',
    async complete({ system, prompt, maxTokens = 4000 }) {
      const data = await postJson(`${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`,
        { authorization: `Bearer ${apiKey}` },
        { model, max_tokens: maxTokens, ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] });
      return data.choices?.[0]?.message?.content || '';
    },
  };
}
