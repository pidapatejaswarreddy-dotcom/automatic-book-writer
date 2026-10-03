import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'self-help', name: 'Self-Help', icon: '✦',
  description: 'Practical guidance with strategies, realistic examples, exercises and an action plan.',
  structure: ['Problem', 'Understanding the Problem', 'Causes', 'Strategies', 'Examples', 'Practical Exercises', 'Action Plan', 'Conclusion'],
  wordsPerPage: 330, references: false,
  defaults: { audience: 'General Readers', style: 'Conversational', tone: 'Motivational', difficulty: 'Beginner' },
  extras: { examples: { heading: 'Real-Life Example', perChapter: 1 }, exercises: { heading: 'Try This', count: 3, answers: false }, summary: { heading: 'Your Action Plan' } },
  analysisFocus: 'Identify the core problem, its causes, evidence-based strategies, realistic scenarios, and small actions readers can take.',
  outlineRules: 'Move from understanding the problem, to causes, to strategies, to habits and an action plan. End with sustaining change.',
  writingGuide: 'Speak directly to the reader ("you"). Be empathetic, practical and honest; avoid miracle claims and medical advice. Use short anecdotes, concrete steps and reflective prompts. Give each chapter a clear takeaway.',
  exampleRules: 'Realistic, relatable scenarios (composite characters, clearly not real people).',
  diagramRules: 'Rarely; only a simple cycle or process figure when it clarifies a habit loop or plan.',
  exerciseRules: 'Practical exercises the reader can finish in 10 minutes; end each chapter with a specific action plan.',
  formattingPrefs: 'Action-plan boxes, exercises, short chapters.',
  diagrams: { perChapter: 0, types: ['cycle', 'process'] },
  outlinePattern: ['Understanding {topic}', 'Why {topic} Happens', 'Mindset Shifts for {topic}', 'Daily Strategies for {topic}', 'Overcoming Obstacles in {topic}', 'Building Lasting Habits', 'Support and Accountability', 'Your Long-Term Plan for {topic}'],
});
