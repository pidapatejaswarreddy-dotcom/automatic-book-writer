import { defineTemplate } from './base.js';
export default defineTemplate({
  id: 'business', name: 'Business', icon: '▲',
  description: 'Strategy, market analysis, case studies, implementation guidance and future outlook.',
  structure: ['Introduction', 'Business Background', 'Market / Problem', 'Strategies', 'Examples', 'Case Studies', 'Implementation', 'Challenges', 'Future', 'Conclusion'],
  wordsPerPage: 320, references: true,
  defaults: { audience: 'Professionals', style: 'Professional', tone: 'Professional', difficulty: 'Intermediate' },
  extras: { examples: { heading: 'Case Study', perChapter: 1 }, exercises: { heading: 'Discussion Questions', count: 4, answers: false }, summary: { heading: 'Key Takeaways' } },
  diagrams: { perChapter: 1, types: ['flowchart', 'comparison', 'hierarchy', 'cycle'] },
  analysisFocus: 'Identify the market problem, stakeholders, strategies, frameworks, illustrative cases, implementation steps, risks and future trends.',
  outlineRules: 'Move from context and problem, to strategy, to implementation and risk, to future outlook.',
  writingGuide: 'Be concrete and decision-oriented. Explain frameworks, then apply them to scenarios. Use clearly hypothetical or composite companies unless facts are well established; never invent statistics. Include risks and trade-offs.',
  exampleRules: 'Business scenario -> Problem -> Strategy -> Result / Discussion.',
  diagramRules: 'Use flowcharts for processes, comparison diagrams for options, hierarchies for org/structure.',
  exerciseRules: 'Discussion questions that push the reader to apply frameworks to their own organisation.',
  formattingPrefs: 'Case-study boxes, comparison tables, key-takeaway boxes.',
  outlinePattern: ['The Landscape of {topic}', 'Understanding the Market for {topic}', 'Strategic Foundations of {topic}', 'Building a {topic} Strategy', 'Case Studies in {topic}', 'Implementing {topic}', 'Risks and Challenges in {topic}', 'The Future of {topic}'],
});
