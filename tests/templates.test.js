import test from 'node:test';
import assert from 'node:assert/strict';
import { listTemplates, getTemplate } from '../templates/index.js';
import { sectionPrompt } from '../ai/prompts.js';

const IDS = ['educational', 'mathematics', 'technical', 'novel', 'short-stories', 'self-help', 'biography', 'business'];
test('all eight book types are registered with complete rules', () => {
  assert.deepEqual(listTemplates().map((t) => t.id), IDS);
  for (const id of IDS) { const t = getTemplate(id); for (const k of ['writingGuide', 'outlineRules', 'exampleRules', 'diagramRules', 'exerciseRules', 'formattingPrefs', 'outlinePattern', 'analysisFocus']) assert.ok(t[k]?.length, `${id}.${k}`); }
});
test('the chapter-writing prompt differs by book type', () => {
  const ch = { title: 'C', number: 1, diagrams: 1, sections: [] }, s = { title: 'S', targetWords: 300 };
  const prompts = IDS.map((id) => sectionPrompt({ title: 'T', topic: 'X', bookType: id, audience: 'a', style: 's', tone: 't', difficulty: 'd' }, getTemplate(id), ch, s, 'body', 'ctx'));
  assert.equal(new Set(prompts).size, IDS.length);
  assert.match(prompts[1], /\$\$formula\$\$/); assert.match(prompts[2], /fenced blocks/); assert.match(prompts[3], /dialogue/i); assert.match(prompts[5], /"you"/);
});
test('fiction templates have no examples/diagrams; math has worked examples with answers', () => {
  assert.equal(getTemplate('novel').extras.examples, null); assert.equal(getTemplate('novel').diagrams.perChapter, 0);
  assert.equal(getTemplate('mathematics').extras.exercises.answers, true);
});
