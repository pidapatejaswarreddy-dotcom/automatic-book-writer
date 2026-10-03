import PDFDocument from 'pdfkit';
import { parseInline } from '../shared/content.js';
import { layoutDiagram } from '../shared/diagram.js';
import { wrapTitle } from '../shared/covers.js';
import { buildBookModel } from './model.js';
import { registerFonts, splitRuns, fontName } from './fonts.js';

const PAGE = [432, 648]; const M = { top: 58, bottom: 62, left: 52, right: 52 };
const W = PAGE[0] - M.left - M.right;
const BOX = { example: '#1f4e79', keypoints: '#2a7f62', note: '#6b7280', exercise: '#6b46a3', answer: '#0f766e', summary: '#1f4e79', case: '#b45309' };
const FICTION = ['novel', 'short-stories'];

// One rendering pass. Returns { buffer, pages, chapterPages }. exportPdf() runs two passes so the TOC has real page numbers.
function renderPass(model, tocPages = {}) {
  const lang = model.language; const indic = lang.script === 'indic';
  const doc = new PDFDocument({ size: PAGE, margins: M, bufferPages: true, info: { Title: model.title, Author: model.author, Subject: model.topic, Creator: 'Automatic Book Writer' } });
  const chunks = []; doc.on('data', (c) => chunks.push(c));
  registerFonts(doc, lang);
  const fiction = FICTION.includes(model.bookType);
  const chapterPages = {}; const pageTitle = {}; const openers = new Set(); let bodyStart = null;
  const limit = () => PAGE[1] - M.bottom;
  const curPage = () => doc.bufferedPageRange().count - 1;
  const ensure = (h) => { if (doc.y + h > limit()) { doc.addPage(); if (curChapter) pageTitle[curPage()] = curChapter.title; } };
  let curChapter = null;

  // Draw text as font-safe runs. opts: size, style, color, align, width, at:{x,y}, indent, gap
  const text = (str, o = {}) => {
    const segs = o.rich === false ? [{ text: str }] : parseInline(str);
    const parts = [];
    segs.forEach((s) => { const style = o.style === 'head' ? 'head' : s.code ? 'code' : s.bold && (o.style === 'italic' || s.italic) ? 'bolditalic' : s.bold ? 'bold' : s.italic || o.style === 'italic' ? 'italic' : o.style === 'bold' ? 'bold' : 'regular'; splitRuns(s.text, lang).forEach((r) => parts.push({ text: r.text, font: fontName(r.cls, style, lang), code: style === 'code' })); });
    const clean = parts.filter((p) => p.text.length);
    if (!clean.length) return;
    const base = { width: o.width ?? W, align: o.align || (clean.length === 1 && !indic && !o.noJustify ? 'justify' : 'left'), lineGap: o.lineGap ?? (indic ? 3.5 : 2.2), indent: o.indent || 0 };
    clean.forEach((p, i) => {
      doc.font(p.font).fontSize(p.code ? (o.size || 10.5) - 1.5 : o.size || 10.5).fillColor(o.color || '#1a1a1a');
      const opt = { ...base, continued: i < clean.length - 1 };
      if (i === 0 && o.at) doc.text(p.text, o.at.x, o.at.y, opt); else doc.text(p.text, opt);
    });
  };
  const height = (str, o = {}) => { const plain = parseInline(str).map((s) => s.text).join(''); doc.font(fontName(splitRuns(plain, lang)[0]?.cls || 'base', o.style === 'head' ? 'head' : 'regular', lang)).fontSize(o.size || 10.5); return doc.heightOfString(plain, { width: o.width ?? W, lineGap: indic ? 3.5 : 2.2 }); };
  const setX = (x) => { doc.x = x; };

  // ---------- cover ----------
  const drawCover = () => {
    const s = model.cover; const mg = { ...doc.page.margins }; doc.page.margins = { top: 0, bottom: -3000, left: 0, right: 0 }; doc.save().scale(PAGE[0] / 600);
    doc.rect(0, 0, 600, 900).fill(s.bg);
    if (s.motif === 'frame') { doc.lineWidth(3).rect(28, 28, 544, 844).stroke(s.accent); doc.lineWidth(1).rect(40, 40, 520, 820).stroke(s.accent); }
    if (s.motif === 'band') doc.rect(0, 0, 70, 900).fill(s.accent);
    if (s.motif === 'circle') { doc.fillOpacity(0.25).circle(470, 150, 190).fill(s.accent); doc.fillOpacity(0.35).circle(470, 150, 110).fill(s.accent).fillOpacity(1); }
    if (s.motif === 'stripes') { doc.rect(0, 700, 600, 10).fill(s.accent).rect(0, 722, 600, 5).fill(s.accent).rect(0, 738, 600, 2).fill(s.accent); }
    const left = s.motif === 'band'; const x = left ? 110 : 50, w = left ? 440 : 500, align = left ? 'left' : 'center';
    const size = model.title.length > 44 ? 34 : model.title.length > 26 ? 42 : 52;
    let y = 300 - size * 0.8;
    wrapTitle(model.title, Math.floor(400 / (size * 0.55))).forEach((ln) => { text(ln, { style: 'bold', size, color: s.fg, at: { x, y }, width: w, align, rich: false, lineGap: 0 }); y += size * 1.2; });
    if (model.subtitle) text(model.subtitle.slice(0, 60), { style: 'italic', size: 20, color: s.fg, at: { x, y: y + 4 }, width: w, align, rich: false });
    doc.lineWidth(3).moveTo(left ? 110 : 250, 780).lineTo(left ? 210 : 350, 780).stroke(s.accent);
    text(model.author, { style: 'regular', size: 22, color: s.fg, at: { x, y: 800 }, width: w, align, rich: false });
    doc.restore(); doc.page.margins = mg;
  };
  drawCover();

  // ---------- title page ----------
  doc.addPage(); doc.y = 190;
  text(model.title, { style: 'head', size: 26, align: 'center', rich: false, lineGap: 4, color: '#14213d' });
  if (model.subtitle) { doc.moveDown(0.8); text(model.subtitle, { style: 'italic', size: 14, align: 'center', rich: false, color: '#444' }); }
  doc.moveDown(2); text(model.author, { size: 14, align: 'center', rich: false });
  if (model.showCopyright) { doc.addPage(); doc.y = PAGE[1] - 190; text(model.copyright, { size: 8.5, color: '#555', align: 'left', rich: false }); }

  // ---------- table of contents ----------
  doc.addPage(); doc.y = M.top + 20;
  text(indic ? 'Contents' : 'Table of Contents', { style: 'head', size: 20, rich: false, color: '#14213d' }); doc.moveDown(1.2);
  model.toc.forEach((t) => {
    if (doc.y + 22 > limit()) doc.addPage();
    const y = doc.y; const pg = String(tocPages[t.id] || '');
    const plain = t.text; doc.font(fontName(splitRuns(plain, lang)[0]?.cls || 'base', t.kind === 'chapter' ? 'regular' : 'bold', lang)).fontSize(11);
    const tw = Math.min(W - 40, doc.widthOfString(plain));
    text(plain, { size: 11, style: t.kind === 'chapter' ? 'regular' : 'bold', at: { x: M.left, y }, width: W - 40, rich: false, noJustify: true, align: 'left' });
    const lineEnd = doc.y; setX(M.left);
    text(pg, { size: 11, at: { x: M.left + W - 30, y }, width: 30, align: 'right', rich: false });
    if (tw < W - 90) doc.save().dash(0.6, { space: 2.5 }).lineWidth(0.6).strokeColor('#999').moveTo(M.left + tw + 6, y + 9).lineTo(M.left + W - 36, y + 9).stroke().undash().restore();
    doc.y = Math.max(lineEnd, y + 15) + 7; setX(M.left);
  });

  // ---------- block renderers ----------
  const renderBlocks = (blocks, x = M.left, w = W) => {
    blocks.forEach((b, bi) => {
      setX(x);
      switch (b.type) {
        case 'sectionTitle': {
          ensure(50); doc.moveDown(b.extra ? 0.6 : 0.5);
          text(b.text, { style: 'head', size: b.extra ? 12.5 : 14, color: b.extra ? '#1f4e79' : '#14213d', width: w, rich: false, align: 'left', at: { x, y: doc.y } }); doc.moveDown(0.5); break;
        }
        case 'heading': ensure(36); doc.moveDown(0.3); text(b.text, { style: 'head', size: 11.5, width: w, align: 'left', at: { x, y: doc.y } }); doc.moveDown(0.3); break;
        case 'paragraph': {
          ensure(Math.min(height(b.text, { width: w }), 44));
          text(b.text, { width: w, at: { x, y: doc.y }, indent: fiction && bi > 0 && blocks[bi - 1].type !== 'divider' ? 14 : 0 });
          doc.moveDown(fiction ? 0.15 : 0.55); break;
        }
        case 'bullets': case 'numbered': {
          b.items.forEach((it, i) => {
            ensure(Math.min(height(it, { width: w - 16 }), 30)); const y = doc.y;
            text(b.type === 'bullets' ? '•' : `${i + 1}.`, { at: { x: x + 2, y }, width: 14, rich: false, align: 'left' });
            doc.y = y; text(it, { at: { x: x + 16, y }, width: w - 16, align: 'left' }); setX(x); doc.moveDown(0.25);
          }); doc.moveDown(0.3); break;
        }
        case 'code': {
          const maxCh = Math.floor((w - 12) / 5.1); const lines = b.text.split('\n').flatMap((l) => (l.length > maxCh ? l.match(new RegExp(`.{1,${maxCh}}`, 'g')) : [l]));
          doc.moveDown(0.2);
          lines.forEach((ln) => { ensure(13); const y = doc.y; doc.rect(x, y - 1, w, 12).fill('#f1f3f5'); doc.font('Courier').fontSize(8.6).fillColor('#222').text(ln || ' ', x + 6, y, { width: w - 12, lineBreak: false }); doc.y = y + 11.5; });
          doc.moveDown(0.6); break;
        }
        case 'equation': ensure(26); doc.moveDown(0.25); text(b.text, { style: 'italic', size: 11.5, align: 'center', width: w, rich: false, at: { x, y: doc.y } }); doc.moveDown(0.6); break;
        case 'quote': { ensure(30); const y0 = doc.y; text(b.text, { style: 'italic', width: w - 22, at: { x: x + 18, y: doc.y }, color: '#444' }); doc.save().rect(x + 6, y0, 2, doc.y - y0).fill('#999').restore(); doc.moveDown(0.5); break; }
        case 'divider': ensure(24); doc.moveDown(0.5); text('*   *   *', { align: 'center', width: w, rich: false, at: { x, y: doc.y }, color: '#777' }); doc.moveDown(0.6); break;
        case 'table': renderTable(b, x, w); break;
        case 'figure': renderFigure(b, x, w); break;
        case 'box': renderBox(b, x, w); break;
        default: break;
      }
      setX(M.left);
    });
  };

  function renderTable(b, x, w) {
    const cols = Math.max(...b.rows.map((r) => r.length)); const cw = w / cols; doc.moveDown(0.3);
    b.rows.forEach((r, ri) => {
      const hs = r.map((c) => height(c, { width: cw - 10, size: 9 })); const rh = Math.max(...hs, 10) + 8; ensure(rh);
      const y = doc.y;
      if (ri === 0) doc.rect(x, y, w, rh).fill('#e6edf5');
      r.forEach((c, ci) => { doc.rect(x + ci * cw, y, cw, rh).lineWidth(0.5).stroke('#9aa5b1'); text(c, { size: 9, style: ri === 0 ? 'bold' : 'regular', at: { x: x + ci * cw + 5, y: y + 4 }, width: cw - 10, align: 'left' }); });
      doc.y = y + rh; setX(M.left);
    }); doc.moveDown(0.7);
  }

  function renderFigure(b, x, w) {
    const L = layoutDiagram(b, 440); const maxH = (PAGE[1] - M.top - M.bottom) * 0.72;
    const s = Math.min(1, w / L.width, maxH / L.height) * 0.92; const h = L.height * s;
    ensure(h + 40); doc.moveDown(0.3);
    const ox = x + (w - L.width * s) / 2, oy = doc.y; const stroke = '#1f4e79';
    doc.save().translate(ox, oy).scale(s);
    L.links.forEach((l) => {
      doc.lineWidth(1.6).strokeColor(stroke);
      if (l.elbow !== undefined && !l.arrow) { const my = (l.y1 + l.y2) / 2; doc.moveTo(l.x1, l.y1).lineTo(l.x1, my).lineTo(l.x2, my).lineTo(l.x2, l.y2).stroke(); }
      else { doc.moveTo(l.x1, l.y1).lineTo(l.x2, l.y2).stroke(); if (l.arrow) { const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1); const p = (ang) => [l.x2 - 9 * Math.cos(a + ang), l.y2 - 9 * Math.sin(a + ang)]; doc.polygon([l.x2, l.y2], p(0.4), p(-0.4)).fill(stroke); } }
    });
    L.boxes.forEach((bx) => {
      const end = bx.style === 'end'; doc.roundedRect(bx.x, bx.y, bx.w, bx.h, 8).lineWidth(1.4).fillAndStroke(end ? stroke : '#eaf1f8', stroke);
      bx.lines.forEach((ln, i) => text(ln, { size: 12, style: 'regular', color: end ? '#fff' : '#1a2433', at: { x: bx.x + 4, y: bx.y + 10 + i * 17 }, width: bx.w - 8, align: 'center', rich: false, lineGap: 0 }));
    });
    doc.restore(); doc.y = oy + h + 6; setX(x);
    text(`Figure ${b.number}: ${b.caption}`, { style: 'italic', size: 9, align: 'center', width: w, rich: false, color: '#444', at: { x, y: doc.y } }); doc.moveDown(0.8);
  }

  function renderBox(b, x, w) {
    ensure(70); const p0 = curPage(); const y0 = doc.y; const col = BOX[b.kind] || '#6b7280'; doc.y += 6;
    const label = b.title || b.kind[0].toUpperCase() + b.kind.slice(1);
    text(label, { style: 'head', size: 10.5, color: col, width: w - 20, at: { x: x + 12, y: doc.y }, rich: false, align: 'left' }); doc.moveDown(0.35);
    renderBlocks(b.blocks, x + 12, w - 20); doc.y += 4; const y1 = doc.y; const p1 = curPage();
    for (let p = p0; p <= p1; p++) {
      doc.switchToPage(p); const top = p === p0 ? y0 : M.top, bot = p === p1 ? y1 : limit();
      doc.save().fillOpacity(0.07).rect(x, top, w, bot - top).fill(col).restore(); doc.rect(x, top, 3, bot - top).fill(col);
    }
    doc.switchToPage(p1); doc.y = y1 + 8; setX(M.left);
  }

  // ---------- chapters ----------
  model.chapters.forEach((c) => {
    doc.addPage(); curChapter = c; const pi = curPage(); if (bodyStart === null) bodyStart = pi;
    chapterPages[c.id] = pi + 1; openers.add(pi); pageTitle[pi] = c.title;
    doc.y = 130; setX(M.left);
    if (c.label) { text(c.label, { style: 'head', size: 12, color: '#b8860b', rich: false, align: 'left', at: { x: M.left, y: doc.y } }); doc.moveDown(0.4); }
    text(c.title, { style: 'head', size: c.title.length > 40 ? 20 : 25, color: '#14213d', rich: false, align: 'left', width: W, lineGap: 4, at: { x: M.left, y: doc.y } });
    doc.moveDown(0.5); doc.lineWidth(1.5).moveTo(M.left, doc.y).lineTo(M.left + 60, doc.y).stroke('#b8860b'); doc.moveDown(1.1); setX(M.left);
    renderBlocks(c.blocks);
  });

  // ---------- running header + page numbers (drawn last so the margins never trigger new pages) ----------
  const range = doc.bufferedPageRange();
  let lastTitle = '';
  for (let i = 0; i < range.count; i++) {
    if (bodyStart === null || i < bodyStart) continue;
    if (pageTitle[i]) lastTitle = pageTitle[i]; else pageTitle[i] = lastTitle;
    doc.switchToPage(i); const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(9).fillColor('#666').text(String(i + 1), 0, PAGE[1] - 38, { width: PAGE[0], align: 'center', lineBreak: false });
    if (!openers.has(i) && pageTitle[i]) { const t = splitRuns(pageTitle[i], lang)[0]; doc.font(fontName(t?.cls || 'base', 'italic', lang)).fontSize(8.5).text(pageTitle[i].slice(0, 70), M.left, 28, { width: W, align: 'center', lineBreak: false }); }
    doc.page.margins.bottom = mb;
  }
  doc.end();
  return new Promise((res) => doc.on('end', () => res({ buffer: Buffer.concat(chunks), pages: range.count, chapterPages })));
}

export async function pdfLayout(book) {
  const model = buildBookModel(book); const first = await renderPass(model);
  const second = await renderPass(model, first.chapterPages);
  return { ...second, chapterPages: first.chapterPages };
}
export async function exportPdf(book) { return (await pdfLayout(book)).buffer; }
