// All prompt text lives here (never inside UI components). Type-specific behaviour comes from the template.
import { getLanguage } from '../config/languages.js';

const FORMAT = `Output format (plain text, no preamble):
- Paragraphs separated by blank lines. Sub-headings: "### Heading". Lists: "- item" or "1. item".
- Code: fenced blocks with a language tag. Tables: pipe tables. Formulas on their own line: $$ formula $$.
- Callout boxes: a line ":::example Title" (kinds: example, keypoints, note, exercise, answer, summary, case), content, then ":::".
- Diagram (only when it truly helps): one line "[[FIGURE: type | Caption | node 1; node 2; node 3]]"; types: flowchart, process, block, architecture, cycle, timeline, comparison, hierarchy, concept-map. For comparison use two nodes "Left title: a, b, c; Right title: d, e, f". For hierarchy the first node is the root.
- Use **bold** and *italic* sparingly. Do not repeat the section title as a heading.`;

export const system = (book) => {
  const lang = getLanguage(book.language)?.name || 'English';
  return `You are a professional book author and editor. Write the entire response in ${lang}. Quality and factual accuracy matter more than length; never pad with filler or repetition, never invent statistics, quotes or sources.`;
};

const brief = (b) => `Book: "${b.title}"${b.subtitle ? ` — ${b.subtitle}` : ''}\nTopic: ${b.topic}\nType: ${b.bookType}\nAudience: ${b.audience}\nWriting style: ${b.style}\nTone: ${b.tone}\nDifficulty: ${b.difficulty}`;

export const titlePrompt = ({ topic, bookType }) => `Suggest 1 compelling book title and 1 subtitle for a ${bookType || ''} book about "${topic}". Respond ONLY as JSON: {"title":"...","subtitle":"..."}`;

export const analysisPrompt = (b, t) => `${brief(b)}\n\nAnalyse the topic for a ${t.name} book. ${t.analysisFocus}\nRespond ONLY as JSON with keys: mainConcept (string), importantConcepts[], subtopics[], relatedTopics[], applications[], examples[], potentialDiagrams[], potentialQuestions[], potentialCalculations[]${['novel', 'short-stories'].includes(t.id) ? ', characters[{name,role,traits}], locations[], plotPoints[]' : ''}.`;

export const outlinePrompt = (b, t, analysis) => `${brief(b)}\nTarget length: about ${b.targetPages} pages in exactly ${b.targetChapters} main ${t.chapterLabel.toLowerCase()}s.\nTopic analysis: ${JSON.stringify(analysis).slice(0, 3500)}\n\nRules: ${t.outlineRules}\nRespond ONLY as JSON: {"chapters":[{"title":"...","sections":["...","..."]}]} with exactly ${b.targetChapters} chapters and 3-5 sections each (${t.minSections}+ minimum). Titles must not include chapter numbers. Introduction, conclusion and references are added automatically.`;

const KIND = {
  body: (t, s, ch) => `Write the section "${s.title}" of ${t.chapterLabel.toLowerCase()} "${ch.title}". Target about ${s.targetWords} words.\nType-specific writing guide: ${t.writingGuide}\nDiagram rules: ${t.diagramRules} ${ch.diagrams ? `This chapter should contain about ${ch.diagrams} diagram(s) in total — place one here only if this section suits it.` : 'Do not add diagrams.'}`,
  examples: (t, s, ch) => `Write ${ch.examples} worked example(s) for ${t.chapterLabel.toLowerCase()} "${ch.title}", each in an ":::example Title" box. Rules: ${t.exampleRules} Show every step; check all arithmetic and code carefully. Target about ${ch.examples * 170} words.`,
  exercises: (t, s, ch) => `Write ${ch.exercises} ${t.extras.exercises?.heading?.toLowerCase()} for "${ch.title}" as a numbered list. Rules: ${t.exerciseRules}${t.extras.exercises?.answers ? ' After the list add a ":::answer Answers" box with the correct answers and brief working.' : ''}`,
  summary: (t, s, ch) => `Write "${t.extras.summary?.heading}" for "${ch.title}": one short paragraph plus a ":::keypoints Key Points" box with 3-5 bullets.`,
  intro: (t, s, ch, b) => `Write the ${ch.title.toLowerCase()} for the book "${b.title}": why the topic matters, who the book is for, what the reader will gain, and how the book is organised. About ${s.targetWords} words.`,
  outro: (t, s, ch, b) => `Write the ${ch.title.toLowerCase()} of the book "${b.title}": bring the themes together and leave the reader with a strong close. About ${s.targetWords} words. ${['novel', 'short-stories'].includes(t.id) ? 'Write it as story prose.' : ''}`,
  references: (t, s, ch, b) => `List 6-10 real, well-known, verifiable sources (books, standards, reputable organisations) a reader could consult about "${b.topic}", as a numbered list. If unsure a source exists, omit it. Add one note line recommending verification.`,
};

export const sectionPrompt = (b, t, ch, s, kind, ctxText) =>
  `${brief(b)}\n\nBOOK CONTEXT (stay consistent with it):\n${ctxText}\n\nTASK: ${KIND[kind](t, s, ch, b)}\n\n${FORMAT}\n\nAfter the content, on a new line write ===META=== followed by JSON {"terms":[{"term":"","definition":""}],"facts":[""],"formulas":[""],"characters":[{"name":"","role":"","traits":""}],"locations":[""],"events":[""]} listing only NEW items introduced (empty arrays if none).`;

export const summaryPrompt = (b, ch, text) => `Summarise this chapter in 2 sentences and list new key terms. Respond ONLY as JSON {"summary":"","terms":[{"term":"","definition":""}],"facts":[""],"formulas":[""],"characters":[{"name":"","role":"","traits":""}],"locations":[""],"events":[""]}.\nChapter "${ch.title}":\n${text.slice(0, 9000)}`;

export const checkPrompt = (b, text) => `Review this book content for grammar, spelling, repetition, off-topic passages, contradictions and (for fiction) character/timeline inconsistencies. Respond ONLY as JSON {"issues":[{"category":"","message":"","find":"exact short text","replace":"corrected text or empty"}]} with at most 8 real issues; empty array if fine.\n\n${text.slice(0, 9000)}`;

const IMPROVE = {
  improve: 'Improve clarity, flow and word choice while keeping meaning and length similar.',
  rewrite: 'Rewrite completely in fresh wording while keeping all facts and structure.',
  expand: 'Expand with deeper explanation, a useful example or extra detail (about 50% longer). No filler.',
  shorten: 'Shorten by about 40%, keeping the essential points.',
  simplify: 'Simplify the language for a beginner; shorter sentences, no jargon.',
  professional: 'Make the tone professional and precise.',
  grammar: 'Fix grammar, spelling and punctuation only. Do not change wording otherwise.',
};
export const improvePrompt = (b, action, text) => `${brief(b)}\n\nTask: ${IMPROVE[action]}\nKeep the same content markup (headings, lists, code fences, ":::" boxes, [[FIGURE: ...]] lines, $$formulas$$). Return ONLY the revised text.\n\n${text}`;
