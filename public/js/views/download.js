import { h, toast, fmt, spinner, clear } from '../ui.js';
import { api, download } from '../api.js';
import { shell, go } from '../app.js';

export default async function downloadView(root, { book }) {
  const box = h('div', { class: 'card' }, spinner('Preparing your book…'));
  shell(root, 'download', book, box);
  let stats;
  try { stats = await api(`/books/${book.id}/stats`); if (book.status !== 'Completed') await api(`/books/${book.id}/complete`, { method: 'POST' }); }
  catch (e) { toast(e.message, 'error'); stats = { chapters: '—', words: 0, estimatedPages: '—' }; }
  const btn = (fmtKey, text) => h('button', { class: 'btn primary', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; const old = b.textContent; b.textContent = 'Preparing…'; try { await download(`/books/${book.id}/export/${fmtKey}`, `${book.title}.${fmtKey}`); toast(`${text} downloaded`, 'ok'); } catch (er) { toast(er.message, 'error'); } b.textContent = old; b.disabled = false; } }, text);
  clear(box).append(h('div', { class: 'done-mark', 'aria-hidden': 'true' }, '✓'), h('h2', {}, 'Book Complete'), h('h3', {}, book.title), book.subtitle ? h('p', { class: 'muted' }, book.subtitle) : null,
    h('div', { class: 'summary-grid' }, h('div', {}, h('b', {}, stats.chapters), 'Chapters'), h('div', {}, h('b', {}, stats.estimatedPages), 'Estimated pages'), h('div', {}, h('b', {}, fmt(stats.words)), 'Words')),
    h('div', { class: 'dl-row' }, h('a', { class: 'btn', href: `#/book/${book.id}/preview` }, 'Preview Book')),
    h('h3', {}, 'Download As'), h('div', { class: 'dl-row' }, btn('pdf', 'PDF'), btn('docx', 'DOCX'), btn('txt', 'TXT')),
    h('p', { class: 'muted' }, 'PDF is print-ready (6 × 9 in). DOCX is editable in Word. The table of contents page numbers follow the PDF layout.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/review` }, '← Keep Editing'), h('a', { class: 'btn gold', href: '#/new' }, 'Create Another Book')));
}
