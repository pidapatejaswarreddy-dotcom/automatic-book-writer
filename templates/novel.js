import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'novel', name: 'Novel', icon: '✒',
  description: 'Long-form fiction with characters, setting, plot, dialogue, conflict and resolution.',
  structure: ['Story Premise', 'Characters', 'Setting', 'Plot', 'Chapter Events', 'Dialogue', 'Conflict', 'Climax', 'Resolution', 'Epilogue'],
  intro: null, outro: { title: 'Epilogue' }, wordsPerPage: 350, references: false,
  settings: { audience: true, style: true, tone: true, difficulty: false },
  defaults: { audience: 'General Readers', style: 'Storytelling', tone: 'Serious', difficulty: 'Beginner' },
  analysisFocus: 'Develop the premise, a character bible (protagonist, antagonist, allies), settings, a three-act plot with turning points, themes and conflicts.',
  outlineRules: 'Chapters follow a three-act arc: setup, rising conflict, midpoint reversal, crisis, climax, resolution. Each chapter is a list of scenes.',
  writingGuide: 'Write scenes, not summaries: sensory description, dialogue in natural voice, internal conflict and forward motion. Keep character names, traits, locations and the timeline consistent with the book context. Separate scenes with a line of * * *. Do not use headings, bullet lists or exercises.',
  exampleRules: 'No examples, sums or exercises.', diagramRules: 'No diagrams.', exerciseRules: 'No exercises.',
  formattingPrefs: 'Chapter title pages, scene breaks, no boxes.',
  outlinePattern: ['The Ordinary World', 'The Call', 'Crossing the Threshold', 'Allies and Enemies', 'The Midpoint', 'Everything Falls Apart', 'The Long Night', 'The Final Confrontation', 'The Turning Tide', 'Homecoming'],
  minSections: 2, expansionSections: ['A Quiet Interlude', 'A Second Thought', 'Old Wounds'],
});
