// Turns a stored book into a format-neutral document model used by the PDF, DOCX and TXT exporters.
import { parseBlocks } from '../shared/content.js';
import { getTemplate } from '../templates/index.js';
import { getLanguage } from '../config/languages.js';
import { getCoverStyle } from '../shared/covers.js';

const FICTION = ['novel', 'short-stories'];

export function buildBookModel(book) {
  const t = getTemplate(book.bookType);
  const lang = getLanguage(book.language) || getLanguage('en');
  const chapters = [];
  for (const c of book.chapters) {
    const blocks = []; let sec = 0, fig = 0;
    for (const s of c.sections) {
      if (!(s.content || '').trim()) continue;
      const redundant = c.kind !== 'chapter' && c.sections.length === 1 && s.title === c.title;
      if ((!FICTION.includes(book.bookType) || s.extra) && !redundant) {
        const num = c.kind === 'chapter' && !s.extra && c.sections.length > 1 ? `${c.number}.${++sec} ` : '';
        blocks.push({ type: 'sectionTitle', text: `${num}${s.title}`, extra: !!s.extra });
      }
      const walk = (bs) => bs.forEach((b) => { if (b.type === 'figure') b.number = `${c.number || (c.kind === 'intro' ? 'I' : 'C')}.${++fig}`; if (b.type === 'box') walk(b.blocks); });
      const parsed = parseBlocks(s.content); walk(parsed); blocks.push(...parsed);
    }
    chapters.push({ id: c.id, kind: c.kind, number: c.number, label: c.kind === 'chapter' ? `${t.chapterLabel} ${c.number}` : null, title: c.title, blocks });
  }
  return {
    title: book.title, subtitle: book.subtitle || '', author: book.author || '', language: lang, bookType: book.bookType, topic: book.topic,
    copyright: book.copyright || `© ${new Date().getFullYear()} ${book.author || ''}. All rights reserved.`, showCopyright: book.targetPages >= 25 || !!book.copyright,
    cover: getCoverStyle(book.coverStyle), chapters,
    toc: chapters.map((c) => ({ id: c.id, text: c.label ? `${c.label}: ${c.title}` : c.title, kind: c.kind })),
  };
}
export const safeFilename = (title) => (String(title).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'book');
