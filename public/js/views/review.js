import { h, clear, toast, field, svgUrl, debounce, errorBox, spinner, $ } from '../ui.js';
import { api } from '../api.js';
import { shell } from '../app.js';
import { renderMarkup } from '../render.js';
import { COVER_STYLES, coverToSvg } from '/shared/covers.js';
import { countWords } from '/shared/content.js';

const ACTIONS = [['improve', 'Improve'], ['rewrite', 'Rewrite'], ['expand', 'Expand'], ['shorten', 'Shorten'], ['simplify', 'Simplify'], ['professional', 'Make Professional'], ['grammar', 'Fix Grammar'], ['regenerate', 'Regenerate Section']];

export default async function review(root, { book, config }) {
  let view = location.hash.includes('?c=') ? location.hash.split('?c=')[1] : 'check'; let focusSection = null; let stats = null;
  const t = config.bookTypes.find((x) => x.id === book.bookType); const label = t.chapterLabel;
  const open = (v, sec) => { view = v; focusSection = sec || null; paint(); };
  const openIssues = () => (book.issues || []).filter((i) => i.status === 'open');

  function sidebar() {
    const item = (key, text) => h('button', { type: 'button', 'aria-current': String(view === key), onclick: () => open(key) }, text);
    const n = openIssues().length;
    return h('nav', { class: 'card side', 'aria-label': 'Book sections' }, h('div', { class: 'grp' }, 'Book'), item('check', `Content Check${n ? ` (${n})` : ' ✓'}`), item('cover', 'Cover'), item('title', 'Title Page'), item('toc', 'Table of Contents'),
      h('div', { class: 'grp' }, 'Contents'), book.chapters.map((c) => item(c.id, c.number ? `${label} ${c.number}: ${c.title}` : c.title)));
  }

  function main() {
    if (view === 'check') return checkPanel();
    if (view === 'cover') return coverPanel();
    if (view === 'title') return titlePanel();
    if (view === 'toc') return tocPanel();
    const c = book.chapters.find((x) => x.id === view); return c ? chapterPanel(c) : checkPanel();
  }

  // ---------- content check ----------
  function checkPanel() {
    const issues = book.issues || []; const open_ = issues.filter((i) => i.status === 'open'); const cnt = (s) => issues.filter((i) => i.status === s).length;
    const run = async () => { try { book.issues = (await api(`/books/${book.id}/validate`, { method: 'POST' })).issues; paint(); } catch (e) { toast(e.message, 'error'); } };
    const act = async (id, what) => { try { book.issues = (await api(`/books/${book.id}/issues/${id}/${what}`, { method: 'POST' })).issues; if (what === 'fix') book = await api(`/books/${book.id}`); paint(); } catch (e) { toast(e.message, 'error'); } };
    return h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Content Check'),
      h('p', { class: 'muted' }, 'Grammar, spelling, repetition, chapter consistency, topic relevance, outline coverage, missing sections, broken references and formatting' + (book.bookType === 'technical' ? ', plus code blocks and terminology' : '') + (['novel', 'short-stories'].includes(book.bookType) ? ', plus character, location and plot continuity' : '') + '.'),
      h('div', { class: 'toolbar' }, h('span', { class: 'badge' }, `${open_.length} open`), h('span', { class: 'badge Completed' }, `${cnt('fixed')} fixed`), h('span', { class: 'badge' }, `${cnt('ignored')} ignored`),
        h('button', { class: 'btn sm', onclick: run }, 'Re-run Checks'), open_.some((i) => i.fix && i.fix.type !== 'regenerate') && h('button', { class: 'btn sm primary', onclick: async () => { try { book.issues = (await api(`/books/${book.id}/issues/fix-all`, { method: 'POST' })).issues; book = await api(`/books/${book.id}`); toast('Fixed what could be fixed automatically', 'ok'); paint(); } catch (e) { toast(e.message, 'error'); } } }, 'Fix All Automatically')),
      !open_.length ? h('p', {}, '✓ No open issues. Your book is ready to preview.') : null),
      h('div', { style: 'height:12px' }), issues.filter((i) => i.status !== 'fixed').map((i) => h('div', { class: `issue ${i.severity} ${i.status}` },
        h('div', {}, h('div', { class: 'cat' }, `${i.category} · ${i.location || ''}`), h('div', {}, i.message)),
        i.status === 'open' ? h('div', { class: 'row', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' },
          i.fix && h('button', { class: 'btn sm primary', onclick: () => act(i.id, 'fix') }, 'Fix Automatically'),
          h('button', { class: 'btn sm', onclick: () => open(i.chapterId, i.sectionId) }, 'Review Manually'), h('button', { class: 'btn sm ghost', onclick: () => act(i.id, 'ignore') }, 'Ignore')) : h('span', { class: 'muted' }, 'Ignored'))));
  }

  // ---------- cover / title / toc ----------
  function coverPanel() {
    return h('div', { class: 'card' }, h('h2', {}, 'Cover'), h('p', { class: 'muted' }, 'Choose a cover style. The cover uses your title, subtitle and author.'),
      h('div', { class: 'cover-pick' }, COVER_STYLES.map((s) => h('button', { type: 'button', 'aria-pressed': String(book.coverStyle === s.id), 'aria-label': `${s.name} cover`, onclick: async () => { try { book = await api(`/books/${book.id}`, { method: 'PATCH', body: { coverStyle: s.id } }); paint(); } catch (e) { toast(e.message, 'error'); } } }, h('img', { alt: s.name, src: svgUrl(coverToSvg(book, s.id)) })))));
  }
  function titlePanel() {
    const v = { title: book.title, subtitle: book.subtitle || '', author: book.author, copyright: book.copyright || `© ${new Date().getFullYear()} ${book.author}. All rights reserved.` };
    const bind = (k) => (e) => { v[k] = e.target.value; };
    return h('form', { class: 'card', onsubmit: async (e) => { e.preventDefault(); try { book = await api(`/books/${book.id}`, { method: 'PATCH', body: { ...v } }); toast('Saved', 'ok'); paint(); } catch (er) { toast(er.message, 'error'); } } },
      h('h2', {}, 'Title Page'), h('div', { class: 'form-grid' }, field({ label: 'Title', name: 'title', value: v.title, onchange: bind('title'), required: true }), field({ label: 'Subtitle', name: 'subtitle', value: v.subtitle, onchange: bind('subtitle') }), field({ label: 'Author', name: 'author', value: v.author, onchange: bind('author'), required: true }),
        field({ label: 'Copyright line (optional)', name: 'copyright', value: v.copyright, onchange: bind('copyright') })), h('div', { class: 'actions' }, h('span'), h('button', { class: 'btn primary', type: 'submit' }, 'Save Changes')));
  }
  function tocPanel() {
    const box = h('div', { class: 'card' }, h('h2', {}, 'Table of Contents'), spinner('Calculating page numbers…'));
    api(`/books/${book.id}/stats`).then((s) => { stats = s; clear(box).append(h('h2', {}, 'Table of Contents'), h('p', { class: 'muted' }, 'Generated automatically from your chapters. Page numbers come from the PDF layout.'),
      ...book.chapters.map((c) => h('div', { class: 'pv-toc-row', style: 'font-size:1rem' }, h('span', {}, c.number ? `${label} ${c.number}: ${c.title}` : c.title), h('span', { class: 'dots' }), h('span', {}, String(s.chapterPages?.[c.id] || ''))))); }).catch((e) => clear(box).append(errorBox(e.message)));
    return box;
  }

  // ---------- chapter editor ----------
  function chapterPanel(c) {
    const wrap = h('div', {});
    wrap.append(h('div', { class: 'card sec-card' }, h('div', { class: 'field' }, h('label', { for: 'ch-title' }, c.number ? `${label} ${c.number} title` : 'Title'),
      h('input', { id: 'ch-title', value: c.title, onchange: async (e) => { try { book = await api(`/books/${book.id}/chapters/${c.id}`, { method: 'PUT', body: { title: e.target.value } }); toast('Renamed', 'ok'); paint(); } catch (er) { toast(er.message, 'error'); } } })),
      h('p', { class: 'muted' }, 'Edit text directly. Formatting: **bold**, *italic*, ### sub-heading, - bullets, ```code```, $$formula$$, [[FIGURE: flowchart | Caption | Step 1; Step 2; Step 3]].')));
    c.sections.forEach((s) => wrap.append(sectionCard(c, s)));
    return wrap;
  }
  function sectionCard(c, s) {
    let undo = null; let last = s.content || '';
    const status = h('span', { class: 'saved' }, `${countWords(s.content)} words`);
    const ta = h('textarea', { id: `sec-${s.id}`, 'aria-label': `Content of ${s.title}`, spellcheck: 'true' }); ta.value = s.content || '';
    const formatted = h('div', { class: 'formatted', hidden: true });
    const save = async (body) => { status.textContent = 'Saving…'; try { const nb = await api(`/books/${book.id}/chapters/${c.id}/sections/${s.id}`, { method: 'PUT', body }); book = nb; last = ta.value; s.content = ta.value; status.textContent = `Saved ✓ · ${countWords(ta.value)} words`; if (!formatted.hidden) showFormatted(); } catch (e) { status.textContent = 'Not saved'; toast(e.message, 'error'); } };
    const autosave = debounce(() => save({ content: ta.value }), 900);
    ta.addEventListener('input', () => { status.textContent = 'Editing…'; autosave(); });
    const showFormatted = () => { clear(formatted).append(...renderMarkup(ta.value)); };
    const undoBtn = h('button', { class: 'btn sm ghost', hidden: true, onclick: () => { ta.value = undo; undoBtn.hidden = true; save({ content: undo }); } }, 'Undo');
    const bar = h('div', { class: 'bar' }, ACTIONS.map(([a, text]) => h('button', { class: 'btn sm', type: 'button', onclick: async (e) => {
      if (a === 'regenerate' && !confirm('Replace this section with a newly generated version?')) return;
      const btn = e.currentTarget; btn.disabled = true; status.textContent = `${text}…`;
      try { const r = await api(`/books/${book.id}/chapters/${c.id}/sections/${s.id}/improve`, { method: 'POST', body: { action: a, text: ta.value } }); undo = ta.value; undoBtn.hidden = false; ta.value = r.content; await save({ content: r.content }); }
      catch (er) { status.textContent = ''; toast(er.message, 'error'); } btn.disabled = false; } }, text)), undoBtn);
    const card = h('div', { class: 'card sec-card', id: `card-${s.id}` },
      h('div', { class: 'sec-head' }, h('input', { value: s.title, 'aria-label': 'Section title', onchange: (e) => save({ title: e.target.value }) }), status),
      bar, ta, h('label', { class: 'muted', style: 'display:block;margin-top:8px' }, h('input', { type: 'checkbox', style: 'width:auto', onchange: (e) => { formatted.hidden = !e.target.checked; if (e.target.checked) showFormatted(); } }), ' Show formatted preview'), formatted);
    if (focusSection === s.id) setTimeout(() => { card.scrollIntoView({ block: 'center' }); ta.focus(); }, 50);
    return card;
  }

  function paint() {
    const c = h('div', { class: 'review' }, sidebar(), h('div', {}, main()));
    shell(root, 'review', book, c, h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/generate` }, '← Back'), h('a', { class: 'btn primary', href: `#/book/${book.id}/preview` }, 'Preview →')));
  }
  paint();
}
