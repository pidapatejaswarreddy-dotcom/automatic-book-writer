import test from 'node:test';
import assert from 'node:assert/strict';
import { newService, buildBook, SETTINGS, waitDone } from './helpers/workflow.js';
import { parseBlocks } from '../shared/content.js';
import { bookWordCount } from '../shared/content.js';

for (const type of ['educational', 'mathematics', 'technical', 'novel', 'self-help', 'short-stories', 'biography', 'business']) {
  test(`full flow: ${type} book is created, outlined, planned and generated`, async () => {
    const { svc } = newService();
    const b = await buildBook(svc, type, { topic: type === 'novel' ? 'A lighthouse mystery' : 'Solar Energy' });
    assert.equal(b.status, 'Generated'); assert.equal(b.generation.state, 'done'); assert.equal(b.generation.progress, 1);
    const body = b.chapters.filter((c) => c.kind === 'chapter'); assert.equal(body.length, SETTINGS.targetChapters);
    b.chapters.forEach((c) => { assert.equal(c.status, 'done'); c.sections.forEach((s) => assert.ok(s.content.trim().length > 20, `${c.title}/${s.title}`)); });
    assert.ok(bookWordCount(b) > 800); assert.ok(b.context.chapterSummaries.length === b.chapters.length);
  });
}

test('mathematics chapters contain step-by-step solved problems with correct answers and practice answers', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'mathematics');
  const text = b.chapters.filter((c) => c.kind === 'chapter').flatMap((c) => c.sections).map((s) => s.content).join('\n');
  assert.match(text, /\*\*Given:\*\*/); assert.match(text, /\*\*Formula:\*\*/); assert.match(text, /\*\*Answer:\*\*/); assert.match(text, /:::answer Answers/);
  const boxes = parseBlocks(text).filter((x) => x.type === 'box' && x.kind === 'example'); assert.ok(boxes.length >= 5);
  for (const m of text.matchAll(/I = (\d+) \/ (\d+)\n- I = ([\d.]+) A/g)) assert.equal(+m[3], +(m[1] / m[2]).toFixed(2));
  for (const m of text.matchAll(/A = (\d+) × (\d+)\n- A = (\d+) m²/g)) assert.equal(+m[3], m[1] * m[2]);
});
test('technical chapters have code with output and architecture diagrams', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'technical'); const text = b.chapters.flatMap((c) => c.sections).map((s) => s.content).join('\n');
  assert.match(text, /```python/); assert.match(text, /```text/); assert.match(text, /\[\[FIGURE:/);
});
test('novel keeps a character bible and uses only story prose (no lists, headings or exercises)', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'novel', { topic: 'A lighthouse mystery' });
  assert.ok(b.context.characters.length >= 3);
  const types = new Set(b.chapters.flatMap((c) => c.sections).flatMap((s) => parseBlocks(s.content)).map((x) => x.type)); assert.ok(![...types].some((t) => ['bullets', 'numbered', 'box', 'figure', 'code', 'table'].includes(t)), [...types].join());
  assert.ok(b.chapters.every((c) => c.sections.every((s) => !s.extra)));
});
test('self-help chapters include exercises and an action plan', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'self-help'); const ch = b.chapters.find((c) => c.kind === 'chapter');
  assert.ok(ch.sections.some((s) => s.title === 'Try This')); assert.ok(ch.sections.some((s) => s.title === 'Your Action Plan'));
});

test('the outline must be approved before any generation, and outline edits are validated', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational', { generate: false });
  assert.equal(b.status, 'Outline Ready'); assert.equal(b.chapters.every((c) => c.sections.every((s) => !s.content)), true);
  const fresh = svc.create({ topic: 'X', title: 'X', author: 'A' }); svc.setType(fresh.id, { bookType: 'educational' }); svc.setSettings(fresh.id, SETTINGS);
  assert.throws(() => svc.start(fresh.id), /Approve the outline/);
  await svc.generateOutline(fresh.id);
  assert.throws(() => svc.saveOutline(fresh.id, { chapters: [] }), /between 1 and 40/);
  const edited = svc.saveOutline(fresh.id, { ...svc.get(fresh.id).outline, chapters: [{ id: 'abc123', title: '  Renamed   Chapter ', sections: [{ title: 'Only' }] }] });
  assert.equal(edited.outline.chapters[0].title, 'Renamed Chapter'); assert.equal(edited.outline.chapters.length, 1);
});
test('saving edits, renaming, and status changes', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational'); const c = b.chapters[1], s = c.sections[0];
  const e = svc.saveSection(b.id, c.id, s.id, { content: 'My own text.\n\nSecond paragraph.' });
  assert.equal(e.chapters[1].sections[0].content, 'My own text.\n\nSecond paragraph.'); assert.equal(e.status, 'Editing');
  assert.equal(svc.renameChapter(b.id, c.id, 'New Title').chapters[1].title, 'New Title');
  assert.equal(svc.markCompleted(b.id).status, 'Completed');
});
test('editing actions transform content (demo provider)', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational'); const c = b.chapters[1], s = c.sections[0];
  const g = await svc.improveSection(b.id, c.id, s.id, 'grammar', 'this  is is a test.  another sentence here.'); assert.equal(g.content, 'This is a test. Another sentence here.');
  const sh = await svc.improveSection(b.id, c.id, s.id, 'shorten', 'One sentence here. Two sentence here. Three sentence here. Four sentence here. Five sentence here.'); assert.ok(sh.content.length < 90);
  const r = await svc.improveSection(b.id, c.id, s.id, 'regenerate'); assert.ok(r.content.length > 50);
  await assert.rejects(() => svc.improveSection(b.id, c.id, s.id, 'delete-everything'), /Unknown editing action/);
});
test('generation can be stopped and resumed without losing finished chapters', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational', { generate: false });
  svc.start(b.id); svc.stop(b.id); let cur = await waitDone(svc, b.id); assert.equal(cur.generation.state, 'paused');
  svc.start(b.id); cur = await waitDone(svc, b.id); assert.equal(cur.generation.state, 'done'); assert.equal(cur.status, 'Generated');
});
test('interrupted generation is recovered as paused on restart', async () => {
  const { svc, store } = newService(); const b = await buildBook(svc, 'educational', { generate: false });
  store.update(b.id, (d) => { d.generation.state = 'running'; }); svc.recoverInterrupted(); assert.equal(svc.get(b.id).generation.state, 'paused');
});
test('books can be listed, searched, renamed and deleted', async () => {
  const { svc } = newService(); const b = await buildBook(svc, 'educational', { generate: false });
  assert.equal(svc.list('solar').length, 1); assert.equal(svc.list('zzz').length, 0);
  assert.equal(svc.rename(b.id, 'Better Title').title, 'Better Title'); svc.remove(b.id); assert.equal(svc.list().length, 0); assert.throws(() => svc.get(b.id), /could not be found/);
});
