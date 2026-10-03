import { stripInline } from '../shared/content.js';
import { diagramToAscii } from '../shared/diagram.js';
import { buildBookModel } from './model.js';

const wrap = (text, width = 80, indent = '') => {
  const out = []; let line = indent;
  for (const w of text.split(/\s+/)) { if ((line + ' ' + w).trim().length > width && line.trim()) { out.push(line); line = indent + w; } else line = line.trim() ? `${line} ${w}` : indent + w; }
  if (line.trim()) out.push(line); return out;
};
const center = (s, w = 80) => ' '.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;

function renderBlocks(blocks, out, indent = '') {
  for (const b of blocks) {
    if (b.type === 'sectionTitle') { out.push('', b.text, '-'.repeat(Math.min(72, [...b.text].length)), ''); }
    else if (b.type === 'heading') out.push('', indent + stripInline(b.text).toUpperCase(), '');
    else if (b.type === 'paragraph') out.push(...wrap(stripInline(b.text), 80 - indent.length, indent), '');
    else if (b.type === 'bullets') { b.items.forEach((i) => out.push(...wrap(stripInline(i), 78 - indent.length, `${indent}  • `).map((l, k) => (k ? l.replace(/^\s*/, indent + '    ') : l)))); out.push(''); }
    else if (b.type === 'numbered') { b.items.forEach((i, n) => out.push(...wrap(stripInline(i), 78 - indent.length, `${indent}${n + 1}. `))); out.push(''); }
    else if (b.type === 'code') { out.push(...b.text.split('\n').map((l) => `${indent}    ${l}`), ''); }
    else if (b.type === 'equation') out.push(center(b.text), '');
    else if (b.type === 'quote') out.push(...wrap(stripInline(b.text), 76 - indent.length, `${indent}  | `), '');
    else if (b.type === 'divider') out.push(center('* * *'), '');
    else if (b.type === 'table') { const widths = b.rows[0].map((_, i) => Math.max(...b.rows.map((r) => [...(r[i] || '')].length))); b.rows.forEach((r, ri) => { out.push(indent + r.map((c, i) => (c || '').padEnd(widths[i])).join(' | ')); if (ri === 0) out.push(indent + widths.map((w) => '-'.repeat(w)).join('-+-')); }); out.push(''); }
    else if (b.type === 'figure') { out.push(...diagramToAscii(b).map((l) => indent + l), center(`Figure ${b.number}: ${b.caption}`), ''); }
    else if (b.type === 'box') { out.push(`${indent}[${b.title || b.kind.toUpperCase()}]`); renderBlocks(b.blocks, out, indent + '  '); }
  }
}

export function exportTxt(book) {
  const m = buildBookModel(book); const out = [];
  out.push('', '', center(m.title.toUpperCase()));
  if (m.subtitle) out.push(center(m.subtitle));
  out.push('', center(`by ${m.author}`), '', '='.repeat(80), '', 'TABLE OF CONTENTS', '');
  m.toc.forEach((t) => out.push(`  ${t.text}`));
  m.chapters.forEach((c) => {
    out.push('', '='.repeat(80), '');
    if (c.label) out.push(c.label.toUpperCase());
    out.push(c.title.toUpperCase(), '');
    renderBlocks(c.blocks, out);
  });
  return Buffer.from(out.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n', 'utf8');
}
