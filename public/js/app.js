import { api, ApiError } from './api.js';
import { h, clear, $, errorBox, spinner, toast } from './ui.js';

export const app = { config: null };
export const STEPS = [['info', 'Information'], ['type', 'Book Type'], ['settings', 'Settings'], ['outline', 'Outline'], ['generate', 'Generate'], ['review', 'Review'], ['preview', 'Preview'], ['download', 'Download']];
export const go = (path) => { if (location.hash === `#${path}`) route(); else location.hash = path; };

export function reachable(book, key) {
  const i = STEPS.findIndex((s) => s[0] === key); if (!book) return i === 0;
  const generated = ['Generated', 'Editing', 'Completed'].includes(book.status);
  return [true, !!book.id, !!book.bookType, !!book.targetPages, !!book.plan, generated, generated, generated][i];
}
export function resumeStep(book) {
  if (!book.bookType) return 'type'; if (!book.targetPages) return 'settings';
  if (['Generated', 'Editing', 'Completed'].includes(book.status)) return 'review';
  if (book.plan) return 'generate'; return 'outline';
}

// Wraps a wizard step in the shared layout with the progress indicator.
export function shell(root, step, book, ...content) {
  clear(root);
  const bar = h('ol', { class: 'stepper', 'aria-label': 'Progress' }, STEPS.map(([key, label], i) => {
    const cur = key === step; const idx = STEPS.findIndex((s) => s[0] === step);
    const ok = book && reachable(book, key) && !cur; const cls = cur ? 'current' : i < idx ? 'done' : '';
    const inner = [h('span', { class: 'dot' }, i < idx && !cur ? '✓' : String(i + 1)), label];
    return h('li', { class: cls, 'aria-current': cur ? 'step' : null }, ok ? h('a', { href: `#/book/${book.id}/${key}` }, inner) : h('span', {}, inner));
  }));
  root.append(bar, ...content);
}

const views = {
  home: () => import('./views/home.js'), books: () => import('./views/dashboard.js'),
  info: () => import('./views/info.js'), type: () => import('./views/type.js'), settings: () => import('./views/settings.js'),
  outline: () => import('./views/outline.js'), generate: () => import('./views/generate.js'), review: () => import('./views/review.js'),
  preview: () => import('./views/preview.js'), download: () => import('./views/download.js'),
};
let leave = [];
export const onLeave = (fn) => leave.push(fn);

export async function route() {
  leave.forEach((f) => { try { f(); } catch { /* ignore */ } }); leave = [];
  const root = $('#main'); const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let key = 'home', id = null;
  if (parts[0] === 'books') key = 'books'; else if (parts[0] === 'new') { key = 'info'; }
  else if (parts[0] === 'book' && parts[1]) { id = parts[1]; key = views[parts[2]] ? parts[2] : 'outline'; }
  clear(root).append(spinner('Loading…'));
  const banner = $('#banner'); clear(banner);
  if (app.config?.demoMode) banner.append('Demo mode: no AI key is configured, so sample content is generated. Add AI_API_KEY to write real books.');
  try {
    if (!app.config) app.config = await api('/config');
    if (app.config.demoMode && !banner.textContent) banner.append('Demo mode: no AI key is configured, so sample content is generated. Add AI_API_KEY to write real books.');
    let book = null;
    if (id) book = await api(`/books/${id}`);
    if (id && !reachable(book, key)) return go(`/book/${id}/${resumeStep(book)}`);
    const mod = await views[key]();
    clear(root); document.title = `${book ? book.title + ' · ' : ''}Automatic Book Writer`;
    await mod.default(root, { book, id, config: app.config, go });
    window.scrollTo(0, 0);
  } catch (e) {
    clear(root).append(errorBox(e instanceof ApiError ? (e.code === 'NOT_FOUND' ? 'That book could not be found.' : e.message) : 'Something went wrong while loading this page.', () => route()), h('p', {}, h('a', { href: '#/books' }, '← Back to My Books')));
    if (!(e instanceof ApiError)) console.error(e);
  }
}
window.addEventListener('hashchange', route);
route();
export { toast };
