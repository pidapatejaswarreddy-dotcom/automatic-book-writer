import { uid } from './planner.js';

export function extractJson(text) {
  const t = String(text || '').replace(/```json|```/gi, '');
  const start = t.search(/[{[]/);
  if (start < 0) throw new Error('No JSON in AI response');
  const open = t[start], close = open === '{' ? '}' : ']';
  const end = t.lastIndexOf(close);
  return JSON.parse(t.slice(start, end + 1));
}

const clean = (s, n = 140) => String(s || '').replace(/^\s*(chapter\s*\d+\s*[-—:.]*|\d+(\.\d+)*[.)]?\s+)/i, '').replace(/\s+/g, ' ').trim().slice(0, n);

// Accepts loosely-shaped AI output and returns a strict outline with ids and >= minSections per chapter.
export function normalizeOutline(raw, { template, topic, targetChapters }) {
  const list = Array.isArray(raw) ? raw : raw?.chapters || [];
  let chapters = list.map((c) => ({
    id: c.id || uid('o'), title: clean(c.title || c.name) || 'Untitled Chapter',
    sections: (c.sections || c.subsections || []).map((s) => ({ id: s.id || uid('s'), title: clean(typeof s === 'string' ? s : s.title || s.name) })).filter((s) => s.title),
  }));
  chapters = chapters.slice(0, Math.max(targetChapters, 1));
  chapters.forEach((c) => {
    let i = 0;
    while (c.sections.length < template.minSections) c.sections.push({ id: uid('s'), title: `${c.title}: ${template.expansionSections[i++ % template.expansionSections.length]}` });
  });
  if (!chapters.length) throw new Error('Outline was empty');
  return {
    intro: template.intro ? { title: clean(raw?.intro?.title || raw?.intro) || template.intro.title } : null,
    chapters,
    outro: template.outro ? { title: clean(raw?.outro?.title || raw?.conclusion) || template.outro.title } : null,
    references: !!template.references,
  };
}

export function parseSectionOutput(text) {
  const m = String(text).split(/^===META===\s*$/m);
  return { content: m[0].trim(), meta: m[1] ? safeJson(m[1]) : null };
}
export function safeJson(t) { try { return extractJson(t); } catch { return null; } }
