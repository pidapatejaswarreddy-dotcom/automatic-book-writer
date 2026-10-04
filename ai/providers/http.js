export async function postJson(
  url,
  options = {},
  body = {},
  timeoutMs = 120000
) {
  let controller = null;
  let timer = null;

  try {
    controller = new AbortController();

    timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      method: 'POST',
      ...options,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      const error = new Error(
        `AI provider HTTP ${response.status}: ${text.slice(0, 500)}`
      );

      error.status = response.status;
      error.body = text;

      error.retryable =
        response.status === 408 ||
        response.status === 409 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;

      const retryAfter =
        response.headers.get('retry-after');

      if (retryAfter) {
        const seconds = Number(retryAfter);

        if (Number.isFinite(seconds)) {
          error.retryAfterMs =
            seconds * 1000;
        }
      }

      throw error;
    }

    if (!text.trim()) {
      const error = new Error(
        'AI provider returned an empty response'
      );

      error.retryable = true;

      throw error;
    }

    try {
      return JSON.parse(text);
    } catch (cause) {
      const error = new Error(
        'AI provider returned invalid JSON'
      );

      error.body = text.slice(0, 500);
      error.retryable = true;
      error.cause = cause;

      throw error;
    }

  } catch (error) {

    if (error?.name === 'AbortError') {
      const timeoutError = new Error(
        `AI provider request timed out after ${timeoutMs} ms`
      );

      timeoutError.code = 'ETIMEDOUT';
      timeoutError.retryable = true;

      throw timeoutError;
    }

    throw error;

  } finally {

    if (timer) {
      clearTimeout(timer);
    }
  }
}