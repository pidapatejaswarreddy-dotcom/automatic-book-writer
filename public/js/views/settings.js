import { h, field, toast } from '../ui.js';
import { api, ApiError } from '../api.js';
import { shell, go } from '../app.js';

export default async function settings(root, { book, config }) {
  const t = config.bookTypes.find((x) => x.id === book.bookType); const o = config.options;
  const st = { pagesSel: o.pages.includes(book.targetPages) || !book.targetPages ? String(book.targetPages || 50) : 'Custom', pagesCustom: book.targetPages || 50,
    chaptersSel: o.chapters.includes(book.targetChapters) || !book.targetChapters ? String(book.targetChapters || 6) : 'Custom', chaptersCustom: book.targetChapters || 6,
    audience: book.audience || t.defaults.audience, style: book.style || t.defaults.style, tone: book.tone || t.defaults.tone, difficulty: book.difficulty || t.defaults.difficulty };
  let errors = {}; const label = t.chapterLabel;
  const pages = () => Number(st.pagesSel === 'Custom' ? st.pagesCustom : st.pagesSel);
  const chapters = () => Number(st.chaptersSel === 'Custom' ? st.chaptersCustom : st.chaptersSel);
  const draw = () => {
    const set = (k, redraw) => (e) => { st[k] = e.target.value; if (redraw) draw(); else hint(); };
    const per = pages() / Math.max(1, chapters());
    const hintEl = h('p', { class: 'muted', id: 'ratio' }, hintText(per));
    function hint() { const el = document.getElementById('ratio'); if (el) el.textContent = hintText(pages() / Math.max(1, chapters())); }
    shell(root, 'settings', book, h('form', { class: 'card', novalidate: true, onsubmit: submit },
      h('h2', {}, 'Book Settings'), h('p', { class: 'muted' }, `Settings for a ${t.name} book. Page count is a target: the real length depends on font, margins, figures and spacing.`),
      h('div', { class: 'form-grid' },
        field({ label: 'Number of Pages', name: 'pagesSel', value: st.pagesSel, options: [...o.pages.map(String), 'Custom'], onchange: set('pagesSel', true), error: errors.targetPages }),
        st.pagesSel === 'Custom' ? field({ label: 'Enter number of pages', name: 'pagesCustom', type: 'number', value: st.pagesCustom, onchange: set('pagesCustom') }) : h('div'),
        field({ label: `Number of ${label}s`, name: 'chaptersSel', value: st.chaptersSel, options: [...o.chapters.map(String), 'Custom'], onchange: set('chaptersSel', true), error: errors.targetChapters }),
        st.chaptersSel === 'Custom' ? field({ label: `Enter number of ${label.toLowerCase()}s`, name: 'chaptersCustom', type: 'number', value: st.chaptersCustom, onchange: set('chaptersCustom') }) : h('div'),
        t.settings.audience && field({ label: 'Target Audience', name: 'audience', value: st.audience, options: o.audiences, onchange: set('audience'), error: errors.audience }),
        t.settings.style && field({ label: 'Writing Style', name: 'style', value: st.style, options: o.styles, onchange: set('style'), error: errors.style }),
        t.settings.tone && field({ label: 'Tone', name: 'tone', value: st.tone, options: o.tones, onchange: set('tone'), error: errors.tone }),
        t.settings.difficulty && field({ label: 'Difficulty Level', name: 'difficulty', value: st.difficulty, options: o.difficulties, onchange: set('difficulty'), error: errors.difficulty })),
      hintEl,
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/type` }, '← Back'), h('button', { class: 'btn primary', type: 'submit' }, 'Continue →'))));
  };
  const hintText = (per) => (per > 25 ? `About ${Math.round(per)} pages per ${label.toLowerCase()} is long; consider more ${label.toLowerCase()}s.` : per < 3 ? `Only about ${per.toFixed(1)} pages per ${label.toLowerCase()}; consider fewer ${label.toLowerCase()}s.` : `About ${Math.round(per)} pages per ${label.toLowerCase()}.`);
  async function submit(e) {
    e.preventDefault(); errors = {};
    try { await api(`/books/${book.id}`, { method: 'PATCH', body: { targetPages: pages(), targetChapters: chapters(), audience: st.audience, style: st.style, tone: st.tone, difficulty: st.difficulty } }); go(`/book/${book.id}/outline`); }
    catch (err) { if (err instanceof ApiError && Object.keys(err.details || {}).length) { errors = err.details; draw(); } toast(err.message, 'error'); }
  }
  draw();
}
