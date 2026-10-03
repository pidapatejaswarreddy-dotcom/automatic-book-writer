import test from 'node:test';
import assert from 'node:assert/strict';
import { planBook, estimatePages } from '../ai/planner.js';
import { getTemplate } from '../templates/index.js';
import { normalizeOutline } from '../ai/parse.js';

const outline = (n, secs = 3) => ({ intro: { title: 'Introduction' }, outro: { title: 'Conclusion' }, references: true, chapters: Array.from({ length: n }, (_, i) => ({ id: `o${i}`, title: `Ch ${i + 1}`, sections: Array.from({ length: secs }, (_, j) => ({ id: `s${i}${j}`, title: `Sec ${j + 1}` })) })) });

test('pages are reserved for front matter and the rest is distributed exactly', () => {
  for (const pages of [10, 25, 50, 100, 200]) {
    const book = { bookType: 'educational', targetPages: pages }; const p = planBook(book, outline(pages <= 10 ? 3 : 6));
    assert.equal(p.chapters.reduce((a, c) => a + c.targetPages, 0), p.usablePages, `${pages} pages`);
    assert.equal(p.usablePages, pages - Object.values(p.reserved).reduce((a, b) => a + b, 0));
    p.chapters.forEach((c) => { assert.ok(c.targetPages >= 1); assert.ok(c.targetWords > 0); });
  }
});
test('word targets follow the book type density', () => {
  const o = outline(5); const edu = planBook({ bookType: 'educational', targetPages: 50 }, o), math = planBook({ bookType: 'mathematics', targetPages: 50 }, o);
  assert.ok(edu.chapters[2].targetWords > math.chapters[2].targetWords);
});
test('very large page targets expand with extra sections, not padding', () => {
  const p = planBook({ bookType: 'educational', targetPages: 200 }, outline(3)); assert.ok(p.chapters.find((c) => c.kind === 'chapter').sections.length > 3); assert.ok(p.notes.length);
});
test('novels get no examples, exercises or diagrams; math gets solved problems', () => {
  const n = planBook({ bookType: 'novel', targetPages: 50 }, outline(5)).chapters.find((c) => c.kind === 'chapter');
  assert.deepEqual([n.examples, n.exercises, n.diagrams], [0, 0, 0]);
  assert.ok(planBook({ bookType: 'mathematics', targetPages: 50 }, outline(5)).chapters.find((c) => c.kind === 'chapter').examples >= 2);
});
test('page estimate = words / density + reserved pages', () => assert.equal(estimatePages({ bookType: 'educational', targetPages: 50 }, 3200), 10 + 4));
test('normalizeOutline repairs loose AI output', () => {
  const o = normalizeOutline({ chapters: [{ title: 'Chapter 1 — Basics', sections: ['1.1 What', { title: 'Why' }] }, { name: 'Two' }] }, { template: getTemplate('educational'), topic: 'x', targetChapters: 5 });
  assert.equal(o.chapters[0].title, 'Basics'); assert.equal(o.chapters[0].sections[0].title, 'What'); assert.ok(o.chapters[1].sections.length >= 3); assert.ok(o.chapters[0].id);
});
