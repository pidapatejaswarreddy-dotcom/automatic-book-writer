import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'short-stories', name: 'Short Stories', icon: '❦',
  description: 'A collection of standalone stories linked by a common theme.',
  structure: ['Introduction', 'Story 1', 'Story 2', 'Story 3', '...', 'Conclusion'],
  chapterLabel: 'Story', wordsPerPage: 350,
  settings: { audience: true, style: true, tone: true, difficulty: false },
  defaults: { audience: 'General Readers', style: 'Storytelling', tone: 'Neutral', difficulty: 'Beginner' },
  analysisFocus: 'Find a unifying theme and distinct premises, characters and settings for each standalone story.',
  outlineRules: 'Each chapter is one complete story with its own premise, characters, conflict and ending. Vary tone and setting between stories.',
  writingGuide: 'Each story is self-contained with a beginning, middle and end. Use vivid scenes and dialogue, and a memorable ending. Keep character names consistent within a story. No headings, lists or exercises inside the prose.',
  exampleRules: 'No examples or exercises.', diagramRules: 'No diagrams.', exerciseRules: 'No exercises.',
  formattingPrefs: 'Each story starts on a new page.',
  outlinePattern: ['The Lantern Keeper', 'A Letter Never Sent', 'The Last Train Home', 'Salt and Rain', 'The Clockmaker\'s Apprentice', 'Midnight at the Market', 'What the River Knew', 'The Quiet House'],
  minSections: 2,
});
