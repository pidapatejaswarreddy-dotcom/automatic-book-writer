// Renders content blocks (from shared/content.js) to DOM. Used by the editor preview and the book preview.
import { parseBlocks, parseInline } from '/shared/content.js';
import { diagramToSvg } from '/shared/diagram.js';
import { h, svgUrl } from './ui.js';

export const inline = (text) => parseInline(text).map((s) => (s.code ? h('code', {}, s.text) : s.bold ? h('strong', {}, s.text) : s.italic ? h('em', {}, s.text) : s.text));

export function renderBlock(b) {
  switch (b.type) {
    case 'sectionTitle': return h('h3', { class: `pv-section${b.extra ? ' extra' : ''}` }, b.text);
    case 'heading': return h('h4', {}, inline(b.text));
    case 'paragraph': return h('p', {}, inline(b.text));
    case 'bullets': return h('ul', {}, b.items.map((i) => h('li', {}, inline(i))));
    case 'numbered': return h('ol', {}, b.items.map((i) => h('li', {}, inline(i))));
    case 'code': return h('pre', { class: 'code' }, h('code', {}, b.text));
    case 'equation': return h('div', { class: 'equation' }, b.text);
    case 'quote': return h('blockquote', {}, inline(b.text));
    case 'divider': return h('div', { class: 'scene-break' }, '*   *   *');
    case 'table': return h('table', {}, b.rows.map((r, i) => h('tr', {}, r.map((c) => h(i === 0 ? 'th' : 'td', {}, inline(c))))));
    case 'figure': return h('figure', {}, h('img', { alt: b.caption, src: svgUrl(diagramToSvg(b)) }), h('figcaption', {}, b.number ? `Figure ${b.number}: ${b.caption}` : b.caption));
    case 'box': return h('aside', { class: `box box-${b.kind}` }, h('div', { class: 'box-title' }, b.title || b.kind), b.blocks.map(renderBlock));
    default: return h('div');
  }
}
export const renderMarkup = (md) => parseBlocks(md).map(renderBlock);
