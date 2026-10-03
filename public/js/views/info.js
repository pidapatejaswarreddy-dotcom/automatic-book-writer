import { h, field, toast, $ } from '../ui.js';
import { api, ApiError } from '../api.js';
import { shell, go } from '../app.js';

export default async function info(root, { book, config }) {
  const v = { topic: book?.topic || '', title: book?.title || '', subtitle: book?.subtitle || '', author: book?.author || '', language: book?.language || 'English' };
  let errors = {}; let busy = false;
  const draw = () => {
    const bind = (k) => (e) => { v[k] = e.target.value; };
    const f = h('form', { class: 'card', novalidate: true, onsubmit: submit },
      h('h2', {}, 'Book Information'),
      h('div', { class: 'form-grid' },
        h('div', { class: 'full' }, field({ label: 'Topic', name: 'topic', value: v.topic, placeholder: 'Solar Energy', required: true, error: errors.topic, hint: 'What is the book about?', onchange: bind('topic') })),
        h('div', { class: 'full field' + (errors.title ? ' has-error' : '') },
          h('label', { for: 'f-title' }, 'Book Title', h('span', { class: 'req' }, ' *')),
          h('div', { class: 'inline' }, h('input', { id: 'f-title', name: 'title', value: v.title, placeholder: 'Solar Energy for Beginners', oninput: bind('title') }),
            h('button', { type: 'button', class: 'btn', disabled: busy, onclick: suggest }, busy ? 'Thinking…' : 'Generate Title with AI')),
          h('small', {}, 'Type your own or let AI suggest one.'), errors.title && h('small', { class: 'err' }, errors.title)),
        field({ label: 'Subtitle (optional)', name: 'subtitle', value: v.subtitle, onchange: bind('subtitle') }),
        field({ label: 'Author Name', name: 'author', value: v.author, placeholder: 'John Kumar', required: true, error: errors.author, onchange: bind('author') }),
        field({ label: 'Language', name: 'language', value: v.language, options: config.languages.map((l) => ({ value: l.name, label: `${l.name} — ${l.native}` })), error: errors.language, onchange: bind('language') })),
      config.demoMode && v.language !== 'English' ? h('p', { class: 'muted' }, 'Demo mode writes sample text in English. Connect an AI provider to write in this language.') : null,
      h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: '#/books' }, 'Cancel'), h('button', { class: 'btn primary', type: 'submit', disabled: busy }, 'Continue →')));
    shell(root, 'info', book, f);
  };
  async function suggest() {
    if (!v.topic.trim()) { errors = { topic: 'Enter a topic first.' }; return draw(); }
    busy = true; draw();
    try { const t = await api('/ai/title', { method: 'POST', body: { topic: v.topic, language: v.language, bookType: book?.bookType } }); v.title = t.title; if (!v.subtitle) v.subtitle = t.subtitle || ''; errors = {}; }
    catch (e) { toast(e.message, 'error'); }
    busy = false; draw();
  }
  async function submit(e) {
    e.preventDefault(); errors = {};
    try {
      const saved = book ? await api(`/books/${book.id}`, { method: 'PATCH', body: v }) : await api('/books', { method: 'POST', body: v });
      go(`/book/${saved.id}/type`);
    } catch (err) { if (err instanceof ApiError && err.details) { errors = err.details; draw(); toast(err.message, 'error'); } else toast(err.message, 'error'); }
  }
  draw();
}
