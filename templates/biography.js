import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'biography', name: 'Biography', icon: '☖',
  description: 'The life story of a person: early life, career, achievements, challenges and legacy.',
  structure: ['Introduction', 'Early Life', 'Education', 'Career', 'Major Events', 'Achievements', 'Challenges', 'Later Life', 'Legacy', 'Conclusion'],
  wordsPerPage: 340, references: true,
  settings: { audience: true, style: true, tone: true, difficulty: false },
  defaults: { audience: 'General Readers', style: 'Professional', tone: 'Neutral', difficulty: 'Beginner' },
  extras: { summary: { heading: 'Timeline' } },
  analysisFocus: 'Build a chronological timeline: early life, education, career phases, major events, achievements, challenges, later life, legacy. Flag facts that must be verified.',
  outlineRules: 'Chronological chapters with a thematic thread. Final chapters cover later life and legacy.',
  writingGuide: 'Write narrative non-fiction in chronological order. Stick to well-established facts; when unsure, write cautiously ("is widely reported that") rather than inventing dates, quotes or events. Never fabricate quotations. Recommend verification of facts in the references chapter.',
  exampleRules: 'Use short illustrative episodes drawn from documented events only.',
  diagramRules: 'A timeline figure per chapter is welcome when there are 4+ dated events.',
  exerciseRules: 'No exercises.', formattingPrefs: 'Chronological chapters, timeline figures, references.',
  diagrams: { perChapter: 0, types: ['timeline'] },
  outlinePattern: ['Early Life and Family', 'Education and Formative Years', 'Beginning of a Career', 'Rise to Prominence', 'Defining Achievements', 'Trials and Setbacks', 'Later Years', 'Legacy and Influence'],
});
