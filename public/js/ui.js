// Tiny DOM helper: never builds HTML from strings, so user/AI text can never inject markup.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'draggable') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => { if (Array.isArray(c)) c.forEach(add); else if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

export function toast(msg, kind = 'info') {
  const box = $('#toasts'); const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg); box.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 3500);
}
export const errorBox = (msg, retry) => h('div', { class: 'error-box', role: 'alert' }, h('p', {}, msg), retry && h('button', { class: 'btn', onclick: retry }, 'Try Again'));
export const spinner = (label) => h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spin' }), h('span', {}, label));
export const svgUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const fmt = (n) => Number(n || 0).toLocaleString();
export const ago = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(iso).toLocaleDateString(); };

export function field({ label, name, value = '', type = 'text', hint, error, placeholder, required, options, onchange, id }) {
  const fid = id || `f-${name}`;
  const input = options
    ? h('select', { id: fid, name, onchange }, options.map((o) => h('option', { value: o.value ?? o, selected: (o.value ?? o) == value }, o.label ?? o)))
    : h('input', { id: fid, name, type, value, placeholder, required, autocomplete: 'off', oninput: onchange, maxlength: type === 'text' ? 300 : undefined });
  return h('div', { class: `field${error ? ' has-error' : ''}` }, h('label', { for: fid }, label, required && h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), input, hint && h('small', {}, hint), error && h('small', { class: 'err', role: 'alert' }, error));
}
