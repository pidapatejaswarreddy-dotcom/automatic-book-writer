// DEMO / MOCK MODE: deterministic sample content so the whole app (outline, generation, editor,
// preview, exports) works without an API key. Replace by configuring AI_API_KEY.
import { rng, fill, paragraphs } from './text.js';
import { makeProblem, renderSolved } from './math.js';
import { uid } from '../planner.js';
import { normalizeOutline } from '../parse.js';

const FICTION = ['novel', 'short-stories'];
const SECTION_POOL = {
  default: ['Overview', 'Key Ideas', 'Why It Matters', 'How It Works in Practice', 'Everyday Examples', 'Common Questions'],
  technical: ['Concept', 'Components', 'Data Flow', 'Implementation', 'Testing', 'Pitfalls'],
  mathematics: ['The Idea', 'The Formula', 'Working with Units', 'Applying the Method', 'Checking Your Answer'],
  'self-help': ['The Challenge', 'What Is Really Going On', 'A Better Approach', 'First Steps', 'Keeping Going'],
  biography: ['Context', 'Key Events', 'People and Places', 'Turning Points', 'Reflections'],
  business: ['Context', 'Framework', 'Options', 'Decision Criteria', 'Risks'],
  novel: ['Opening Scene', 'The Encounter', 'A Difficult Choice', 'Aftermath'],
  'short-stories': ['Beginning', 'Complication', 'Turn', 'Ending'],
};
const NAMES = ['Asha', 'Rohan', 'Meera', 'Kabir', 'Lakshmi', 'Arjun', 'Nila', 'Vikram', 'Divya', 'Suresh'];
const PLACES = ['the old harbour town', 'a hill station wrapped in mist', 'the riverside market', 'a quiet village school', 'the lighthouse on the ridge'];
const SOLAR = [
  ['Introduction to Solar Energy', ['What is Solar Energy?', 'History', 'Importance']],
  ['Solar Energy Technology', ['Solar Panels', 'Photovoltaic Cells', 'Solar Collectors']],
  ['How Solar Energy Works', ['Solar Radiation', 'Energy Conversion', 'Electricity Generation']],
  ['Applications', ['Homes', 'Agriculture', 'Industry']],
  ['Advantages and Limitations', ['Advantages', 'Limitations', 'Cost and Payback']],
  ['Future of Solar Energy', ['New Materials', 'Energy Storage', 'Policy and Adoption']],
];

export const mock = {
  demo: true,
  async title({ topic }) { return { title: `${topic}: A Complete Guide`, subtitle: `Everything you need to know about ${topic}` }; },

  async analyzeTopic(book, t) {
    const T = book.topic;
    const seeds = FICTION.includes(t.id) ? { subtopics: ['Premise', 'Characters', 'Setting', 'Rising conflict', 'Climax', 'Resolution'] } : { subtopics: ['Introduction', 'Background', 'Core concepts', 'How it works', 'Applications', 'Advantages', 'Limitations', 'Future developments'] };
    const a = {
      mainConcept: T, importantConcepts: [`Fundamentals of ${T}`, `Key principles`, `Terminology`, `Methods`], subtopics: seeds.subtopics,
      relatedTopics: [`History of ${T}`, `${T} in society`, `Tools for ${T}`], applications: [`${T} in daily life`, `${T} in industry`, `${T} in education`],
      examples: [`A simple everyday case of ${T}`, `A step-by-step scenario`], potentialDiagrams: t.diagrams.perChapter ? [`Process of ${T}`, `Structure of ${T}`] : [],
      potentialQuestions: [`What is ${T}?`, `Why does ${T} matter?`], potentialCalculations: t.id === 'mathematics' ? [`Basic ${T} calculations`, 'Unit conversions'] : [],
    };
    if (FICTION.includes(t.id)) {
      const r = rng(T);
      const names = [...NAMES].sort(() => r() - 0.5).slice(0, 4);
      a.characters = [{ name: names[0], role: 'Protagonist', traits: 'curious, stubborn' }, { name: names[1], role: 'Ally', traits: 'loyal, witty' }, { name: names[2], role: 'Antagonist', traits: 'ambitious, guarded' }, { name: names[3], role: 'Mentor', traits: 'calm, secretive' }];
      a.locations = [r.pick(PLACES), r.pick(PLACES)].filter((v, i, s) => s.indexOf(v) === i);
      a.plotPoints = ['Inciting incident', 'Midpoint reversal', 'Crisis', 'Climax', 'Resolution'];
    }
    return a;
  },

  async generateOutline(book, t) {
    const T = book.topic, n = book.targetChapters;
    let chapters;
    if (/solar energy/i.test(T) && t.id === 'educational') chapters = SOLAR.slice(0, n).map(([title, s]) => ({ title, sections: s }));
    else {
      const pool = SECTION_POOL[t.id] || SECTION_POOL.default;
      chapters = Array.from({ length: n }, (_, i) => {
        const title = fill(t.outlinePattern[i % t.outlinePattern.length], { topic: T }) + (i >= t.outlinePattern.length ? ` (Part ${Math.floor(i / t.outlinePattern.length) + 1})` : '');
        return { title, sections: [0, 1, 2].map((k) => pool[(i + k) % pool.length]) };
      });
    }
    return normalizeOutline({ chapters }, { template: t, topic: T, targetChapters: n });
  },

  async section({ book, t, chapter, section, kind, ctx }) {
    const r = rng(`${book.topic}|${chapter.title}|${section.title}|${kind}`);
    const vars = { T: book.topic, C: chapter.title, S: section.title };
    const words = section.targetWords || 150;
    const idx = chapter.sections.findIndex((s) => s.id === section.id);
    let content = '';
    const meta = { terms: [], facts: [], formulas: [], characters: [], locations: [], events: [] };

    if (kind === 'intro') content = paragraphs(r, t.id, vars, words).join('\n\n');
    else if (kind === 'outro') content = paragraphs(r, t.id, vars, words).join('\n\n');
    else if (kind === 'references') content = [`1. Standard introductory textbooks on ${book.topic}.`, `2. Reputable encyclopaedias and academic journals covering ${book.topic}.`, `3. Publications of professional and government bodies related to ${book.topic}.`, '', '*Demo mode: these are generic placeholders. Configure an AI provider and verify all sources before publishing.*'].join('\n');
    else if (kind === 'summary') content = `${paragraphs(r, t.id, vars, 40)[0]}\n\n:::keypoints Key Points\n- ${chapter.sections.slice(0, 4).map((s) => `${s.title} is a building block of ${chapter.title}.`).join('\n- ')}\n:::`;
    else if (kind === 'examples') {
      if (t.id === 'mathematics') content = Array.from({ length: chapter.examples }, () => renderSolved(makeProblem(r))).join('\n\n');
      else if (t.id === 'technical') content = `:::example ${section.title}\n**Problem:** Apply ${chapter.title} to a small list of items and report the total.\n\n**Approach:** Loop over the items, add each value, and print the result.\n:::\n\n\`\`\`python\nitems = [12, 7, 21]\ntotal = 0\nfor value in items:\n    total += value\nprint("Total:", total)\n\`\`\`\n\n\`\`\`text\nTotal: 40\n\`\`\`\n\nIn the ${chapter.title} example, the loop visits each value once, so the running total after the last item is 40.`;
      else if (t.id === 'business') content = `:::case ${chapter.title}: A Composite Scenario\n**Scenario:** A mid-sized company wants to improve its approach to ${chapter.title}.\n\n**Problem:** Results are inconsistent and responsibilities are unclear.\n\n**Strategy:** Define owners, agree measures of success and review monthly.\n\n**Result / Discussion:** Within two quarters the team can compare outcomes to targets and adjust.\n:::`;
      else content = `:::example ${section.title}\n${paragraphs(r, t.id, vars, 50)[0]}\n:::\n\nThis example shows how the ideas of ${chapter.title} work in a familiar situation: the same pattern appears each time, only the details change.`;
    } else if (kind === 'exercises') {
      if (t.id === 'mathematics') {
        const ps = Array.from({ length: chapter.exercises }, () => makeProblem(r));
        content = `${ps.map((p, i) => `${i + 1}. ${p.problem}`).join('\n')}\n\n:::answer Answers\n${ps.map((p, i) => `${i + 1}. ${p.answer}`).join('\n')}\n:::`;
      } else {
        const qs = ['Explain in your own words what this chapter covers.', `Why does ${section.title.toLowerCase()} matter for ${book.topic}?`, 'Describe a situation where you could apply these ideas.', 'What is the most common mistake beginners make here?', 'Summarise the chapter in three sentences.', 'How would you teach this idea to a friend?'];
        content = Array.from({ length: chapter.exercises }, (_, i) => `${i + 1}. ${qs[i % qs.length]}`).join('\n');
      }
    } else if (FICTION.includes(t.id)) {
      const chars = ctx?.characters?.length ? ctx.characters : [{ name: 'Asha' }, { name: 'Rohan' }];
      const A = chars[0].name, B = (chars[1] || chars[0]).name, L = (ctx?.locations?.[0]) || 'the old harbour town';
      const scenes = [
        `{A} stood at the edge of {L}, listening to the wind carry old stories through the streets. Something had changed, and {A} knew it before anyone said a word.`,
        `"You are not going to like this," {B} said, lowering the lantern. "But we cannot pretend we did not see it."`,
        `{A} took a slow breath. "Then tell me everything, from the beginning." The words felt heavier than they should have.`,
        `Hours passed in {L} as the two of them pieced the evidence together. Each answer opened another question, and the evening grew colder.`,
        `At last {A} understood the cost of the choice ahead. It would change everything — and there would be no going back.`,
      ];
      const n = Math.max(2, Math.round(words / 70)); const paras = [];
      for (let i = 0; i < n; i++) paras.push(fill(scenes[i % scenes.length], { A, B, L }) + (i % 3 === 2 ? `\n\n* * *` : ''));
      content = paras.join('\n\n');
      meta.events.push(`${chapter.title}: ${section.title}`);
    } else {
      const paras = paragraphs(r, t.id, vars, words);
      content = paras[0] + (paras[1] ? '\n\n' + paras[1] : '');
      const lists = paras.slice(2);
      if (t.id === 'mathematics') { const p = makeProblem(r); content += `\n\nThe key relationship is:\n\n$$${p.formula}$$\n\nHere each symbol is a measurable quantity with its own unit.`; meta.formulas.push(p.formula); }
      if (t.id === 'technical') content += `\n\n\`\`\`python\ndef describe(name):\n    return f"{name} is ready"\n\nprint(describe("${section.title}"))\n\`\`\`\n\n\`\`\`text\n${section.title} is ready\n\`\`\``;
      if (lists.length) content += '\n\n' + lists.join('\n\n');
      if (chapter.diagrams && idx === Math.min(1, chapter.sections.length - 1) && chapter.sections.length >= 2) {
        const types = t.diagrams.types.length ? t.diagrams.types : ['flowchart'];
        const ft = types[(chapter.number || 1) % types.length];
        const titles = chapter.sections.map((s) => s.title).slice(0, 5);
        const nodes = ft === 'comparison' ? [`${titles[0]}: ${titles.slice(1, 3).join(', ')}`, `${titles[titles.length - 1]}: ${titles.slice(0, 2).join(', ')}`] : ft === 'hierarchy' || ft === 'concept-map' ? [chapter.title, ...titles] : titles;
        content += `\n\n[[FIGURE: ${ft} | ${chapter.title} at a glance | ${nodes.join('; ')}]]`;
      }
      if (t.id === 'educational') content += `\n\n:::keypoints Key Points\n- ${section.title} builds on the basics of ${book.topic}.\n- Examples make the idea concrete.\n:::`;
      meta.terms.push({ term: section.title, definition: `a topic within ${chapter.title}` });
    }
    return { content, meta };
  },

  async summarize({ chapter, text }) {
    const first = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30).slice(0, 2).join(' ');
    return { summary: first.slice(0, 300) || `Covers ${chapter.title}.`, terms: [], facts: [], formulas: [], characters: [], locations: [], events: [] };
  },

  async improve(action, text) {
    const simple = { utilize: 'use', demonstrate: 'show', 'in order to': 'to', approximately: 'about', commence: 'start', numerous: 'many' };
    const grammar = (s) => s.replace(/[ \t]{2,}/g, ' ').replace(/\b(\w+)\s+\1\b/gi, '$1').replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
    const paras = text.split(/\n{2,}/);
    const isProse = (p) => !/^(\s*[-*\d|`:$#>]|\[\[)/.test(p);
    const map = (fn) => paras.map((p) => (isProse(p) ? fn(p) : p)).join('\n\n');
    switch (action) {
      case 'grammar': return grammar(text);
      case 'shorten': return map((p) => p.split(/(?<=[.!?])\s+/).slice(0, Math.max(2, Math.ceil(p.split(/(?<=[.!?])\s+/).length * 0.6))).join(' '));
      case 'expand': return map((p) => p) + '\n\nTo see how this works, imagine applying the idea to a familiar situation and noticing which parts stay the same and which change.';
      case 'simplify': return map((p) => Object.entries(simple).reduce((s, [k, v]) => s.replace(new RegExp(`\\b${k}\\b`, 'gi'), v), p));
      case 'professional': return map((p) => p.replace(/\bdon't\b/gi, 'do not').replace(/\bcan't\b/gi, 'cannot').replace(/\bit's\b/gi, 'it is').replace(/\bwe'll\b/gi, 'we will'));
      default: return grammar(text);
    }
  },
  async check() { return []; },
};
