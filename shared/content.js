// Content markup used everywhere (AI output, editor, preview, exporters).
//   ### Heading            sub-heading            - / 1.  lists
//   ```lang ... ```        code                   | a | b |  tables
//   :::kind Title ... :::  callout box (example, keypoints, note, exercise, answer, summary)
//   $$ formula $$          equation line          > quote
//   [[FIGURE: type | caption | node; node; node]]  diagram request
//   **bold**  *italic*  `code`
export const BOX_KINDS = ['example', 'keypoints', 'note', 'exercise', 'answer', 'summary', 'case'];
const FIG_RE = /^\[\[\s*FIGURE\s*:(.*)\]\]\s*$/i;

export function parseFigure(line) {
  const m = FIG_RE.exec(line.trim());
  if (!m) return null;
  const parts = m[1].split('|').map((s) => s.trim());
  if (parts.length < 3) return null;
  const nodes = parts.slice(2).join('|').split(';').map((s) => s.trim()).filter(Boolean);
  if (nodes.length < 2) return null;
  return { type: 'figure', figureType: (parts[0] || 'flowchart').toLowerCase(), caption: parts[1] || '', nodes: nodes.slice(0, 10) };
}

export function parseInline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w*])\*[^*\n]+\*(?![\w*])|(?<![\w_])_[^_\n]+_(?![\w_]))/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**')) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith('`')) out.push({ text: t.slice(1, -1), code: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text: '' }];
}

export const stripInline = (t) => parseInline(t).map((s) => s.text).join('');

export function parseBlocks(md = '', depth = 0) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0, para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'paragraph', text: para.join(' ') }); para = []; } };
  while (i < lines.length) {
    const line = lines[i], t = line.trim();
    if (!t) { flush(); i++; continue; }
    let m;
    if (t.startsWith('```')) {
      flush();
      const lang = t.slice(3).trim(); const code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      i++; blocks.push({ type: 'code', lang, text: code.join('\n') }); continue;
    }
    if (depth === 0 && (m = /^:::\s*([a-z]+)\s*(.*)$/i.exec(t))) {
      flush();
      const inner = []; i++;
      while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i++]);
      i++;
      const kind = BOX_KINDS.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : 'note';
      blocks.push({ type: 'box', kind, title: m[2].trim(), blocks: parseBlocks(inner.join('\n'), 1) }); continue;
    }
    const fig = parseFigure(t);
    if (fig) { flush(); blocks.push(fig); i++; continue; }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(t))) { flush(); blocks.push({ type: 'heading', level: 3, text: m[2].trim() }); i++; continue; }
    if ((m = /^\$\$(.+)\$\$$/.exec(t))) { flush(); blocks.push({ type: 'equation', text: m[1].trim() }); i++; continue; }
    if (/^(\*\s*\*\s*\*|---+|___+)$/.test(t)) { flush(); blocks.push({ type: 'divider' }); i++; continue; }
    if (t.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) blocks.push({ type: 'table', rows }); continue;
    }
    if (/^([-*•])\s+/.test(t)) {
      flush(); const items = [];
      while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^([-*•])\s+/, ''));
      blocks.push({ type: 'bullets', items }); continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      flush(); const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^\d+[.)]\s+/, ''));
      blocks.push({ type: 'numbered', items }); continue;
    }
    if (t.startsWith('>')) {
      flush(); const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) q.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: q.join(' ') }); continue;
    }
    para.push(t); i++;
  }
  flush();
  return blocks;
}

export function extractFigures(md) {
  return parseBlocks(md).flatMap((b) => (b.type === 'figure' ? [b] : b.type === 'box' ? b.blocks.filter((x) => x.type === 'figure') : []));
}

export const countWords = (md) =>
  String(md || '').replace(/\[\[FIGURE:[^\]]*\]\]/gi, ' ').replace(/```[a-z]*/gi, ' ').replace(/[#>*_`|:$-]+/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const chapterText = (chapter) => (chapter.sections || []).map((s) => s.content || '').join('\n\n');
export const bookWordCount = (book) => (book.chapters || []).reduce((n, c) => n + (c.sections || []).reduce((m, s) => m + countWords(s.content), 0), 0);
