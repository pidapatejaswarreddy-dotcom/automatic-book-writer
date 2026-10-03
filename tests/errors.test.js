import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newService, SETTINGS, waitDone } from './helpers/workflow.js';
import { resetAI, createAIService } from '../ai/index.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; process.env.AI_API_KEY = ''; delete process.env.AI_MAX_RETRIES; resetAI(); });

// A fake Anthropic API that answers each kind of prompt the app sends.
function fakeAnthropic({ failing = () => false } = {}) {
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body); const prompt = body.messages[0].content; seen.push({ url, body });
    if (failing(prompt)) throw new TypeError('network down');
    let text;
    if (/Suggest 1 compelling book title/.test(prompt)) text = '{"title":"Real AI Title","subtitle":"Sub"}';
    else if (/Analyse the topic/.test(prompt)) text = '```json\n{"mainConcept":"Sun","importantConcepts":["a"],"subtopics":["b"],"relatedTopics":[],"applications":["c"],"examples":[],"potentialDiagrams":[],"potentialQuestions":[],"potentialCalculations":[]}\n```';
    else if (/Respond ONLY as JSON: \{"chapters"/.test(prompt)) text = JSON.stringify({ chapters: Array.from({ length: 5 }, (_, i) => ({ title: `Chapter ${i + 1} — Real ${i}`, sections: ['One', 'Two', 'Three'] })) });
    else if (/Summarise this chapter/.test(prompt)) text = '{"summary":"A summary.","terms":[{"term":"PV","definition":"photovoltaic"}],"facts":[],"formulas":[],"characters":[],"locations":[],"events":[]}';
    else text = `Real paragraph text from the model for this section, long enough to count as content in the validator checks.\n\n===META===\n{"terms":[{"term":"Inverter","definition":"converts DC to AC"}],"facts":["f1"],"formulas":[],"characters":[],"locations":[],"events":[]}`;
    return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return seen;
}
const useReal = () => { process.env.AI_API_KEY = 'sk-test'; process.env.AI_PROVIDER = 'anthropic'; process.env.AI_MAX_RETRIES = '0'; resetAI(); };

test('demo mode is on when no API key is configured', () => { assert.equal(createAIService({ AI_API_KEY: '' }).demo, true); assert.equal(createAIService({ AI_API_KEY: 'k' }).demo, false); });

test('real provider path: prompts, JSON parsing, chapter meta and context all work end to end', async () => {
  const seen = fakeAnthropic(); useReal(); const { svc } = newService();
  assert.equal((await svc.generateTitle({ topic: 'Solar' })).title, 'Real AI Title');
  const b = svc.create({ topic: 'Solar', title: 'T', author: 'A' }); svc.setType(b.id, { bookType: 'educational' }); svc.setSettings(b.id, SETTINGS);
  const o = await svc.generateOutline(b.id); assert.equal(o.outline.chapters.length, 5); assert.equal(o.outline.chapters[0].title, 'Real 0');
  svc.approve(b.id, {}); svc.start(b.id); const done = await waitDone(svc, b.id);
  assert.equal(done.status, 'Generated'); assert.ok(done.context.terms.some((t) => t.term === 'Inverter')); assert.equal(done.demo, false);
  assert.ok(seen.every((s) => s.url.startsWith('https://api.anthropic.com/v1/messages'))); assert.ok(seen.every((s) => s.body.model));
  assert.ok(seen.some((s) => /BOOK CONTEXT/.test(s.body.messages[0].content) && /Real 0/.test(s.body.messages[0].content)), 'later prompts carry the book context');
});

test('AI failure while outlining gives a friendly message and no technical details', async () => {
  fakeAnthropic({ failing: () => true }); useReal(); const { svc } = newService();
  const b = svc.create({ topic: 'Solar', title: 'T', author: 'A' }); svc.setType(b.id, { bookType: 'educational' }); svc.setSettings(b.id, SETTINGS);
  await assert.rejects(() => svc.generateOutline(b.id), (e) => e.status === 502 && e.code === 'AI_FAILED' && /try again/i.test(e.userMessage) && !/network|fetch|anthropic/i.test(e.userMessage));
});
test('unreadable AI output is reported as a failure, not a crash', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'Sorry, I cannot do that.' }] }), { status: 200 }); useReal(); const { svc } = newService();
  const b = svc.create({ topic: 'Solar', title: 'T', author: 'A' }); svc.setType(b.id, { bookType: 'educational' }); svc.setSettings(b.id, SETTINGS);
  await assert.rejects(() => svc.analyze(b.id), (e) => e.code === 'AI_FAILED');
});
test('a failure in the middle of generation is saved, shown as an error, and Try Again resumes', async () => {
  let calls = 0; fakeAnthropic({ failing: (p) => /TASK: Write the section/.test(p) && ++calls === 6 }); useReal(); const { svc } = newService();
  const b = svc.create({ topic: 'Solar', title: 'T', author: 'A' }); svc.setType(b.id, { bookType: 'educational' }); svc.setSettings(b.id, SETTINGS);
  await svc.generateOutline(b.id); svc.approve(b.id, {}); svc.start(b.id); let cur = await waitDone(svc, b.id);
  assert.equal(cur.generation.state, 'error'); assert.match(cur.generation.error, /Something went wrong while generating/); assert.ok(!/TypeError|network/.test(cur.generation.error));
  const kept = cur.chapters.filter((c) => c.status === 'done').length; assert.ok(kept >= 1, 'finished chapters are kept');
  svc.start(b.id); cur = await waitDone(svc, b.id); assert.equal(cur.generation.state, 'done'); assert.ok(cur.chapters.every((c) => c.status === 'done'));
});
test('provider timeouts are retried then reported', async () => {
  process.env.AI_TIMEOUT_MS = '20'; let n = 0; globalThis.fetch = (u, o) => { n++; return new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))); };
  process.env.AI_API_KEY = 'k'; process.env.AI_MAX_RETRIES = '1'; resetAI(); const { svc } = newService();
  await assert.rejects(() => svc.generateTitle({ topic: 'x' }), (e) => e.code === 'AI_FAILED'); assert.equal(n, 2); delete process.env.AI_TIMEOUT_MS;
});
test('invalid identifiers and actions are rejected cleanly', async () => {
  const { svc } = newService(); assert.throws(() => svc.get('missing-book-id-1'), /could not be found/); assert.throws(() => svc.create({}), /highlighted/);
});
