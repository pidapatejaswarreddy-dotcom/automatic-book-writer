// Structured book context: keeps chapters consistent (terms, facts, characters, formulas...).
export function createContext(book, analysis = {}) {
  return {
    topic: book.topic, bookType: book.bookType, audience: book.audience, style: book.style, tone: book.tone,
    chapterSummaries: [], terms: [], facts: [], definitions: [], formulas: [], variables: [],
    characters: (analysis.characters || []).map((c) => ({ ...c })), relationships: analysis.relationships || [],
    locations: analysis.locations || [], timeline: [], events: [], plotPoints: analysis.plotPoints || [],
  };
}
const uniq = (arr, key = (x) => JSON.stringify(x)) => { const seen = new Set(); return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); };

export function updateContext(ctx, chapter, meta = {}) {
  const c = { ...ctx };
  c.chapterSummaries = [...ctx.chapterSummaries.filter((s) => s.chapterId !== chapter.id), { chapterId: chapter.id, number: chapter.number, title: chapter.title, summary: meta.summary || '' }];
  const add = (k, items, key) => { if (items?.length) c[k] = uniq([...(ctx[k] || []), ...items], key); };
  add('terms', meta.terms, (x) => (x.term || '').toLowerCase());
  add('facts', meta.facts, (x) => String(x).toLowerCase());
  add('formulas', meta.formulas);
  add('variables', meta.variables, (x) => JSON.stringify(x).toLowerCase());
  add('events', meta.events, (x) => String(x).toLowerCase());
  add('timeline', meta.timeline);
  add('locations', meta.locations, (x) => String(x).toLowerCase());
  add('characters', meta.characters, (x) => (x.name || '').toLowerCase());
  return c;
}

// Compact text version for prompts (bounded so long books do not overflow the model context).
export function contextForPrompt(ctx, outline, maxSummaries = 12) {
  const sums = ctx.chapterSummaries.slice(-maxSummaries).map((s) => `- ${s.title}: ${s.summary}`).join('\n') || '(none yet)';
  const lines = [`Topic: ${ctx.topic}`, `Type: ${ctx.bookType}; audience: ${ctx.audience}; style: ${ctx.style}; tone: ${ctx.tone}`, `Outline: ${outline}`, `Previous chapter summaries:\n${sums}`];
  if (ctx.terms.length) lines.push('Key terms: ' + ctx.terms.slice(-30).map((t) => `${t.term}${t.definition ? ` (${t.definition})` : ''}`).join('; '));
  if (ctx.facts.length) lines.push('Established facts: ' + ctx.facts.slice(-20).join('; '));
  if (ctx.formulas.length) lines.push('Formulas used: ' + ctx.formulas.slice(-20).join('; '));
  if (ctx.characters.length) lines.push('Character bible: ' + ctx.characters.map((c) => `${c.name} (${c.role || ''}; ${c.traits || ''})`).join('; '));
  if (ctx.locations.length) lines.push('Locations: ' + ctx.locations.join('; '));
  if (ctx.events.length) lines.push('Events so far: ' + ctx.events.slice(-15).join('; '));
  return lines.join('\n');
}
