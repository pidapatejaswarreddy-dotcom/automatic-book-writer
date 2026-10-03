import { getLanguage } from '../config/languages.js';
import { hasTemplate } from '../templates/index.js';
import { AUDIENCES, STYLES, TONES, DIFFICULTIES, PAGE_LIMITS, CHAPTER_LIMITS, IMPROVE_ACTIONS } from '../config/options.js';
import { badRequest } from './errors.js';

// Strip control characters and cap length. Output is only ever rendered via textContent/DOM builders or exported, never as raw HTML.
export const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanBlock = (v, max = 60000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').slice(0, max);

export function validateInfo(body, { partial = false } = {}) {
  const out = {}; const errors = {};
  const need = (k, label) => { if (!partial || k in body) { const v = clean(body[k], k === 'topic' ? 300 : 160); if (!v) errors[k] = `${label} is required.`; else out[k] = v; } };
  need('topic', 'Topic'); need('title', 'Book title'); need('author', 'Author name');
  if ('subtitle' in body) out.subtitle = clean(body.subtitle, 200);
  if (!partial || 'language' in body) { const l = getLanguage(body.language || 'English'); if (!l) errors.language = 'That language is not supported yet.'; else out.language = l.name; }
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields.', errors);
  return out;
}

export function validateType(body) {
  if (!hasTemplate(body.bookType)) throw badRequest('Choose a book type to continue.', { bookType: 'Choose a book type.' });
  return { bookType: body.bookType };
}

export function validateSettings(body, template) {
  const errors = {}; const out = {};
  const int = (k, lim, label) => { const n = Number(body[k]); if (!Number.isInteger(n) || n < lim.min || n > lim.max) errors[k] = `${label} must be a whole number between ${lim.min} and ${lim.max}.`; else out[k] = n; };
  int('targetPages', PAGE_LIMITS, 'Number of pages'); int('targetChapters', CHAPTER_LIMITS, `Number of ${template.chapterLabel.toLowerCase()}s`);
  const pick = (k, list, label, rel = true) => { if (!rel) { out[k] = template.defaults[k]; return; } const v = clean(body[k], 40); if (!list.includes(v)) errors[k] = `Choose a valid ${label}.`; else out[k] = v; };
  pick('audience', AUDIENCES, 'target audience', template.settings.audience); pick('style', STYLES, 'writing style', template.settings.style);
  pick('tone', TONES, 'tone', template.settings.tone); pick('difficulty', DIFFICULTIES, 'difficulty level', template.settings.difficulty);
  if (!errors.targetPages && !errors.targetChapters && out.targetChapters * 2 > out.targetPages) errors.targetChapters = 'That is too many chapters for so few pages.';
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted settings.', errors);
  return out;
}

export function validateOutline(body) {
  const chapters = Array.isArray(body.chapters) ? body.chapters : [];
  if (!chapters.length || chapters.length > 40) throw badRequest('The outline needs between 1 and 40 chapters.');
  const id = (v, p) => (/^[\w-]{3,40}$/.test(v || '') ? v : `${p}_${Math.random().toString(36).slice(2, 9)}`);
  return {
    intro: body.intro ? { title: clean(body.intro.title, 140) || 'Introduction' } : null,
    outro: body.outro ? { title: clean(body.outro.title, 140) || 'Conclusion' } : null,
    references: !!body.references,
    chapters: chapters.map((c) => {
      const title = clean(c.title, 140); if (!title) throw badRequest('Every chapter needs a title.');
      const sections = (Array.isArray(c.sections) ? c.sections : []).slice(0, 15).map((s) => ({ id: id(s.id, 's'), title: clean(s.title, 140) })).filter((s) => s.title);
      if (!sections.length) throw badRequest(`"${title}" needs at least one section.`);
      return { id: id(c.id, 'o'), title, sections };
    }),
  };
}

export const validateAction = (a) => { if (!IMPROVE_ACTIONS.includes(a)) throw badRequest('Unknown editing action.'); return a; };
export const validId = (id) => /^[a-z0-9_-]{6,40}$/i.test(id || '');
