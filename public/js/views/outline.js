import { h, clear, toast, errorBox, spinner } from '../ui.js';
import { api } from '../api.js';
import { shell, go } from '../app.js';

const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export default async function outline(root, { book, config }) {
  const t = config.bookTypes.find((x) => x.id === book.bookType); const label = t.chapterLabel;
  let ol = null; let dragId = null;
  const build = async (regen) => {
    shell(root, 'outline', book, h('div', { class: 'card' }, spinner(book.analysis && !regen ? 'Creating your outline…' : 'Analyzing your topic and creating an outline… this can take a moment')));
    try { book = await api(`/books/${book.id}/outline`, { method: 'POST' }); draw(); }
    catch (e) { shell(root, 'outline', book, errorBox('Something went wrong while creating the outline. ' + (e.code === 'AI_FAILED' ? '' : e.message), () => build(regen)), h('a', { class: 'btn', href: `#/book/${book.id}/settings` }, '← Back')); }
  };
  if (!book.outline) return build(false);
  ol = structuredClone(book.outline);

  function draw() {
    ol = structuredClone(book.outline); paint();
  }
  function paint() {
    const locked = book.chapters?.some((c) => c.sections.some((s) => s.content));
    const a = book.analysis;
    const list = (title, arr) => arr?.length ? h('div', {}, h('h4', {}, title), h('ul', {}, arr.slice(0, 6).map((x) => h('li', {}, typeof x === 'string' ? x : x.name)))) : null;
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= ol.chapters.length) return; [ol.chapters[i], ol.chapters[j]] = [ol.chapters[j], ol.chapters[i]]; paint(); };
    const chapterEl = (c, i) => h('div', { class: 'o-ch', draggable: true, 'data-id': c.id,
      ondragstart: (e) => { dragId = c.id; e.dataTransfer.effectAllowed = 'move'; }, ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }, ondragleave: (e) => e.currentTarget.classList.remove('dragover'),
      ondrop: (e) => { e.preventDefault(); const from = ol.chapters.findIndex((x) => x.id === dragId); if (from < 0 || dragId === c.id) return paint(); const [m] = ol.chapters.splice(from, 1); ol.chapters.splice(ol.chapters.findIndex((x) => x.id === c.id), 0, m); paint(); } },
      h('div', { class: 'o-head' }, h('span', { class: 'grip', title: 'Drag to reorder', 'aria-hidden': 'true' }, '⠿'), h('span', { class: 'num' }, i + 1),
        h('input', { value: c.title, 'aria-label': `${label} ${i + 1} title`, oninput: (e) => { c.title = e.target.value; } }),
        h('button', { class: 'iconbtn', title: 'Move up', 'aria-label': 'Move up', onclick: () => move(i, -1) }, '↑'), h('button', { class: 'iconbtn', title: 'Move down', 'aria-label': 'Move down', onclick: () => move(i, 1) }, '↓'),
        h('button', { class: 'iconbtn', title: `Delete ${label.toLowerCase()}`, 'aria-label': 'Delete chapter', onclick: () => { if (ol.chapters.length > 1) { ol.chapters.splice(i, 1); paint(); } else toast('An outline needs at least one chapter.', 'error'); } }, '✕')),
      h('div', { class: 'o-secs' }, c.sections.map((s, si) => h('div', { class: 'o-sec' }, h('span', { class: 'muted' }, `${i + 1}.${si + 1}`),
        h('input', { value: s.title, 'aria-label': 'Section title', oninput: (e) => { s.title = e.target.value; } }),
        h('button', { class: 'iconbtn', 'aria-label': 'Delete section', onclick: () => { if (c.sections.length > 1) { c.sections.splice(si, 1); paint(); } } }, '✕'))),
        h('div', {}, h('button', { class: 'btn sm ghost', onclick: () => { c.sections.push({ id: rid('s'), title: 'New section' }); paint(); } }, '+ Add Section'))));
    const fixed = (o) => o && h('div', { class: 'o-ch fixed' }, h('div', { class: 'o-head' }, h('span', { class: 'num' }, ''), h('input', { value: o.title, 'aria-label': 'Title', oninput: (e) => { o.title = e.target.value; } })));
    shell(root, 'outline', book,
      h('div', { class: 'card' }, h('h2', {}, 'Topic Analysis'), h('div', { class: 'analysis' }, list('Important concepts', a?.importantConcepts), list('Subtopics', a?.subtopics), list('Applications', a?.applications), list('Potential diagrams', a?.potentialDiagrams), list('Potential calculations', a?.potentialCalculations), list('Characters', a?.characters))),
      h('div', { style: 'height:16px' }),
      h('div', { class: 'card' }, h('h2', {}, `Outline: ${book.title}`), h('p', { class: 'muted' }, `Review and edit the outline. Nothing is written until you approve it. Drag ${label.toLowerCase()}s or use the arrows to reorder.`),
        locked ? h('p', { class: 'error-box' }, 'This book already has written content, so the outline can no longer be changed here. Edit chapters in the Review step.') : null,
        h('div', { class: 'outline' }, fixed(ol.intro), ol.chapters.map(chapterEl), fixed(ol.outro), ol.references && h('div', { class: 'o-ch fixed muted' }, h('div', { class: 'o-head' }, h('span', { class: 'num' }), 'References'))),
        h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn', disabled: locked, onclick: () => { ol.chapters.push({ id: rid('o'), title: `New ${label}`, sections: [{ id: rid('s'), title: 'Overview' }, { id: rid('s'), title: 'Key ideas' }] }); paint(); } }, `+ Add ${label}`))),
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/settings` }, '← Back'),
        h('div', { class: 'right' }, h('button', { class: 'btn', disabled: locked, onclick: () => { if (confirm('Regenerate the outline? Your edits will be replaced.')) build(true); } }, 'Regenerate Outline'),
          h('button', { class: 'btn', disabled: locked, onclick: save }, 'Save Outline'), h('button', { class: 'btn primary', onclick: approve }, 'Approve & Continue →'))));
  }
  async function save() { try { book = await api(`/books/${book.id}/outline`, { method: 'PUT', body: ol }); toast('Outline saved', 'ok'); } catch (e) { toast(e.message, 'error'); } }
  async function approve() {
    try { if (book.chapters?.some((c) => c.sections.some((s) => s.content))) return go(`/book/${book.id}/generate`); await api(`/books/${book.id}/approve`, { method: 'POST', body: ol }); go(`/book/${book.id}/generate`); } catch (e) { toast(e.message, 'error'); }
  }
  paint();
}
