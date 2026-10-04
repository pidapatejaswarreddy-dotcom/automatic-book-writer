import { postJson } from './http.js';

export function openaiProvider({
  apiKey,
  model,
  baseUrl,
  providerName = 'openai',
  reasoningEffort
}) {
  return {
    name: providerName,

    async complete({
      system,
      prompt,
      maxTokens = 4000
    }) {
      if (!apiKey) {
        const error = new Error(
          `${providerName} API key is missing`
        );

        error.status = 401;
        error.retryable = false;

        throw error;
      }

      if (!baseUrl) {
        const error = new Error(
          `${providerName} base URL is missing`
        );

        error.retryable = false;

        throw error;
      }

      const cleanBaseUrl =
        String(baseUrl)
          .trim()
          .replace(/\/+$/, '');

      const url =
        `${cleanBaseUrl}/chat/completions`;

      const body = {
        model,
        max_tokens:
          Number(maxTokens) || 4000,

        messages: [
          {
            role: 'system',
            content: String(system || '')
          },
          {
            role: 'user',
            content: String(prompt || '')
          }
        ]
      };

      if (reasoningEffort) {
        body.reasoning_effort =
          reasoningEffort;
      }

      const data = await postJson(
        url,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        },
        body
      );

      const content =
        data?.choices?.[0]?.message?.content;

      if (
        typeof content !== 'string' ||
        !content.trim()
      ) {
        const error = new Error(
          `${providerName} returned an empty response`
        );

        error.retryable = true;
        error.provider = providerName;

        throw error;
      }

      return content.trim();
    }
  };
}