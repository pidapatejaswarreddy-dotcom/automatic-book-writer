// Page planning: page count is a TARGET. We reserve front/back matter, distribute the rest
// across chapters, and convert pages to word targets using per-type density.
import { getTemplate } from '../templates/index.js';

export const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function reservedPages(book) {
  return { cover: 1, title: 1, copyright: book.targetPages >= 25 ? 1 : 0, toc: 1 };
}

function distribute(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; diff > 0; k = (k + 1) % order.length, diff--) out[order[k][1]]++;
  for (let k = 0; diff < 0 && k < 1000; k++) { const i = out.indexOf(Math.max(...out)); if (out[i] > 1) { out[i]--; diff++; } else break; }
  return out;
}

export function planBook(book, outline) {
  const t = getTemplate(book.bookType);
  const res = reservedPages(book);
  const front = Object.values(res).reduce((a, b) => a + b, 0);
  const usable = Math.max(3, book.targetPages - front);
  const entries = [];
  if (t.intro) entries.push({ kind: 'intro', title: outline.intro?.title || t.intro.title, sections: [], weight: 0.6 });
  outline.chapters.forEach((c, i) => entries.push({ kind: 'chapter', outlineId: c.id, number: i + 1, title: c.title, sections: c.sections, weight: 1 + Math.sqrt(Math.max(1, c.sections.length)) * 0.3 }));
  if (t.outro) entries.push({ kind: 'outro', title: outline.outro?.title || t.outro.title, sections: [], weight: 0.6 });
  if (t.references) entries.push({ kind: 'references', title: 'References', sections: [], weight: 0.35 });

  const pages = distribute(usable, entries.map((e) => e.weight));
  const notes = [];
  const wpp = t.wordsPerPage;
  const chapters = entries.map((e, i) => {
    const targetPages = pages[i];
    const isBody = e.kind === 'chapter';
    const diagrams = isBody ? Math.min(t.diagrams.perChapter, Math.max(0, Math.floor(targetPages / 4))) : 0;
    const exCfg = isBody && t.extras.examples;
    const examples = exCfg ? Math.min(exCfg.perChapter + Math.floor(targetPages / 12), 6) : 0;
    const exercises = isBody && t.extras.exercises ? t.extras.exercises.count + Math.floor(targetPages / 15) : 0;
    const summary = isBody && t.extras.summary ? 1 : 0;
    const fixedWords = examples * 170 + exercises * 30 + summary * 90;
    const textPages = Math.max(0.5, targetPages - diagrams * 0.4);
    const targetWords = e.kind === 'references' ? Math.round(targetPages * wpp * 0.5) : Math.max(120, Math.round(textPages * wpp - fixedWords));
    let sections = e.sections.map((s) => ({ id: s.id || uid('s'), title: s.title }));
    if (isBody) {
      // Large page targets are met by adding depth (extra sections), never by padding.
      const perSection = targetWords / Math.max(1, sections.length);
      if (perSection > 750) {
        const extra = Math.min(t.expansionSections.length, Math.ceil(targetWords / 650) - sections.length);
        for (let k = 0; k < extra; k++) sections.push({ id: uid('s'), title: `${e.title}: ${t.expansionSections[k]}` });
        if (extra > 0) notes.push(`Added ${extra} deeper section(s) to "${e.title}" to reach the page target with real content.`);
      }
    }
    const per = Math.round(targetWords / Math.max(1, sections.length || 1));
    sections = sections.map((s) => ({ ...s, targetWords: Math.max(80, per) }));
    if (!sections.length) sections = [{ id: uid('s'), title: e.title, targetWords }];
    return { id: uid('c'), number: e.number || null, kind: e.kind, title: e.title, targetPages, targetWords, sections, examples, diagrams, exercises, summary };
  });
  if (book.targetPages / Math.max(1, outline.chapters.length) > 30) notes.push('Very long chapters: consider more chapters for easier reading.');
  return { reserved: res, usablePages: usable, wordsPerPage: wpp, chapters, notes, createdAt: new Date().toISOString() };
}

export function estimatePages(book, words) {
  const t = getTemplate(book.bookType);
  const r = reservedPages(book);
  return Math.max(1, Math.round(words / (t?.wordsPerPage || 320)) + Object.values(r).reduce((a, b) => a + b, 0));
}
