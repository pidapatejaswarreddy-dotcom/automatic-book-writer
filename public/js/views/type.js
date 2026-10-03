import { h, toast } from '../ui.js';
import { api } from '../api.js';
import { shell, go } from '../app.js';

export default async function type(root, { book, config }) {
  let sel = book.bookType;
  const draw = () => shell(root, 'type', book,
    h('div', { class: 'card' }, h('h2', {}, 'Choose Your Book Type'), h('p', { class: 'muted' }, 'The type controls how every chapter is written: its structure, examples, diagrams and exercises.'),
      h('div', { class: 'type-grid' }, config.bookTypes.map((t) => h('button', { class: 'type-card', type: 'button', 'aria-pressed': String(sel === t.id), onclick: () => { sel = t.id; draw(); } },
        h('span', { class: 'icon', 'aria-hidden': 'true' }, t.icon), h('strong', {}, t.name), h('small', {}, t.description), h('span', { class: 'flow' }, t.structure.join(' → ')))))),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/info` }, '← Back'),
      h('button', { class: 'btn primary', disabled: !sel, onclick: next }, 'Continue →')));
  async function next() {
    try {
      if (sel !== book.bookType) {
        if (book.outline && !confirm('Changing the book type discards the current outline. Continue?')) return;
        await api(`/books/${book.id}`, { method: 'PATCH', body: { bookType: sel } });
      }
      go(`/book/${book.id}/settings`);
    } catch (e) { toast(e.message, 'error'); }
  }
  draw();
}
