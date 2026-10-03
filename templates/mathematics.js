import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'mathematics', name: 'Mathematics', icon: '∑',
  description: 'Theory, formulas, solved problems with step-by-step solutions, practice sets and answers.',
  structure: ['Concept', 'Formula', 'Explanation', 'Solved Example', 'Step-by-Step Solution', 'Practice Problems', 'Answers', 'Summary'],
  wordsPerPage: 250, references: false,
  defaults: { audience: 'School Students', style: 'Simple', tone: 'Friendly', difficulty: 'Beginner' },
  extras: { examples: { heading: 'Solved Problems', perChapter: 2 }, exercises: { heading: 'Practice Problems', count: 5, answers: true }, summary: { heading: 'Chapter Summary' } },
  diagrams: { perChapter: 1, types: ['flowchart', 'concept-map', 'hierarchy'] },
  analysisFocus: 'Identify the concepts, formulas, variables and units, typical problem types, common mistakes, and calculations needed.',
  outlineRules: 'Order chapters from prerequisite ideas to advanced problem solving. Each chapter has a concept, formula and application section.',
  writingGuide: 'State each concept, give the formula on its own line as $$formula$$, explain every variable with its unit, then work examples fully. Never give only a final answer.',
  exampleRules: 'Solved examples use this shape inside a :::example box: Problem, Given, Formula, Substitution/Calculation (each step on its own line), Answer with units. Verify all arithmetic.',
  diagramRules: 'Add a diagram only for relationships between formulas, solution strategies, or geometric/physical set-ups.',
  exerciseRules: 'Practice problems progress from easy to hard. Provide a final "Answers" list with correct numeric answers and brief working.',
  formattingPrefs: 'Formulas centred with $$...$$, worked examples in boxes, numbered practice problems.',
  outlinePattern: ['Foundations of {topic}', 'Key Formulas in {topic}', 'Solving Basic {topic} Problems', 'Intermediate {topic} Problems', 'Word Problems in {topic}', 'Advanced {topic} Techniques', 'Common Mistakes in {topic}', 'Mixed Practice: {topic}'],
  expansionSections: ['More Solved Problems', 'Problem-Solving Strategies', 'Common Mistakes'],
});
