// AI service layer. Everything the app needs from "an AI" goes through these methods,
// so the provider (Anthropic / OpenAI-compatible / demo) can be swapped without touching the app.
import { getTemplate } from '../templates/index.js';
import * as P from './prompts.js';
import { extractJson, normalizeOutline, parseSectionOutput, safeJson } from './parse.js';
import { contextForPrompt } from './context.js';
import { mock } from './mock/index.js';
import { anthropicProvider } from './providers/anthropic.js';
import { openaiProvider } from './providers/openai.js';
import { uid } from './planner.js';

export class AIError extends Error { constructor(message, cause) { super(message); this.name = 'AIError'; this.cause = cause; } }

const KIND_FOR = { chapter: 'body', intro: 'intro', outro: 'outro', references: 'references' };
const outlineText = (book) => (book.chapters || []).filter((c) => c.kind === 'chapter').map((c) => `${c.number}. ${c.title} [${c.sections.filter((s) => !s.extra).map((s) => s.title).join('; ')}]`).join(' | ');

export function createAIService(env = process.env) {
  const key = (env.AI_API_KEY || '').trim();
  const providerName = (env.AI_PROVIDER || 'anthropic').toLowerCase();
  const demo = !key || env.DEMO_MODE === 'true';
  const model = env.AI_MODEL || (providerName === 'openai' ? 'gpt-4o' : 'claude-sonnet-5-5');
  const provider = demo ? null : providerName === 'openai' ? openaiProvider({ apiKey: key, model, baseUrl: env.AI_BASE_URL, reasoningEffort: env.AI_REASONING_EFFORT }) : anthropicProvider({ apiKey: key, model, baseUrl: env.AI_BASE_URL });

  const call = async (book, prompt, maxTokens) => {
    try { return await provider.complete({ system: P.system(book), prompt, maxTokens }); }
    catch (e) { throw new AIError('AI request failed', e); }
  };
  const tokensFor = (words) => Math.min(8000, Math.max(1200, Math.round(words * 3 + 800)));
  const json = async (book, prompt, maxTokens = 3000) => {
    const text = await call(book, prompt, maxTokens);
    try { return extractJson(text); } catch (e) { throw new AIError('AI returned an unreadable response', e); }
  };

  const svc = {
    demo, provider: demo ? 'demo' : providerName, model: demo ? null : model,

    async generateTitle({ topic, bookType, language }) {
      if (demo) return mock.title({ topic });
      const r = await json({ language }, P.titlePrompt({ topic, bookType }), 400);
      return { title: String(r.title || topic).slice(0, 140), subtitle: String(r.subtitle || '').slice(0, 200) };
    },

    async analyzeTopic(book) {
      const t = getTemplate(book.bookType);
      const a = demo ? await mock.analyzeTopic(book, t) : await json(book, P.analysisPrompt(book, t), 2500);
      const arr = (v) => (Array.isArray(v) ? v.map(String).slice(0, 12) : []);
      return {
        mainConcept: String(a.mainConcept || book.topic), importantConcepts: arr(a.importantConcepts), subtopics: arr(a.subtopics), relatedTopics: arr(a.relatedTopics),
        applications: arr(a.applications), examples: arr(a.examples), potentialDiagrams: arr(a.potentialDiagrams), potentialQuestions: arr(a.potentialQuestions), potentialCalculations: arr(a.potentialCalculations),
        characters: Array.isArray(a.characters) ? a.characters.slice(0, 8) : undefined, locations: a.locations ? arr(a.locations) : undefined, plotPoints: a.plotPoints ? arr(a.plotPoints) : undefined,
      };
    },

    async generateOutline(book, analysis) {
      const t = getTemplate(book.bookType);
      if (demo) return mock.generateOutline(book, t);
      const raw = await json(book, P.outlinePrompt(book, t, analysis), 3500);
      try { return normalizeOutline(raw, { template: t, topic: book.topic, targetChapters: book.targetChapters }); }
      catch (e) { throw new AIError('Outline could not be built', e); }
    },

    // One section (or examples / exercises / summary block) of a chapter.
    async generateSection({ book, chapter, section, kind, context }) {
      const t = getTemplate(book.bookType);
      if (demo) return mock.section({ book, t, chapter, section, kind, ctx: context });
      const words = kind === 'body' || kind === 'intro' || kind === 'outro' ? section.targetWords : 400;
      const text = await call(book, P.sectionPrompt(book, t, chapter, section, kind, contextForPrompt(context, outlineText(book))), tokensFor(words));
      const { content, meta } = parseSectionOutput(text);
      if (!content) throw new AIError('Empty section returned');
      return { content, meta: meta || {} };
    },

    generateExamples(args) { return svc.generateSection({ ...args, kind: 'examples' }); },
    generateQuestions(args) { return svc.generateSection({ ...args, kind: 'exercises' }); },

    // Generates a whole chapter section by section. `onSection` lets the caller persist progress.
    async generateChapter({ book, chapter, context, onSection, shouldStop }) {
      const t = getTemplate(book.bookType);
      const bodyKind = KIND_FOR[chapter.kind];
      const collected = { terms: [], facts: [], formulas: [], characters: [], locations: [], events: [] };
      const merge = (m = {}) => Object.keys(collected).forEach((k) => Array.isArray(m[k]) && collected[k].push(...m[k]));
      const chapterCtx = { ...chapter, sections: chapter.sections.filter((s) => !s.extra) };
      const jobs = chapterCtx.sections.filter((s) => !s.done).map((s) => ({ section: s, kind: bodyKind }));
      const extras = [];
      const ex = t.extras;
      if (chapter.kind === 'chapter') {
        if (ex.examples && chapter.examples && !chapter.sections.some((s) => s.extra === 'examples')) extras.push({ extra: 'examples', title: ex.examples.heading, kind: 'examples' });
        if (ex.exercises && chapter.exercises && !chapter.sections.some((s) => s.extra === 'exercises')) extras.push({ extra: 'exercises', title: ex.exercises.heading, kind: 'exercises' });
        if (ex.summary && chapter.summary && !chapter.sections.some((s) => s.extra === 'summary')) extras.push({ extra: 'summary', title: ex.summary.heading, kind: 'summary' });
      }
      for (const j of jobs) {
        if (shouldStop?.()) return { stopped: true, meta: collected };
        const r = await svc.generateSection({ book, chapter: chapterCtx, section: j.section, kind: j.kind, context });
        merge(r.meta); await onSection({ id: j.section.id, content: r.content });
      }
      for (const e of extras) {
        if (shouldStop?.()) return { stopped: true, meta: collected };
        const section = { id: uid('s'), title: e.title, targetWords: 200 };
        const r = await svc.generateSection({ book, chapter: chapterCtx, section, kind: e.kind, context });
        merge(r.meta); await onSection({ id: section.id, title: e.title, content: r.content, extra: e.extra, isNew: true });
      }
      return { stopped: false, meta: collected };
    },

    async summarizeChapter({ book, chapter }) {
      const text = chapter.sections.map((s) => s.content).join('\n\n');
      if (demo) return mock.summarize({ chapter, text });
      try { return (await json(book, P.summaryPrompt(book, chapter, text), 800)); } catch { return await mock.summarize({ chapter, text }); }
    },

    // Model-based review; local rule checks live in ai/validator.js
    async checkContent({ book, text }) {
      if (demo) return [];
      try { const r = await json(book, P.checkPrompt(book, text), 1500); return Array.isArray(r.issues) ? r.issues : []; } catch { return []; }
    },

    async improveContent({ book, action, text }) {
      if (demo) return mock.improve(action, text);
      const out = await call(book, P.improvePrompt(book, action, text), tokensFor(text.split(/\s+/).length * 1.6));
      if (!out.trim()) throw new AIError('Empty revision');
      return out.trim();
    },
  };
  return svc;
}

let singleton;
export const getAI = () => (singleton ||= createAIService());
export const resetAI = () => { singleton = undefined; };
