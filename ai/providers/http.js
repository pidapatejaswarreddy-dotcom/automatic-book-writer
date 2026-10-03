// Shared fetch helper: timeout + retry with backoff. Raw provider errors never reach users.
export async function postJson(url, headers, body, { timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 120000, retries = Number(process.env.AI_MAX_RETRIES ?? 2) } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      const err = new Error(`AI provider HTTP ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status; err.retryable = res.status === 429 || res.status >= 500;
      if (!err.retryable) throw err;
      lastErr = err;
    } catch (e) {
      if (e.name === 'AbortError') { e.code = 'TIMEOUT'; e.retryable = true; }
      else if (e.retryable === undefined) e.retryable = e instanceof TypeError; // network failure
      lastErr = e;
      if (!e.retryable) throw e;
    } finally { clearTimeout(timer); }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
  }
  throw lastErr;
}
