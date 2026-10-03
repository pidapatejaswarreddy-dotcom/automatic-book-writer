// Every template is a plain object; defineTemplate fills in defaults so new book types stay small.
export function defineTemplate(t) {
  return {
    chapterLabel: 'Chapter',
    intro: { title: 'Introduction' },
    outro: { title: 'Conclusion' },
    references: false,
    wordsPerPage: 320,
    settings: { audience: true, style: true, tone: true, difficulty: true },
    defaults: { audience: 'General Readers', style: 'Simple', tone: 'Friendly', difficulty: 'Beginner' },
    extras: { examples: null, exercises: null, summary: null },
    diagrams: { perChapter: 0, types: [] },
    minSections: 3,
    expansionSections: ['A Closer Look', 'Common Questions', 'Deeper Insights'],
    ...t,
  };
}
