import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'educational', name: 'Educational', icon: '📘',
  description: 'Explain an academic or general subject with clear concepts, examples and diagrams.',
  structure: ['Introduction', 'Chapter', 'Concept Explanation', 'Examples', 'Diagrams', 'Summary', 'Questions', 'Conclusion', 'References'],
  references: true, wordsPerPage: 320,
  defaults: { audience: 'Beginners', style: 'Simple', tone: 'Professional', difficulty: 'Beginner' },
  extras: { examples: { heading: 'Examples', perChapter: 1 }, exercises: { heading: 'Review Questions', count: 5, answers: false }, summary: { heading: 'Chapter Summary' } },
  diagrams: { perChapter: 1, types: ['flowchart', 'process', 'cycle', 'hierarchy', 'concept-map'] },
  analysisFocus: 'Identify the core concepts a learner must understand, a logical learning order, real-world applications, and where diagrams or worked examples help.',
  outlineRules: 'Start with foundations, build toward applications, then limitations and future directions. Each chapter has 3-4 focused sections.',
  writingGuide: 'Explain each concept in plain language first, then give a concrete example, then explain the example. Define terms when first used. Use short paragraphs, occasional bullet lists, and a key-points box for the most important ideas.',
  exampleRules: 'Concept -> Explanation -> Example -> Explanation of the example. Use a real-world scenario the audience knows.',
  diagramRules: 'Add a diagram only for processes, structures, cycles or relationships that are easier to see than to read. Never for simple definitions.',
  exerciseRules: 'Review questions test understanding (recall, explain, apply). No answers are printed.',
  formattingPrefs: 'Headings, short paragraphs, key-point boxes, figures with captions.',
  outlinePattern: ['Introduction to {topic}', '{topic}: Core Concepts', 'How {topic} Works', 'Applications of {topic}', 'Advantages and Limitations of {topic}', 'The Future of {topic}', 'Case Studies in {topic}', 'Common Misconceptions About {topic}'],
});
