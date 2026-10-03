import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, Footer, Header, PageNumber, LevelFormat, TabStopType, TabStopPosition, VerticalAlign,
} from 'docx';
import { parseInline } from '../shared/content.js';
import { layoutDiagram, normalizeType } from '../shared/diagram.js';
import { buildBookModel } from './model.js';
import { pdfLayout } from './pdf.js';

const PW = 8640, PH = 12960, MG = { top: 1080, bottom: 1080, left: 1000, right: 1000 }; const CW = PW - MG.left - MG.right;
const BOX = { example: ['1F4E79', 'EAF1F8'], keypoints: ['2A7F62', 'E8F5EF'], note: ['6B7280', 'F1F2F4'], exercise: ['6B46A3', 'F1EBF9'], answer: ['0F766E', 'E6F4F2'], summary: ['1F4E79', 'EAF1F8'], case: ['B45309', 'FDF1E4'] };
const FICTION = ['novel', 'short-stories'];
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

export async function exportDocx(book) {
  const m = buildBookModel(book);
  const { chapterPages } = await pdfLayout(book).catch(() => ({ chapterPages: {} })); // page numbers mirror the PDF layout (same page size, fonts and margins)
  const font = m.language.script === 'indic' ? m.language.docxFont : 'Times New Roman';
  const fiction = FICTION.includes(m.bookType);
  const numbering = []; let listId = 0;
  const bulletRef = 'bullets';
  numbering.push({ reference: bulletRef, levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] });

  const runs = (text, o = {}) => parseInline(text).map((s) => new TextRun({ text: s.text, bold: s.bold || o.bold, italics: s.italic || o.italics, font: s.code ? 'Courier New' : (o.font || font), size: o.size || 22, color: o.color }));
  const para = (text, o = {}) => new Paragraph({ children: runs(text, o), alignment: o.align || (fiction ? AlignmentType.LEFT : AlignmentType.JUSTIFIED), spacing: { after: o.after ?? (fiction ? 60 : 140), line: 300 }, indent: o.indent, keepNext: o.keepNext });

  function blocksToDocx(blocks, inBox = false) {
    const out = [];
    blocks.forEach((b, bi) => {
      switch (b.type) {
        case 'sectionTitle': out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: b.text, font, bold: true, size: b.extra ? 26 : 28, color: b.extra ? '1F4E79' : '14213D' })], spacing: { before: 280, after: 120 }, keepNext: true })); break;
        case 'heading': out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: b.text, font, bold: true, size: 24 })], spacing: { before: 200, after: 80 }, keepNext: true })); break;
        case 'paragraph': out.push(para(b.text, { indent: fiction && bi > 0 && !inBox ? { firstLine: 280 } : undefined })); break;
        case 'bullets': b.items.forEach((i) => out.push(new Paragraph({ children: runs(i), numbering: { reference: bulletRef, level: 0 }, spacing: { after: 60 } }))); break;
        case 'numbered': { const ref = `num-${++listId}`; numbering.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } }] }); b.items.forEach((i) => out.push(new Paragraph({ children: runs(i), numbering: { reference: ref, level: 0 }, spacing: { after: 60 } }))); break; }
        case 'code': b.text.split('\n').forEach((l) => out.push(new Paragraph({ children: [new TextRun({ text: l || ' ', font: 'Courier New', size: 18 })], shading: { type: ShadingType.CLEAR, fill: 'F1F3F5', color: 'auto' }, spacing: { after: 0, line: 240 }, indent: { left: 120, right: 120 } }))); out.push(new Paragraph({ spacing: { after: 80 }, children: [] })); break;
        case 'equation': out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b.text, italics: true, font: 'Cambria Math', size: 24 })], spacing: { before: 80, after: 140 } })); break;
        case 'quote': out.push(new Paragraph({ children: runs(b.text, { italics: true }), indent: { left: 500 }, border: { left: { style: BorderStyle.SINGLE, size: 8, color: '999999', space: 8 } }, spacing: { after: 140 } })); break;
        case 'divider': out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '*   *   *', font, color: '777777' })], spacing: { before: 120, after: 160 } })); break;
        case 'table': out.push(...tableToDocx(b)); break;
        case 'figure': out.push(...figureToDocx(b)); break;
        case 'box': out.push(...boxToDocx(b)); break;
        default: break;
      }
    });
    return out;
  }

  function tableToDocx(b) {
    const cols = Math.max(...b.rows.map((r) => r.length)); const cw = Math.floor(CW / cols);
    const line = { style: BorderStyle.SINGLE, size: 4, color: '9AA5B1' };
    return [new Table({ width: { size: cw * cols, type: WidthType.DXA }, columnWidths: Array(cols).fill(cw), rows: b.rows.map((r, ri) => new TableRow({ tableHeader: ri === 0, cantSplit: true, children: Array.from({ length: cols }, (_, i) => new TableCell({ width: { size: cw, type: WidthType.DXA }, borders: { top: line, bottom: line, left: line, right: line }, shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'E6EDF5', color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: runs(r[i] || '', { bold: ri === 0, size: 20 }) })] })) })) }), new Paragraph({ spacing: { after: 120 }, children: [] })];
  }

  function boxToDocx(b) {
    const [col, fill] = BOX[b.kind] || BOX.note; const label = b.title || b.kind[0].toUpperCase() + b.kind.slice(1);
    const children = [new Paragraph({ children: [new TextRun({ text: label, bold: true, font, color: col, size: 22 })], spacing: { after: 80 }, keepNext: true }), ...blocksToDocx(b.blocks, true)];
    return [new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [new TableRow({ children: [new TableCell({ width: { size: CW, type: WidthType.DXA }, borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color: col } }, shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, margins: { top: 100, bottom: 100, left: 180, right: 140 }, children })] })] }), new Paragraph({ spacing: { after: 160 }, children: [] })];
  }

  // Diagrams become native Word tables (boxes + arrows) so they stay editable and need no image conversion.
  function figureToDocx(b) {
    const type = normalizeType(b.figureType); const nodes = b.nodes; const col = '1F4E79';
    const cell = (t, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: o.plain ? noBorders : { top: { style: BorderStyle.SINGLE, size: 8, color: col }, bottom: { style: BorderStyle.SINGLE, size: 8, color: col }, left: { style: BorderStyle.SINGLE, size: 8, color: col }, right: { style: BorderStyle.SINGLE, size: 8, color: col } }, shading: o.plain ? undefined : { type: ShadingType.CLEAR, fill: o.dark ? col : 'EAF1F8', color: 'auto' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, font, size: o.plain ? 24 : 20, bold: !!o.dark, color: o.dark ? 'FFFFFF' : o.plain ? col : '1A2433' })] })] });
    const tbl = (widths, rows, align = AlignmentType.CENTER) => new Table({ alignment: align, width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: widths, rows });
    let t;
    if (type === 'timeline' && nodes.length <= 5) { const w = Math.floor((CW - 400 * (nodes.length - 1)) / nodes.length); const ws = []; const cells = []; nodes.forEach((n, i) => { cells.push(cell(n, w)); ws.push(w); if (i < nodes.length - 1) { cells.push(cell('→', 400, { plain: true })); ws.push(400); } }); t = tbl(ws, [new TableRow({ children: cells })]); }
    else if (type === 'comparison') { const cols = nodes.slice(0, 2).map((n) => { const [h, r = ''] = n.split(/:(.*)/s); return [h.trim(), ...r.split(',').map((x) => x.trim()).filter(Boolean)]; }); const n = Math.max(...cols.map((c) => c.length)); const w = Math.floor(CW / 2) - 100; t = tbl([w, w], Array.from({ length: n }, (_, i) => new TableRow({ children: cols.map((c) => cell(c[i] || '', w, { dark: i === 0 })) }))); }
    else if (type === 'hierarchy' || type === 'concept-map') { const [root, ...kids] = nodes; const n = Math.min(4, kids.length || 1); const w = Math.floor(CW / n) - 60; const rows = [new TableRow({ children: [cell(root, w * n, { dark: true })] })]; const ws = Array(n).fill(w); const grid = []; for (let i = 0; i < kids.length; i += n) grid.push(kids.slice(i, i + n)); t = new Table({ alignment: AlignmentType.CENTER, width: { size: w * n, type: WidthType.DXA }, columnWidths: ws, rows: [new TableRow({ children: [new TableCell({ columnSpan: n, width: { size: w * n, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: root, bold: true, font, size: 22, color: 'FFFFFF' })], shading: { type: ShadingType.CLEAR, fill: col, color: 'auto' } })] })] }), new TableRow({ children: ws.map(() => cell('▼', w, { plain: true })) }), ...grid.map((g) => new TableRow({ children: ws.map((_, i) => cell(g[i] || '', w, g[i] ? {} : { plain: true })) }))] }); }
    else { const w = 3400; const rows = []; nodes.forEach((n, i) => { rows.push(new TableRow({ children: [cell(n, w, { dark: i === 0 || i === nodes.length - 1 })] })); if (i < nodes.length - 1) rows.push(new TableRow({ children: [cell('▼', w, { plain: true })] })); }); if (type === 'cycle') rows.push(new TableRow({ children: [cell(`↺ back to: ${nodes[0]}`, w, { plain: true })] })); t = tbl([w], rows); }
    return [new Paragraph({ spacing: { before: 120 }, keepNext: true, children: [] }), t, new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 }, children: [new TextRun({ text: `Figure ${b.number}: ${b.caption}`, italics: true, font, size: 18, color: '444444' })] })];
  }

  const spacer = (h) => new Paragraph({ spacing: { line: h, lineRule: 'exact', before: 0, after: 0 }, children: [] });
  const line = (text, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.CENTER, spacing: { before: o.before || 0, after: o.after || 200 }, children: [new TextRun({ text, font: o.head ? 'Arial' : font, bold: o.bold, italics: o.italics, size: o.size || 24, color: o.color })] });
  const cs = m.cover; const hex = (c) => c.replace('#', '');
  const coverTable = new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [new TableRow({ height: { value: PH - 2400, rule: 'atLeast' }, children: [new TableCell({ width: { size: CW, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: { top: none, bottom: none, left: none, right: { style: BorderStyle.SINGLE, size: 48, color: hex(cs.accent) } }, shading: { type: ShadingType.CLEAR, fill: hex(cs.bg), color: 'auto' }, margins: { top: 400, bottom: 400, left: 500, right: 500 }, children: [
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 240 }, children: [new TextRun({ text: m.title, bold: true, font, size: m.title.length > 40 ? 64 : 84, color: hex(cs.fg) })] }),
    ...(m.subtitle ? [new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: m.subtitle, italics: true, font, size: 32, color: hex(cs.fg) })] })] : []),
    new Paragraph({ spacing: { before: 1800 }, children: [new TextRun({ text: m.author, font, size: 36, color: hex(cs.accent), bold: true })] })] })] })] });

  const tocRows = m.toc.map((t) => new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CW, leader: 'dot' }], spacing: { after: 140 }, children: [new TextRun({ text: t.text, font, size: 23, bold: t.kind !== 'chapter' }), new TextRun({ text: `\t${chapterPages[t.id] || ''}`, font, size: 23 })] }));

  const body = [];
  m.chapters.forEach((c, i) => {
    if (i > 0) body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(spacer(1800));
    if (c.label) body.push(new Paragraph({ children: [new TextRun({ text: c.label, font: 'Arial', bold: true, size: 24, color: 'B8860B' })], spacing: { after: 80 } }));
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: c.title, font: 'Arial', bold: true, size: c.title.length > 40 ? 40 : 50, color: '14213D' })], spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'B8860B', space: 8 } } }));
    body.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    body.push(...blocksToDocx(c.blocks));
  });

  const stylesDef = { default: { document: { run: { font, size: 22 } } }, paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 50, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } }] };
  const page = { size: { width: PW, height: PH }, margin: MG };
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '666666' })] })] });
  const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.title, italics: true, font, size: 17, color: '777777' })] })] });

  const front = [coverTable, new Paragraph({ children: [new PageBreak()] }), spacer(3200), line(m.title, { size: 52, bold: true, head: true, color: '14213D' }), ...(m.subtitle ? [line(m.subtitle, { size: 28, italics: true })] : []), line(m.author, { size: 28, before: 400 }),
    ...(m.showCopyright ? [new Paragraph({ children: [new PageBreak()] }), spacer(8000), new Paragraph({ children: [new TextRun({ text: m.copyright, font, size: 17, color: '555555' })] })] : []),
    new Paragraph({ children: [new PageBreak()] }), new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: m.language.script === 'indic' ? 'Contents' : 'Table of Contents', font: 'Arial', bold: true, size: 40, color: '14213D' })] }), ...tocRows];

  const doc = new Document({ creator: m.author, title: m.title, description: `${m.title} — generated with Automatic Book Writer`, styles: stylesDef, numbering: { config: numbering },
    sections: [{ properties: { page }, children: front }, { properties: { page }, headers: { default: header }, footers: { default: footer }, children: body }] });
  return Packer.toBuffer(doc);
}
