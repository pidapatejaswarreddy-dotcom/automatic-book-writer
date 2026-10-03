export class ApiError extends Error { constructor(message, details, code) { super(message); this.details = details || {}; this.code = code; } }

export async function api(path, { method = 'GET', body, raw } = {}) {
  let res;
  try { res = await fetch(`/api${path}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', {}, 'NETWORK'); }
  if (res.status === 204) return null;
  if (!res.ok) {
    let e = {}; try { e = (await res.json()).error || {}; } catch { /* non-JSON error */ }
    throw new ApiError(e.message || 'Something went wrong. Please try again.', e.details, e.code);
  }
  return raw ? res : res.json();
}

export async function download(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
