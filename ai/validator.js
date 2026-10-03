// Local, deterministic content checks (no AI needed). Each issue may carry a `fix` the app can apply.
import { parseFigure, countWords } from '../shared/content.js';
import { getTemplate } from '../templates/index.js';

const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const FICTION = ['novel', 'short-stories'];

const proseOnly = (text) => text.replace(/```[\s\S]*?```/g, ' ').replace(/^\s*\[\[FIGURE.*$/gim, ' ').replace(/^\s*:::.*$/gm, ' ').replace(/\$\$.*?\$\$/g, ' ');

export function applyLocalGrammar(text) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((p, i) => (i % 2 ? p : p
    .replace(/(\S)[ \t]{2,}(?=\S)/g, '$1 ')
    .replace(/\b([A-Za-z]{2,})\s+\1\b/g, '$1')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()))).join('');
}

const lev1 = (a, b) => { if (Math.abs(a.length - b.length) > 1 || a === b) return false; let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i); };

export function validateBook(book) {
  const t = getTemplate(book.bookType);
  const issues = []; const seen = new Map();
  const ctx = book.context || {};
  const add = (i) => issues.push({ status: 'open', severity: 'warning', fix: null, ...i, id: `${i.category.replace(/\W/g, '')}-${hash(`${i.sectionId}|${i.message}|${i.fix?.find || ''}`)}` });
  const chapters = book.chapters || [];
  const figureNumbers = new Set();
  chapters.forEach((c) => { let n = 0; c.sections.forEach((s) => { (s.content || '').split('\n').forEach((l) => { if (parseFigure(l)) figureNumbers.add(`${c.number || ''}.${++n}`); }); }); });

  for (const c of chapters) {
    for (const s of c.sections) {
      const at = { chapterId: c.id, sectionId: s.id, location: `${c.title} › ${s.title}` };
      const text = s.content || '';
      if (countWords(text) < 15) { add({ ...at, category: 'Missing sections', severity: 'error', message: `"${s.title}" is empty or nearly empty.`, fix: { type: 'regenerate' } }); continue; }
      const prose = proseOnly(text);
      // Repetition
      prose.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 60).forEach((sent) => {
        const k = sent.toLowerCase();
        if (seen.has(k) && !FICTION.includes(book.bookType) && !/^(the key relationship|to see how)/i.test(sent)) add({ ...at, category: 'Repetition', message: `Sentence repeated from "${seen.get(k)}": "${sent.slice(0, 70)}…"`, fix: { type: 'removeText', find: sent } });
        else seen.set(k, s.title);
      });
      // Grammar / spelling basics
      const fixed = applyLocalGrammar(text);
      if (fixed !== text) add({ ...at, category: 'Grammar', message: 'Spacing, repeated-word or capitalisation slips found.', fix: { type: 'localGrammar' } });
      // Formatting
      if ((text.match(/^```/gm) || []).length % 2) add({ ...at, category: 'Formatting', severity: 'error', message: 'A code block is not closed.', fix: { type: 'replace', find: text, replace: text + '\n```' } });
      const opens = (text.match(/^:::[ \t]*[a-z]+/gim) || []).length, closes = (text.match(/^:::[ \t]*$/gm) || []).length;
      if (opens !== closes) add({ ...at, category: 'Formatting', severity: 'error', message: 'A callout box is not closed.', fix: { type: 'replace', find: text, replace: text + '\n:::' } });
      if ((text.match(/\$\$/g) || []).length % 2) add({ ...at, category: 'Formatting', message: 'Unbalanced $$ formula markers.' });
      text.split('\n').filter((l) => /\[\[\s*FIGURE/i.test(l) && !parseFigure(l)).forEach((l) => add({ ...at, category: 'Broken references', message: 'A diagram request is malformed and will not render.', fix: { type: 'removeText', find: l } }));
      for (const m of text.matchAll(/\bFigure (\d+\.\d+)\b/g)) if (!figureNumbers.has(m[1])) add({ ...at, category: 'Broken references', message: `Text refers to Figure ${m[1]}, which does not exist.` });
      for (const m of text.matchAll(/\bChapter (\d+)\b/g)) if (+m[1] > book.chapters.filter((x) => x.kind === 'chapter').length) add({ ...at, category: 'Broken references', message: `Text refers to Chapter ${m[1]}, which does not exist.` });
      // Technical
      if (book.bookType === 'technical') {
        let inside = false;
        for (const l of text.split('\n')) { if (l.trim().startsWith('```')) { if (!inside && l.trim() === '```') { add({ ...at, category: 'Code blocks', message: 'A code block has no language tag.' }); break; } inside = !inside; } }
      }
    }
    // Topic relevance & outline coverage
    if (!FICTION.includes(book.bookType) && c.kind === 'chapter') {
      const words = c.sections.reduce((n, s) => n + countWords(s.content), 0);
      const kw = book.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const body = c.sections.map((s) => s.content).join(' ').toLowerCase();
      if (words > 150 && kw.length && !kw.some((k) => body.includes(k)) && !body.includes(c.title.toLowerCase().split(' ')[0])) add({ chapterId: c.id, sectionId: c.sections[0]?.id, location: c.title, category: 'Topic relevance', message: `"${c.title}" never mentions the book topic; check it stays on subject.` });
    }
    // Fiction consistency
    if (FICTION.includes(book.bookType) && c.kind === 'chapter') {
      const body = c.sections.map((s) => s.content).join(' ');
      const names = (ctx.characters || []).map((x) => x.name).filter(Boolean);
      if (names.length && !names.some((n) => body.includes(n))) add({ chapterId: c.id, sectionId: c.sections[0]?.id, location: c.title, category: 'Character consistency', message: 'No known character appears in this chapter.' });
      const caps = new Set(body.match(/\b[A-Z][a-z]{3,}\b/g) || []);
      names.forEach((n) => caps.forEach((w) => { if (lev1(n, w)) add({ chapterId: c.id, sectionId: c.sections.find((s) => (s.content || '').includes(w))?.id, location: c.title, category: 'Character consistency', message: `"${w}" looks like a misspelling of the character "${n}".`, fix: { type: 'replaceAll', find: w, replace: n } }); }));
      if ((ctx.locations || []).length && !ctx.locations.some((l) => body.toLowerCase().includes(String(l).toLowerCase()))) add({ chapterId: c.id, sectionId: c.sections[0]?.id, location: c.title, category: 'Location consistency', severity: 'info', message: 'None of the established locations are mentioned here.' });
    }
  }
  // Terminology consistency (defined terms used with inconsistent capitalisation)
  if (!FICTION.includes(book.bookType)) {
    const all = chapters.flatMap((c) => c.sections.map((s) => ({ c, s })));
    for (const { term } of (ctx.terms || []).slice(0, 40)) {
      if (!term || term.length < 4 || !(/[A-Z]/.test(term.slice(1)) || term === term.toUpperCase())) continue;
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'); const counts = {};
      all.forEach(({ s }) => (s.content || '').replace(/```[\s\S]*?```/g, '').match(re)?.forEach((m) => { counts[m] = (counts[m] || 0) + 1; }));
      const forms = Object.keys(counts);
      if (forms.length > 1 && (book.bookType === 'technical' || forms.some((f) => f === f.toUpperCase()))) {
        const canon = forms.sort((a, b) => counts[b] - counts[a])[0];
        const bad = forms.filter((f) => f !== canon);
        const target = all.find(({ s }) => bad.some((b) => (s.content || '').includes(b)));
        if (target) add({ chapterId: target.c.id, sectionId: target.s.id, location: `${target.c.title} › ${target.s.title}`, category: 'Terminology', message: `"${term}" is written as ${forms.map((f) => `"${f}"`).join(' and ')}; use "${canon}" consistently.`, fix: { type: 'replaceAllBook', find: bad[0], replace: canon } });
      }
    }
  }
  return issues;
}
