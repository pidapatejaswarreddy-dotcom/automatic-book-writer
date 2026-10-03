import { h, clear, toast, errorBox, fmt } from '../ui.js';
import { api } from '../api.js';
import { shell, go, onLeave } from '../app.js';

export default async function generate(root, { book, config }) {
  let timer; let stopping = false;
  onLeave(() => clearInterval(timer));
  const t = config.bookTypes.find((x) => x.id === book.bookType);
  const started = () => book.generation.state !== 'idle';

  const planView = () => {
    const p = book.plan; const r = p.reserved; const front = Object.values(r).reduce((a, b) => a + b, 0);
    return h('div', { class: 'card' }, h('h2', {}, 'Content Plan'),
      h('p', { class: 'muted' }, `Target: ${book.targetPages} pages. ${front} page(s) are reserved for the cover, title page${r.copyright ? ', copyright page' : ''} and table of contents; the remaining ${p.usablePages} are distributed across the chapters (about ${p.wordsPerPage} words per page for this book type).`),
      h('div', { style: 'overflow-x:auto' }, h('table', { class: 'plan' }, h('thead', {}, h('tr', {}, ['Chapter', 'Pages', 'Words', 'Sections', 'Examples', 'Diagrams', 'Exercises'].map((c, i) => h('th', { class: i ? 'n' : '' }, c)))),
        h('tbody', {}, p.chapters.map((c) => h('tr', {}, h('td', {}, c.number ? `${t.chapterLabel} ${c.number}: ${c.title}` : c.title), ...[`~${c.targetPages}`, fmt(c.targetWords), c.sections.length, c.examples, c.diagrams, c.exercises].map((v) => h('td', { class: 'n' }, v))))))),
      p.notes.length ? h('ul', { class: 'muted' }, p.notes.map((n) => h('li', {}, n))) : null);
  };

  const progressView = () => {
    const g = book.generation; const pct = Math.round((g.progress || 0) * 100);
    const icon = { done: '✓', active: '⟳', pending: '○', error: '✕' };
    const running = g.state === 'running';
    return h('div', { class: 'card' }, h('h2', {}, running ? 'Generating Your Book…' : g.state === 'done' ? 'Your Book Is Ready' : g.state === 'error' ? 'Generation Stopped' : 'Generation Paused'),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${pct}%` })),
      h('p', { class: 'muted' }, running ? 'Writing chapter by chapter. You can leave this page; progress is saved after every section.' : g.state === 'done' ? 'Every chapter was written and checked. Approval needed: please review the book before downloading.' : ''),
      g.error ? errorBox(g.error, resume) : null,
      h('ul', { class: 'gen-list' }, g.steps.map((s) => h('li', { class: s.status }, h('span', { class: 'ic', 'aria-hidden': 'true' }, icon[s.status]), s.label))));
  };

  async function resume() { try { book = await api(`/books/${book.id}/generate`, { method: 'POST' }); stopping = false; paint(); poll(); } catch (e) { toast(e.message, 'error'); } }
  async function stop() { stopping = true; try { await api(`/books/${book.id}/generate/stop`, { method: 'POST' }); toast('Stopping after the current section…'); paint(); } catch (e) { toast(e.message, 'error'); } }
  function poll() {
    clearInterval(timer);
    timer = setInterval(async () => {
      try { book = await api(`/books/${book.id}`); paint(); if (book.generation.state !== 'running') clearInterval(timer); } catch { /* keep trying; network may be briefly down */ }
    }, 1500);
  }

  function paint() {
    const g = book.generation; const s = g.state;
    const buttons = s === 'idle' ? [h('a', { class: 'btn', href: `#/book/${book.id}/outline` }, '← Back to Outline'), h('button', { class: 'btn gold', onclick: resume }, 'Generate Book')]
      : s === 'running' ? [h('span'), h('button', { class: 'btn', disabled: stopping, onclick: stop }, stopping ? 'Stopping…' : 'Stop')]
      : s === 'done' ? [h('span'), h('a', { class: 'btn primary', href: `#/book/${book.id}/review` }, 'Review Book →')]
      : [h('span'), h('button', { class: 'btn gold', onclick: resume }, s === 'error' ? 'Try Again' : 'Resume')];
    shell(root, 'generate', book, started() ? progressView() : planView(), h('div', { class: 'actions' }, ...buttons));
  }
  paint();
  if (book.generation.state === 'running') poll();
}
