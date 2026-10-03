import { h, clear, toast, svgUrl, ago, fmt, errorBox, debounce } from '../ui.js';
import { api, ApiError } from '../api.js';
import { coverToSvg } from '/shared/covers.js';
import { resumeStep, go } from '../app.js';

export default async function dashboard(root, { config }) {
  const list = h('div', { class: 'books' }); let q = '';
  const load = async () => {
    clear(list);
    try {
      const books = await api(`/books${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      if (!books.length) list.append(h('p', { class: 'muted' }, q ? 'No books match your search.' : 'You have not created any books yet.'));
      books.forEach((b) => list.append(card(b)));
    } catch (e) { list.append(errorBox(e.message, load)); }
  };
  const card = (b) => {
    const type = config.bookTypes.find((t) => t.id === b.bookType)?.name || 'Not chosen';
    return h('article', { class: 'card book-card' },
      h('img', { alt: '', src: svgUrl(coverToSvg(b, b.coverStyle)) }),
      h('div', { style: 'flex:1;min-width:0' },
        h('h3', { style: 'margin-bottom:4px' }, b.title), h('span', { class: `badge ${b.status}` }, b.status),
        h('p', { class: 'meta' }, `${type} · ${b.targetPages} pages · ${b.chapterCount} chapters`, h('br'), b.words ? `${fmt(b.words)} words · ` : '', `Updated ${ago(b.updatedAt)}`),
        h('div', { class: 'row' },
          h('a', { class: 'btn sm primary', href: `#/book/${b.id}/${resumeStep({ ...b, plan: b.status !== 'Draft' })}` }, ['Generated', 'Editing', 'Completed'].includes(b.status) ? 'Open' : 'Continue Editing'),
          ['Generated', 'Editing', 'Completed'].includes(b.status) && h('a', { class: 'btn sm', href: `#/book/${b.id}/download` }, 'Download'),
          h('button', { class: 'btn sm ghost', onclick: async () => { const t = prompt('Rename book', b.title); if (t?.trim()) try { await api(`/books/${b.id}`, { method: 'PATCH', body: { title: t } }); load(); } catch (e) { toast(e.message, 'error'); } } }, 'Rename'),
          h('button', { class: 'btn sm ghost danger', onclick: async () => { if (confirm(`Delete "${b.title}"? This cannot be undone.`)) try { await api(`/books/${b.id}`, { method: 'DELETE' }); toast('Book deleted', 'ok'); load(); } catch (e) { toast(e.message, 'error'); } } }, 'Delete'))));
  };
  root.append(h('h1', {}, 'My Books'),
    h('div', { class: 'toolbar' }, h('input', { type: 'search', placeholder: 'Search books', 'aria-label': 'Search books', oninput: debounce((e) => { q = e.target.value.trim(); load(); }, 250) }), h('a', { class: 'btn primary', href: '#/new' }, 'Create New Book')), list);
  await load();
}
