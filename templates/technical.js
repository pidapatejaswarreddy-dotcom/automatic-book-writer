import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'technical', name: 'Technical', icon: '⌘',
  description: 'Programming, computer science and engineering with architecture, code and exercises.',
  structure: ['Introduction', 'Concept', 'Architecture', 'Block Diagram', 'Detailed Explanation', 'Implementation', 'Code Examples', 'Output', 'Use Cases', 'Exercises', 'Summary'],
  wordsPerPage: 260, references: true,
  defaults: { audience: 'Beginners', style: 'Technical', tone: 'Professional', difficulty: 'Intermediate' },
  extras: { examples: { heading: 'Implementation Example', perChapter: 1 }, exercises: { heading: 'Exercises', count: 4, answers: false }, summary: { heading: 'Chapter Summary' } },
  diagrams: { perChapter: 1, types: ['architecture', 'block', 'flowchart', 'hierarchy'] },
  analysisFocus: 'Identify components, architecture, data flow, key APIs or algorithms, typical implementations, use cases and pitfalls.',
  outlineRules: 'Concept first, then architecture, then implementation, then advanced use cases. Every chapter has a runnable example.',
  writingGuide: 'Explain the concept, describe the architecture, then show an implementation. Code goes in fenced blocks with a language tag; follow every code block with its expected output in a separate ```text block, then explain it line by line. Use consistent terminology.',
  exampleRules: 'Problem -> Approach -> Code -> Output -> Explanation. Code must be correct and self-contained.',
  diagramRules: 'Add an architecture or block diagram for every chapter that introduces components or data flow; use a flowchart for algorithms.',
  exerciseRules: 'Exercises ask the reader to modify, extend or debug the chapter code.',
  formattingPrefs: 'Fenced code with language, monospace, block diagrams, tables for comparisons.',
  outlinePattern: ['Introduction to {topic}', 'Core Concepts of {topic}', '{topic} Architecture', 'Implementing {topic}', 'Working with Data in {topic}', 'Testing and Debugging {topic}', 'Real-World Use Cases of {topic}', 'Performance and Best Practices'],
  expansionSections: ['Additional Code Examples', 'Design Trade-offs', 'Troubleshooting'],
});
