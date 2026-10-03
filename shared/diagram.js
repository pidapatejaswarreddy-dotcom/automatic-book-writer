// Diagram engine: one layout used by the browser (SVG), the PDF exporter (vector drawing),
// and the TXT exporter (ASCII). Nothing is drawn unless a [[FIGURE: ...]] directive asks for it.
const wrap = (label, max = 20) => {
  const words = String(label).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
};
const box = (label, x, y, w, style = 'node') => { const lines = wrap(label, Math.max(10, Math.floor(w / 8.2))); return { x, y, w, h: 20 + lines.length * 17, lines, style }; };
const centerX = (b) => b.x + b.w / 2;

export const FIGURE_TYPES = ['flowchart', 'process', 'block', 'architecture', 'cycle', 'timeline', 'comparison', 'hierarchy', 'concept-map'];
export const normalizeType = (t = '') => {
  t = t.toLowerCase().replace(/[\s_]+/g, '-');
  if (/cycle/.test(t)) return 'cycle';
  if (/timeline/.test(t)) return 'timeline';
  if (/compar/.test(t)) return 'comparison';
  if (/hier|tree|org/.test(t)) return 'hierarchy';
  if (/concept|mind|map/.test(t)) return 'concept-map';
  return 'flow';
};

export function layoutDiagram(fig, W = 620) {
  const type = normalizeType(fig.figureType);
  const nodes = fig.nodes.slice(0, 10);
  const boxes = [], links = [];
  let height = 0;
  if (type === 'flow' || (type === 'timeline' && nodes.length > 6)) {
    const w = Math.min(280, W * 0.65); let y = 10;
    nodes.forEach((n, i) => {
      const b = box(n, (W - w) / 2, y, w, i === 0 || i === nodes.length - 1 ? 'end' : 'node'); boxes.push(b); y += b.h + 30;
    });
    for (let i = 0; i < boxes.length - 1; i++) links.push({ x1: centerX(boxes[i]), y1: boxes[i].y + boxes[i].h, x2: centerX(boxes[i + 1]), y2: boxes[i + 1].y, arrow: true });
    height = y - 10;
  } else if (type === 'timeline') {
    const n = nodes.length, gap = 26, w = (W - 20 - gap * (n - 1)) / n; let hmax = 0;
    nodes.forEach((t, i) => { const b = box(t, 10 + i * (w + gap), 40, w); boxes.push(b); hmax = Math.max(hmax, b.h); });
    boxes.forEach((b) => { b.h = hmax; });
    for (let i = 0; i < n - 1; i++) links.push({ x1: boxes[i].x + w, y1: 40 + hmax / 2, x2: boxes[i + 1].x, y2: 40 + hmax / 2, arrow: true });
    height = 40 + hmax + 20;
  } else if (type === 'cycle') {
    const n = nodes.length, R = W * 0.24, cx = W / 2, cy = R + 50, w = W * 0.24;
    nodes.forEach((t, i) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; const b = box(t, cx + R * 1.35 * Math.cos(a) - w / 2, cy + R * Math.sin(a) - 20, w); boxes.push(b); });
    for (let i = 0; i < n; i++) {
      const a = boxes[i], b = boxes[(i + 1) % n];
      const ax = centerX(a), ay = a.y + a.h / 2, bx = centerX(b), by = b.y + b.h / 2;
      const d = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / d, uy = (by - ay) / d;
      const cut = (bb) => Math.min(Math.abs(bb.w / 2 / (ux || 1e-9)), Math.abs(bb.h / 2 / (uy || 1e-9))) + 4;
      links.push({ x1: ax + ux * cut(a), y1: ay + uy * cut(a), x2: bx - ux * cut(b), y2: by - uy * cut(b), arrow: true });
    }
    height = cy + R + 60;
  } else if (type === 'hierarchy') {
    const [root, ...kids] = nodes; const perRow = Math.min(W < 500 ? 3 : 4, kids.length || 1);
    const rw = Math.min(220, W * 0.5); const rb = box(root, W / 2 - rw / 2, 10, rw, 'end'); boxes.push(rb);
    const gap = 16, w = (W - 20 - gap * (perRow - 1)) / perRow; let y = rb.y + rb.h + 40, row = 0;
    kids.forEach((k, i) => {
      const col = i % perRow; if (i && col === 0) { y += 80; row++; }
      const b = box(k, 10 + col * (w + gap), y, w); boxes.push(b);
      links.push({ x1: centerX(rb), y1: rb.y + rb.h, x2: centerX(b), y2: b.y, arrow: false, elbow: row === 0 });
    });
    height = y + 70;
  } else if (type === 'comparison') {
    const cols = nodes.slice(0, 2).map((n) => { const [title, rest = ''] = n.split(/:(.*)/s); return { title: title.trim(), items: rest.split(',').map((s) => s.trim()).filter(Boolean) }; });
    while (cols.length < 2) cols.push({ title: '', items: [] });
    const w = Math.min(280, (W - 30) / 2); let bottom = 0;
    cols.forEach((c, ci) => {
      const x = 10 + ci * (w + 20); let y = 10; const h = box(c.title, x, y, w, 'end'); boxes.push(h); y += h.h + 12;
      c.items.slice(0, 7).forEach((it) => { const b = box(it, x, y, w); boxes.push(b); y += b.h + 10; });
      bottom = Math.max(bottom, y);
    });
    height = bottom;
  } else { // concept-map
    const [center, ...rest] = nodes; const cbw = Math.min(180, W * 0.3); const cb = box(center, W / 2 - cbw / 2, 0, cbw, 'end'); const n = rest.length; const cx = W / 2, cy = 190; const rx = W * 0.37, bw = Math.min(150, W * 0.26); cb.y = cy - cb.h / 2; boxes.push(cb);
    rest.forEach((t, i) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; const b = box(t, cx + rx * Math.cos(a) - bw / 2, cy + 140 * Math.sin(a) - 20, bw); boxes.push(b); links.push({ x1: cx, y1: cy, x2: centerX(b), y2: b.y + b.h / 2, arrow: false, behind: true }); });
    height = 400;
  }
  return { type, width: W, height: height + 10, boxes, links };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function diagramToSvg(fig, colors = {}) {
  const c = { stroke: '#1f4e79', fill: '#eaf1f8', endFill: '#1f4e79', endText: '#ffffff', text: '#1a2433', ...colors };
  const L = layoutDiagram(fig);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" role="img" aria-label="${esc(fig.caption)}" font-family="Helvetica, Arial, sans-serif" font-size="14">`,
    `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c.stroke}"/></marker></defs>`];
  L.links.forEach((l) => {
    if (l.elbow !== undefined && !l.arrow) { const my = (l.y1 + l.y2) / 2; parts.push(`<path d="M${l.x1} ${l.y1} V${my} H${l.x2} V${l.y2}" fill="none" stroke="${c.stroke}" stroke-width="1.6"/>`); }
    else parts.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${c.stroke}" stroke-width="1.6" ${l.arrow ? 'marker-end="url(#ah)"' : ''}/>`);
  });
  L.boxes.forEach((b) => {
    const end = b.style === 'end';
    parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="${end ? c.endFill : c.fill}" stroke="${c.stroke}" stroke-width="1.4"/>`);
    b.lines.forEach((ln, i) => parts.push(`<text x="${b.x + b.w / 2}" y="${b.y + 24 + i * 17}" text-anchor="middle" fill="${end ? c.endText : c.text}">${esc(ln)}</text>`));
  });
  parts.push('</svg>');
  return parts.join('');
}

// ASCII rendering for TXT export
export function diagramToAscii(fig) {
  const type = normalizeType(fig.figureType); const nodes = fig.nodes;
  const boxTxt = (s) => { const w = Math.max(...[s].map((x) => x.length)) + 4; return [`┌${'─'.repeat(w)}┐`, `│${' '.repeat(2)}${s}${' '.repeat(2)}│`, `└${'─'.repeat(w)}┘`]; };
  const centerLines = (arr, width) => arr.map((l) => ' '.repeat(Math.max(0, Math.floor((width - l.length) / 2))) + l);
  if (type === 'flow' || type === 'timeline' || type === 'cycle') {
    const w = Math.max(...nodes.map((n) => n.length)) + 6; const out = [];
    nodes.forEach((n, i) => { out.push(...centerLines(boxTxt(n), w)); if (i < nodes.length - 1) out.push(...centerLines(['│', '▼'], w)); });
    if (type === 'cycle') out.push(...centerLines(['│', `↺ back to: ${nodes[0]}`], w));
    return out;
  }
  if (type === 'hierarchy') { const [r, ...k] = nodes; return [r, ...k.map((x, i) => `${i === k.length - 1 ? '└──' : '├──'} ${x}`)]; }
  if (type === 'comparison') {
    const cols = nodes.slice(0, 2).map((n) => { const [t, rest = ''] = n.split(/:(.*)/s); return [t.trim(), ...rest.split(',').map((s) => s.trim()).filter(Boolean)]; });
    const w = Math.max(...cols.flat().map((s) => s.length)) + 2; const rows = Math.max(cols[0].length, cols[1]?.length || 0);
    const out = [`+${'-'.repeat(w + 1)}+${'-'.repeat(w + 1)}+`];
    for (let i = 0; i < rows; i++) { out.push(`| ${(cols[0][i] || '').padEnd(w)}| ${((cols[1] || [])[i] || '').padEnd(w)}|`); if (i === 0) out.push(out[0]); }
    out.push(out[0]); return out;
  }
  const [c, ...rest] = nodes; return [`[ ${c} ]`, ...rest.map((x) => `   ├── ${x}`)];
}
