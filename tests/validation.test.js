import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInfo, validateSettings, validateType } from '../backend/validation.js';
import { getTemplate } from '../templates/index.js';
import { validateBook, applyLocalGrammar } from '../ai/validator.js';
import { newService, buildBook } from './helpers/workflow.js';

const S = { targetPages: 50, targetChapters: 6, audience: 'Beginners', style: 'Simple', tone: 'Friendly', difficulty: 'Beginner' };
test('book information: required fields, unsupported language, cleaning', () => {
  assert.throws(() => validateInfo({ topic: '  ', title: '', author: '' }), (e) => Boolean(e.details.topic && e.details.title && e.details.author));
  assert.throws(() => validateInfo({ topic: 'x', title: 'y', author: 'z', language: 'Klingon' }), (e) => Boolean(e.details.language));
  const ok = validateInfo({ topic: ' Solar\u0000  Energy ', title: 'T', author: 'A', language: 'Telugu' }); assert.equal(ok.topic, 'Solar Energy'); assert.equal(ok.language, 'Telugu');
});
test('book type must exist', () => { assert.throws(() => validateType({ bookType: 'poetry' }), /Choose a book type/); assert.equal(validateType({ bookType: 'novel' }).bookType, 'novel'); });
test('settings validation covers custom values and ranges', () => {
  const t = getTemplate('educational');
  assert.equal(validateSettings(S, t).targetPages, 50); assert.equal(validateSettings({ ...S, targetPages: 137 }, t).targetPages, 137);
  for (const bad of [{ targetPages: 3 }, { targetPages: 9999 }, { targetPages: 'abc' }, { targetChapters: 0 }, { targetChapters: 45 }, { audience: 'Aliens' }, { style: '' }, { targetPages: 10, targetChapters: 8 }]) assert.throws(() => validateSettings({ ...S, ...bad }, t), /fix the highlighted/, JSON.stringify(bad));
});
test('irrelevant settings are replaced by template defaults (novel has no difficulty)', () => assert.equal(validateSettings({ ...S, difficulty: 'whatever' }, getTemplate('novel')).difficulty, 'Beginner'));

test('content checks find repetition, unclosed boxes/code, broken figure refs and offer fixes', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'technical'); const ch = b.chapters[1]; const sec = ch.sections[0];
  const dup = 'This particular sentence is deliberately long enough to be detected as repeated text in the book.';
  const bad = { ...b, chapters: b.chapters.map((c, i) => (i === 1 ? { ...c, sections: c.sections.map((s, j) => (j === 0 ? { ...s, content: `${dup} ${dup} Some more words follow here to pass the minimum.\n\n:::note Open\nunclosed box\n\nSee Figure 9.9 for details. the the end  here` } : s)) } : c)) };
  const cats = new Set(validateBook(bad).map((i) => i.category)); for (const c of ['Repetition', 'Formatting', 'Broken references', 'Grammar']) assert.ok(cats.has(c), c);
  const empty = { ...b, chapters: b.chapters.map((c, i) => (i === 1 ? { ...c, sections: c.sections.map((s, j) => (j === 0 ? { ...s, content: '' } : s)) } : c)) };
  assert.ok(validateBook(empty).some((i) => i.category === 'Missing sections' && i.fix.type === 'regenerate'));
});
test('local grammar fixer repairs spacing, doubled words and capitalisation but leaves code alone', () => assert.equal(applyLocalGrammar('the  cat sat sat down .  then it left.\n\n```js\nlet  a  =  1 ;\n```'), 'the cat sat down. Then it left.\n\n```js\nlet  a  =  1 ;\n```'));
test('fix / ignore / fix-all flow through the service', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational'); const c = b.chapters[1], s = c.sections[0];
  svc.saveSection(b.id, c.id, s.id, { content: 'Solar panels  turn light into into power.  they are useful in many places today, from rooftops to remote villages and farms.' });
  let issues = svc.validate(b.id); const g = issues.find((i) => i.category === 'Grammar' && i.sectionId === s.id); assert.ok(g);
  issues = await svc.fixIssue(b.id, g.id); assert.ok(!issues.some((i) => i.category === 'Grammar' && i.sectionId === s.id));
  assert.equal(svc.get(b.id).chapters[1].sections[0].content, 'Solar panels turn light into power. They are useful in many places today, from rooftops to remote villages and farms.');
  svc.saveSection(b.id, c.id, s.id, { content: '' }); const miss = svc.validate(b.id).find((i) => i.category === 'Missing sections');
  assert.equal(svc.ignoreIssue(b.id, miss.id).find((i) => i.id === miss.id).status, 'ignored'); assert.equal(svc.validate(b.id).find((i) => i.id === miss.id).status, 'ignored');
});
test('novel checks flag misspelled character names and offer a fix', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'novel', { topic: 'A lighthouse mystery' }); const name = b.context.characters[0].name; const c = b.chapters[1], s = c.sections[0];
  svc.saveSection(b.id, c.id, s.id, { content: `${name}a walked to the harbour and watched the boats arrive slowly, one after another, in the evening light.` });
  const issue = svc.validate(b.id).find((i) => i.category === 'Character consistency' && i.fix); assert.ok(issue); assert.equal(issue.fix.replace, name);
});
