export const COVER_STYLES = [
  { id: 'midnight', name: 'Midnight', bg: '#14213d', fg: '#f4f1e8', accent: '#fca311', motif: 'frame' },
  { id: 'paper', name: 'Paper', bg: '#f6f7f4', fg: '#1b2430', accent: '#2a9d8f', motif: 'band' },
  { id: 'forest', name: 'Forest', bg: '#1b4332', fg: '#e9f5db', accent: '#95d5b2', motif: 'circle' },
  { id: 'crimson', name: 'Crimson', bg: '#7a1f2b', fg: '#fff3ec', accent: '#f2c14e', motif: 'stripes' },
];
export const getCoverStyle = (id) => COVER_STYLES.find((s) => s.id === id) || COVER_STYLES[0];
const DEFAULT_BY_TYPE = { educational: 'midnight', mathematics: 'paper', technical: 'forest', novel: 'crimson', 'short-stories': 'crimson', 'self-help': 'forest', biography: 'midnight', business: 'paper' };
export const defaultCoverFor = (type) => DEFAULT_BY_TYPE[type] || 'midnight';

export function wrapTitle(text, max) {
  const lines = []; let cur = '';
  for (const w of String(text).split(/\s+/)) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function coverToSvg(book, styleId) {
  const s = getCoverStyle(styleId || book.coverStyle);
  const size = book.title.length > 44 ? 34 : book.title.length > 26 ? 42 : 52;
  const lines = wrapTitle(book.title, Math.floor(400 / (size * 0.55)));
  const motif = { frame: `<rect x="28" y="28" width="544" height="844" fill="none" stroke="${s.accent}" stroke-width="3"/><rect x="40" y="40" width="520" height="820" fill="none" stroke="${s.accent}" stroke-width="1"/>`,
    band: `<rect x="0" y="0" width="70" height="900" fill="${s.accent}"/>`,
    circle: `<circle cx="470" cy="150" r="190" fill="${s.accent}" opacity=".25"/><circle cx="470" cy="150" r="110" fill="${s.accent}" opacity=".35"/>`,
    stripes: `<g fill="${s.accent}" opacity=".9"><rect x="0" y="700" width="600" height="10"/><rect x="0" y="722" width="600" height="5"/><rect x="0" y="738" width="600" height="2"/></g>` }[s.motif];
  const x = s.motif === 'band' ? 110 : 300, anchor = s.motif === 'band' ? 'start' : 'middle';
  let y = 300; const t = lines.map((l) => { const r = `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="700" fill="${s.fg}" font-family="Georgia, 'Times New Roman', serif">${esc(l)}</text>`; y += size * 1.2; return r; }).join('');
  const sub = book.subtitle ? `<text x="${x}" y="${y + 20}" text-anchor="${anchor}" font-size="20" fill="${s.fg}" opacity=".85" font-family="Georgia, serif" font-style="italic">${esc(book.subtitle.slice(0, 60))}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" role="img" aria-label="Book cover"><rect width="600" height="900" fill="${s.bg}"/>${motif}${t}${sub}<line x1="${s.motif === 'band' ? 110 : 250}" y1="780" x2="${s.motif === 'band' ? 210 : 350}" y2="780" stroke="${s.accent}" stroke-width="3"/><text x="${x}" y="820" text-anchor="${anchor}" font-size="22" fill="${s.fg}" font-family="Helvetica, Arial, sans-serif" letter-spacing="1">${esc(book.author || '')}</text></svg>`;
}
