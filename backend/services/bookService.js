// Business logic: the whole workflow from info -> outline -> plan -> generation -> checks -> export stats.
import { getTemplate } from '../../templates/index.js';
import { getAI } from '../../ai/index.js';
import { planBook, uid, estimatePages } from '../../ai/planner.js';
import { createContext, updateContext } from '../../ai/context.js';
import { validateBook, applyLocalGrammar } from '../../ai/validator.js';
import { defaultCoverFor } from '../../shared/covers.js';
import { bookWordCount } from '../../shared/content.js';
import { AppError, badRequest, notFound } from '../errors.js';
import { log } from '../logger.js';
import { validateInfo, validateType, validateSettings, validateOutline, validateAction, cleanBlock, clean } from '../validation.js';

const FRIENDLY_AI = 'Something went wrong while talking to the AI service. Please try again.';
const running = new Map(); // bookId -> { stop: boolean }

export function createBookService(store) {
  const must = (id) => { const b = store.get(id); if (!b) throw notFound(); return b; };
  const aiCall = async (fn, what) => {
    try { return await fn(); } catch (e) { log.error(`AI failure: ${what}`, e); throw new AppError(502, 'AI_FAILED', FRIENDLY_AI); }
  };
  const findChapter = (b, cid) => b.chapters.find((c) => c.id === cid) || (() => { throw notFound('That chapter could not be found.'); })();
  const findSection = (c, sid) => c.sections.find((s) => s.id === sid) || (() => { throw notFound('That section could not be found.'); })();

  const svc = {
    list: (q) => store.list().filter((b) => !q || `${b.title} ${b.topic} ${b.author}`.toLowerCase().includes(String(q).toLowerCase())).map(summary),
    get: (id) => must(id),

    create(body) {
      const info = validateInfo(body);
      return store.create({ ...info, subtitle: info.subtitle || '', bookType: null, status: 'Draft', coverStyle: 'midnight', chapters: [], outline: null, plan: null, analysis: null, context: null, issues: [], generation: idleGeneration(), demo: getAI().demo });
    },
    updateInfo(id, body) { must(id); const info = validateInfo(body, { partial: true }); return store.update(id, (b) => { Object.assign(b, info); }); },
    setType(id, body) {
      must(id); const { bookType } = validateType(body); const t = getTemplate(bookType);
      return store.update(id, (b) => { if (b.bookType !== bookType) { b.outline = null; b.analysis = null; b.plan = null; b.chapters = []; b.generation = idleGeneration(); b.status = 'Draft'; } b.bookType = bookType; b.coverStyle = defaultCoverFor(bookType); Object.assign(b, b.audience ? {} : t.defaults); });
    },
    setSettings(id, body) {
      const b = must(id); if (!b.bookType) throw badRequest('Choose a book type first.'); const s = validateSettings(body, getTemplate(b.bookType));
      return store.update(id, (d) => { const changed = ['targetPages', 'targetChapters', 'audience', 'style', 'tone', 'difficulty'].some((k) => d[k] !== s[k]); Object.assign(d, s); if (changed && d.status !== 'Draft' && !d.chapters.some((c) => c.sections.some((x) => x.content))) { d.outline = null; d.analysis = null; d.plan = null; d.chapters = []; d.status = 'Draft'; } });
    },
    setCover(id, body) { must(id); return store.update(id, (b) => { if (body.coverStyle) b.coverStyle = clean(body.coverStyle, 20); if ('copyright' in body) b.copyright = clean(body.copyright, 400); Object.assign(b, validateInfo({ ...b, ...body }, { partial: true })); }); },
    rename(id, title) { must(id); const t = clean(title, 160); if (!t) throw badRequest('A title is required.'); return store.update(id, (b) => { b.title = t; }); },
    remove(id) { if (running.has(id)) running.get(id).stop = true; if (!store.remove(id)) throw notFound(); },

    async generateTitle(body) {
      const topic = clean(body.topic, 300); if (!topic) throw badRequest('Enter a topic first.', { topic: 'Enter a topic first.' });
      return aiCall(() => getAI().generateTitle({ topic, bookType: body.bookType, language: body.language || 'English' }), 'title');
    },

    async analyze(id) {
      const b = must(id); if (!b.bookType || !b.targetPages) throw badRequest('Finish the earlier steps first.');
      const analysis = await aiCall(() => getAI().analyzeTopic(b), 'analyzeTopic');
      return store.update(id, (d) => { d.analysis = analysis; });
    },
    async generateOutline(id) {
      let b = must(id); if (!b.analysis) b = await svc.analyze(id);
      if (b.chapters.some((c) => c.sections.some((s) => s.content))) throw badRequest('This book already has written content. Edit the chapters instead.');
      const outline = await aiCall(() => getAI().generateOutline(b, b.analysis), 'generateOutline');
      return store.update(id, (d) => { d.outline = outline; d.plan = null; d.chapters = []; d.status = 'Draft'; d.generation = idleGeneration(); });
    },
    saveOutline(id, body) {
      const b = must(id); if (b.chapters.some((c) => c.sections.some((s) => s.content))) throw badRequest('This book already has written content.');
      const outline = validateOutline(body); return store.update(id, (d) => { d.outline = outline; d.plan = null; });
    },

    // Approve -> content plan (pages -> words -> chapters -> sections) and empty chapter records.
    approve(id, body) {
      let b = must(id); if (body?.chapters) b = svc.saveOutline(id, body); if (!b.outline) throw badRequest('Create an outline first.');
      const plan = planBook(b, b.outline);
      return store.update(id, (d) => {
        d.plan = plan; d.status = 'Outline Ready';
        d.chapters = plan.chapters.map((p) => ({ id: p.id, number: p.number, kind: p.kind, title: p.title, targetPages: p.targetPages, targetWords: p.targetWords, examples: p.examples, diagrams: p.diagrams, exercises: p.exercises, summary: p.summary, status: 'pending', summary_text: '', sections: p.sections.map((s) => ({ id: s.id, title: s.title, targetWords: s.targetWords, content: '', done: false })) }));
        d.context = createContext(d, d.analysis || {});
        d.generation = { ...idleGeneration(), steps: buildSteps(d, 3) };
      });
    },

    // ---- generation job (runs in background; progress is persisted after every section) ----
    start(id) {
      const b = must(id); if (!b.plan) throw badRequest('Approve the outline first.');
      if (running.has(id)) return b;
      const job = { stop: false }; running.set(id, job);
      store.update(id, (d) => { d.status = 'Generating'; d.generation.state = 'running'; d.generation.error = null; if (!d.generation.steps.length) d.generation.steps = buildSteps(d, 3); });
      runGeneration(id, job).catch((e) => log.error('generation crashed', e)).finally(() => running.delete(id));
      return store.get(id);
    },
    stop(id) { const j = running.get(id); if (j) j.stop = true; return must(id); },
    isRunning: (id) => running.has(id),
    recoverInterrupted() { store.list().forEach((b) => { if (b.generation?.state === 'running') store.update(b.id, (d) => { d.generation.state = 'paused'; d.status = 'Generating'; d.generation.error = 'Generation was interrupted. Press Resume to continue.'; }); }); },

    // ---- editing ----
    renameChapter(id, cid, title) { const t = clean(title, 140); if (!t) throw badRequest('A title is required.'); must(id); return store.update(id, (b) => { findChapter(b, cid).title = t; markEditing(b); }); },
    saveSection(id, cid, sid, body) {
      must(id); return store.update(id, (b) => { const s = findSection(findChapter(b, cid), sid); if ('content' in body) s.content = cleanBlock(body.content); if ('title' in body) s.title = clean(body.title, 140) || s.title; markEditing(b); });
    },
    async improveSection(id, cid, sid, action, text) {
      const b = must(id); const c = findChapter(b, cid); const s = findSection(c, sid); validateAction(action);
      if (action === 'regenerate') return svc.regenerateSection(id, cid, sid);
      const out = await aiCall(() => getAI().improveContent({ book: b, action, text: cleanBlock(text ?? s.content) }), `improve:${action}`);
      return { content: out };
    },
    async regenerateSection(id, cid, sid) {
      const b = must(id); const c = findChapter(b, cid); const s = findSection(c, sid);
      const kind = s.extra || ({ chapter: 'body', intro: 'intro', outro: 'outro', references: 'references' })[c.kind];
      const r = await aiCall(() => getAI().generateSection({ book: b, chapter: { ...c, sections: c.sections.filter((x) => !x.extra) }, section: s, kind, context: b.context || createContext(b) }), 'regenerateSection');
      return { content: r.content };
    },
    markCompleted(id) { must(id); return store.update(id, (b) => { b.status = 'Completed'; }); },

    // ---- validation ----
    validate(id) {
      const b = must(id);
      const prev = new Map((b.issues || []).map((i) => [i.id, i.status]));
      const issues = validateBook(b).map((i) => ({ ...i, status: prev.get(i.id) === 'ignored' ? 'ignored' : 'open' }));
      return store.update(id, (d) => { d.issues = issues; }).issues;
    },
    async fixIssue(id, iid) {
      const b = must(id); const issue = (b.issues || []).find((i) => i.id === iid); if (!issue) throw notFound('That issue could not be found.');
      if (!issue.fix) throw badRequest('This issue needs a manual review.');
      let regen = null;
      if (issue.fix.type === 'regenerate') regen = (await svc.regenerateSection(id, issue.chapterId, issue.sectionId)).content;
      store.update(id, (d) => {
        const c = d.chapters.find((x) => x.id === issue.chapterId); const s = c?.sections.find((x) => x.id === issue.sectionId); if (!s) return;
        const f = issue.fix;
        if (f.type === 'localGrammar') s.content = applyLocalGrammar(s.content);
        else if (f.type === 'replace') s.content = s.content.replace(f.find, f.replace);
        else if (f.type === 'removeText') s.content = s.content.replace(f.find, '').replace(/\n{3,}/g, '\n\n');
        else if (f.type === 'replaceAll') s.content = s.content.split(f.find).join(f.replace);
        else if (f.type === 'replaceAllBook') d.chapters.forEach((cc) => cc.sections.forEach((ss) => { ss.content = (ss.content || '').split(f.find).join(f.replace); }));
        else if (f.type === 'regenerate') s.content = regen;
        d.issues.find((i) => i.id === iid).status = 'fixed'; markEditing(d);
      });
      return svc.validate(id);
    },
    ignoreIssue(id, iid) { must(id); return store.update(id, (d) => { const i = (d.issues || []).find((x) => x.id === iid); if (!i) return false; i.status = 'ignored'; }).issues; },
    async fixAll(id) { for (const i of (must(id).issues || []).filter((x) => x.status === 'open' && x.fix && x.fix.type !== 'regenerate')) { try { await svc.fixIssue(id, i.id); } catch (e) { log.warn('auto-fix failed', e); } } return must(id).issues; },

    stats(id, pageCount) {
      const b = must(id); const words = bookWordCount(b);
      return { chapters: b.chapters.filter((c) => c.kind === 'chapter').length, words, estimatedPages: pageCount || estimatePages(b, words), status: b.status };
    },
  };
  return svc;

  // ---------- internals ----------
  function markEditing(b) { if (['Generated', 'Completed'].includes(b.status)) b.status = 'Editing'; }

  async function runGeneration(id, job) {
    const ai = getAI();
    const fail = (label, e, cid) => { log.error(`generation failed at ${label}`, e); store.update(id, (d) => { d.generation.state = 'error'; d.generation.error = `Something went wrong while generating "${label}".`; const st = d.generation.steps.find((s) => s.status === 'active'); if (st) st.status = 'error'; const c = d.chapters.find((x) => x.id === cid); if (c) c.status = 'error'; }); };
    for (const ch of store.get(id).chapters) {
      if (job.stop) return pause(id);
      if (ch.status === 'done') continue;
      setStep(id, ch.id, 'active');
      store.update(id, (d) => { d.chapters.find((x) => x.id === ch.id).status = 'generating'; });
      try {
        const fresh = store.get(id); const cur = fresh.chapters.find((x) => x.id === ch.id);
        const res = await ai.generateChapter({
          book: fresh, chapter: cur, context: fresh.context, shouldStop: () => job.stop,
          onSection: async (s) => store.update(id, (d) => { const c = d.chapters.find((x) => x.id === ch.id); if (s.isNew) c.sections.push({ id: s.id, title: s.title, content: s.content, extra: s.extra, done: true, targetWords: 200 }); else { const t = c.sections.find((x) => x.id === s.id); t.content = s.content; t.done = true; } }),
        });
        if (res.stopped) return pause(id);
        const done = store.get(id); const dc = done.chapters.find((x) => x.id === ch.id);
        const sum = await ai.summarizeChapter({ book: done, chapter: dc });
        store.update(id, (d) => { const c = d.chapters.find((x) => x.id === ch.id); c.status = 'done'; c.summary_text = sum.summary || ''; d.context = updateContext(d.context, c, { ...sum, terms: [...(res.meta.terms || []), ...(sum.terms || [])], facts: [...(res.meta.facts || []), ...(sum.facts || [])], formulas: [...(res.meta.formulas || []), ...(sum.formulas || [])], characters: [...(res.meta.characters || []), ...(sum.characters || [])], locations: [...(res.meta.locations || []), ...(sum.locations || [])], events: [...(res.meta.events || []), ...(sum.events || [])] }); });
        setStep(id, ch.id, 'done');
      } catch (e) { return fail(ch.title, e, ch.id); }
    }
    finishSteps(id);
  }
  function setStep(id, cid, status) { store.update(id, (d) => { const i = d.generation.steps.findIndex((s) => s.key === cid); if (i < 0) return; d.generation.steps[i].status = status; const done = d.generation.steps.filter((s) => s.status === 'done').length; d.generation.progress = done / d.generation.steps.length; }); }
  function pause(id) { store.update(id, (d) => { d.generation.state = 'paused'; d.generation.error = null; d.generation.steps.forEach((s) => { if (s.status === 'active') s.status = 'pending'; }); d.chapters.forEach((c) => { if (c.status === 'generating') c.status = 'pending'; }); }); }
  function finishSteps(id) {
    const mark = (k, st) => store.update(id, (d) => { const s = d.generation.steps.find((x) => x.key === k); if (s) s.status = st; d.generation.progress = d.generation.steps.filter((x) => x.status === 'done').length / d.generation.steps.length; });
    mark('check', 'active'); svc.validate(id); mark('check', 'done');
    mark('format', 'active'); mark('format', 'done');
    mark('final', 'active');
    store.update(id, (d) => { d.status = 'Generated'; d.generation.state = 'done'; d.generation.progress = 1; d.generation.error = null; });
    mark('final', 'done');
  }
}

function idleGeneration() { return { state: 'idle', steps: [], progress: 0, error: null }; }
function buildSteps(b, doneCount) {
  const steps = [{ key: 'topic', label: 'Understanding topic' }, { key: 'outline', label: 'Creating outline' }, { key: 'plan', label: 'Planning chapters' }].map((s) => ({ ...s, status: 'done' }));
  b.chapters.forEach((c) => steps.push({ key: c.id, label: c.kind === 'chapter' ? `Writing ${getTemplate(b.bookType).chapterLabel} ${c.number}: ${c.title}` : `Writing ${c.title}`, status: 'pending' }));
  steps.push({ key: 'check', label: 'Checking content', status: 'pending' }, { key: 'format', label: 'Formatting', status: 'pending' }, { key: 'final', label: 'Finalizing', status: 'pending' });
  return steps;
}
export function summary(b) {
  return { id: b.id, title: b.title, subtitle: b.subtitle, author: b.author, topic: b.topic, bookType: b.bookType, language: b.language, status: b.status, targetPages: b.targetPages, chapterCount: b.chapters?.filter((c) => c.kind === 'chapter').length || b.targetChapters || 0, words: bookWordCount(b), coverStyle: b.coverStyle, createdAt: b.createdAt, updatedAt: b.updatedAt, generation: { state: b.generation?.state, progress: b.generation?.progress } };
}
