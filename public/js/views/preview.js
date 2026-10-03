import { h, clear, errorBox, spinner, svgUrl, toast } from '../ui.js';
import { api } from '../api.js';
import { shell, onLeave } from '../app.js';
import { renderBlock, renderMarkup } from '../render.js';
import { coverToSvg } from '/shared/covers.js';

const PAGE_W = 432;

export default async function preview(root, { book }) {
  shell(root, 'preview', book, h('div', { class: 'card' }, spinner('Laying out your book…')));
  let model; try { model = await api(`/books/${book.id}/model`); } catch (e) { return shell(root, 'preview', book, errorBox(e.message)); }
  // Paginate in a hidden, layout-active container so the preview shows real page breaks.
  const measure = h('div', { class: 'pv-measure' }); document.body.append(measure); onLeave(() => measure.remove());
  await new Promise((r) => requestAnimationFrame(r));

  const newPage = (kind, run) => { const inner = h('div', { class: 'pv-inner' }); const page = h('div', { class: 'pv-page', 'data-kind': kind }, run ? h('div', { class: 'pv-run' }, run) : null, inner); measure.append(page); return { page, inner, kind }; };
  const overflows = (p) => p.inner.scrollHeight > p.inner.clientHeight + 1;

  function build(tocPages) {
    clear(measure); const pages = []; const starts = {};
    const cover = newPage('cover'); cover.page.replaceChildren(h('div', { class: 'pv-cover' }, h('img', { alt: 'Book cover', src: svgUrl(coverToSvg(model, model.cover.id)) }))); pages.push(cover);
    const tp = newPage('title'); tp.inner.append(h('div', { style: 'margin-top:150px;text-align:center' }, h('h2', { style: 'font:700 24px system-ui;color:#14213d' }, model.title), model.subtitle ? h('p', { style: 'text-align:center;font-style:italic;font-size:14px' }, model.subtitle) : null, h('p', { style: 'text-align:center;font-size:14px;margin-top:30px' }, model.author))); pages.push(tp);
    if (model.showCopyright) { const cp = newPage('copyright'); cp.inner.append(h('p', { style: 'position:absolute;bottom:80px;font-size:8.5px;color:#555' }, model.copyright)); pages.push(cp); }
    let toc = newPage('toc'); toc.inner.append(h('h2', { style: 'font:700 20px system-ui;color:#14213d;margin:20px 0 18px' }, 'Table of Contents')); pages.push(toc);
    model.toc.forEach((t) => { const row = h('div', { class: 'pv-toc-row' }, h('span', {}, t.text), h('span', { class: 'dots' }), h('span', {}, String(tocPages?.[t.id] || ''))); toc.inner.append(row); if (overflows(toc)) { row.remove(); toc = newPage('toc'); toc.inner.append(row); pages.push(toc); } });
    model.chapters.forEach((c) => {
      let cur = newPage('body', c.title); pages.push(cur); starts[c.id] = pages.length;
      cur.page.querySelector('.pv-run')?.remove();
      cur.inner.append(h('div', { class: 'pv-chapter-title' }, c.label ? h('div', { class: 'lab' }, c.label) : null, h('h2', {}, c.title), h('hr')));
      const next = () => { cur = newPage('body', c.title); pages.push(cur); return cur; };
      const place = (block) => {
        const el = renderBlock(block); cur.inner.append(el);
        if (!overflows(cur)) return;
        el.remove();
        if (block.type === 'paragraph' && block.text.length > 200) {
          const words = block.text.replace(/\*\*|`|(?<![\w*])\*(?=\S)|(?<=\S)\*(?![\w*])/g, '').split(/\s+/); let rest = words;
          while (rest.length) {
            let lo = 0, hi = rest.length; const p = renderBlock({ type: 'paragraph', text: '' }); cur.inner.append(p);
            while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); p.textContent = rest.slice(0, mid).join(' '); if (overflows(cur)) hi = mid - 1; else lo = mid; }
            if (lo === 0) { p.remove(); if (cur.inner.children.length === 0) { p.textContent = rest.join(' '); cur.inner.append(p); break; } next(); continue; }
            p.textContent = rest.slice(0, lo).join(' '); rest = rest.slice(lo); if (rest.length) next();
          }
        } else if (block.type === 'bullets' || block.type === 'numbered') { block.items.forEach((it) => place({ type: block.type, items: [it] })); }
        else { if (cur.inner.children.length) next(); cur.inner.append(el); }
      };
      c.blocks.forEach(place);
    });
    pages.forEach((p, i) => { if (p.kind !== 'cover' && p.kind !== 'title' && p.kind !== 'copyright' && p.kind !== 'toc') { p.page.append(h('div', { class: 'pv-num' }, String(i + 1))); } });
    return { pages, starts };
  }
  const first = build(null); const { pages, starts } = build(Object.fromEntries(Object.entries(first.starts))); // second pass fills TOC numbers
  measure.remove();

  let idx = 0; let zoom = 1;
  const stage = h('div', { class: 'pv-stage' }); const label = h('span', { 'aria-live': 'polite' });
  const sel = h('select', { 'aria-label': 'Jump to chapter', onchange: (e) => { idx = Number(e.target.value) - 1; show(); } }, h('option', { value: 1 }, 'Cover'), model.chapters.map((c) => h('option', { value: starts[c.id] }, c.label ? `${c.label}: ${c.title}` : c.title)));
  function show() {
    idx = Math.max(0, Math.min(pages.length - 1, idx)); const p = pages[idx].page; p.style.transform = `scale(${zoom})`; p.style.marginBottom = `${(zoom - 1) * 648}px`; p.style.marginRight = `${(zoom - 1) * PAGE_W / 2}px`;
    clear(stage).append(p); label.textContent = `Page ${idx + 1} of ${pages.length}`; prev.disabled = idx === 0; nextB.disabled = idx === pages.length - 1;
    const ch = [...model.chapters].reverse().find((c) => starts[c.id] <= idx + 1); sel.value = ch ? starts[ch.id] : 1;
  }
  const prev = h('button', { class: 'btn sm', onclick: () => { idx--; show(); } }, '← Previous Page'); const nextB = h('button', { class: 'btn sm', onclick: () => { idx++; show(); } }, 'Next Page →');
  const zoomTo = (z) => { zoom = Math.max(0.6, Math.min(2, z)); show(); };
  const key = (e) => { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; if (e.key === 'ArrowRight') { idx++; show(); } if (e.key === 'ArrowLeft') { idx--; show(); } };
  document.addEventListener('keydown', key); onLeave(() => document.removeEventListener('keydown', key));
  shell(root, 'preview', book,
    h('div', { class: 'pv-toolbar' }, prev, label, nextB, h('button', { class: 'btn sm', 'aria-label': 'Zoom out', onclick: () => zoomTo(zoom - 0.15) }, '−'), h('button', { class: 'btn sm', 'aria-label': 'Zoom in', onclick: () => zoomTo(zoom + 0.15) }, '+'), sel),
    stage, h('p', { class: 'muted', style: 'text-align:center' }, 'This preview approximates the printed layout. PDF and DOCX page breaks may differ slightly.'),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `#/book/${book.id}/review` }, '← Back to Review'), h('a', { class: 'btn primary', href: `#/book/${book.id}/download` }, 'Continue to Download →')));
  show();
}
