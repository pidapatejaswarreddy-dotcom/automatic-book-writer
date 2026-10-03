import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { tmpStore, SETTINGS } from './helpers/workflow.js';
import { createApp } from '../backend/app.js';
import { buildBookModel } from '../exporters/model.js';
import { EXPORTERS } from '../exporters/index.js';

let srv, base, env;
before(async () => { const { app } = createApp({ store: tmpStore() }); await new Promise((r) => { srv = app.listen(0, r); }); base = `http://localhost:${srv.address().port}`; });
after(() => srv.close());
const j = async (p, o = {}) => { const r = await fetch(base + p, { ...o, headers: { 'content-type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }); return { s: r.status, r, b: (r.headers.get('content-type') || '').includes('json') ? await r.json() : null }; };

async function makeBook(type = 'educational') {
  const c = await j('/api/books', { method: 'POST', body: { topic: 'Solar Energy', title: `Solar ${type}`, author: 'John' } }); const id = c.b.id;
  await j(`/api/books/${id}`, { method: 'PATCH', body: { bookType: type } }); await j(`/api/books/${id}`, { method: 'PATCH', body: SETTINGS });
  const o = await j(`/api/books/${id}/outline`, { method: 'POST' }); await j(`/api/books/${id}/approve`, { method: 'POST', body: o.b.outline }); await j(`/api/books/${id}/generate`, { method: 'POST' });
  for (let i = 0; i < 300; i++) { const g = await j(`/api/books/${id}`); if (g.b.generation.state !== 'running') break; await new Promise((r) => setTimeout(r, 50)); }
  return id;
}

test('config exposes languages, book types and demo mode', async () => { const r = await j('/api/config'); assert.equal(r.b.demoMode, true); assert.equal(r.b.bookTypes.length, 8); assert.ok(r.b.languages.some((l) => l.name === 'Telugu')); });
test('errors are friendly JSON, never stack traces', async () => {
  let r = await j('/api/books', { method: 'POST', body: { topic: '' } }); assert.equal(r.s, 400); assert.ok(r.b.error.details.topic); assert.ok(!JSON.stringify(r.b).includes('at '));
  r = await j('/api/books/not-a-real-id-123'); assert.equal(r.s, 404); r = await j('/api/books/..%2F..%2Fetc'); assert.ok([400, 404].includes(r.s));
  r = await fetch(base + '/api/books', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' }); assert.equal(r.status, 400);
  r = await j('/api/nope'); assert.equal(r.s, 404);
});
test('export is refused before the book is generated', async () => {
  const c = await j('/api/books', { method: 'POST', body: { topic: 'X', title: 'X', author: 'A' } }); const r = await j(`/api/books/${c.b.id}/export/pdf`); assert.equal(r.s, 400); assert.match(r.b.error.message, /Generate the book/);
});
test('PDF, DOCX and TXT exports are valid files', async () => {
  const id = await makeBook('mathematics');
  const pdf = Buffer.from(await (await fetch(`${base}/api/books/${id}/export/pdf`)).arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 15);
  const dr = await fetch(`${base}/api/books/${id}/export/docx`); assert.match(dr.headers.get('content-type'), /wordprocessingml/); const docx = Buffer.from(await dr.arrayBuffer()); assert.equal(docx.subarray(0, 2).toString(), 'PK');
  const f = path.join(os.tmpdir(), `abw-${id}.docx`); fs.writeFileSync(f, docx); const xml = execFileSync('unzip', ['-p', f, 'word/document.xml']).toString(); assert.match(xml, /Foundations of Solar Energy/); assert.match(xml, /Heading1/); assert.match(xml, /Figure 1\.1/);
  const txt = await (await fetch(`${base}/api/books/${id}/export/txt`)).text(); assert.match(txt, /TABLE OF CONTENTS/); assert.match(txt, /Answer:/); assert.match(txt, /Figure 1\.1:/);
  assert.equal((await j(`/api/books/${id}/export/epub`)).s, 400);
  const st = await j(`/api/books/${id}/stats`); assert.ok(st.b.estimatedPages > 10); assert.ok(Object.keys(st.b.chapterPages).length >= 6);
});
test('PDF TOC page numbers match where chapters really start', async () => {
  const id = await makeBook('educational'); const pdf = Buffer.from(await (await fetch(`${base}/api/books/${id}/export/pdf`)).arrayBuffer()); const f = path.join(os.tmpdir(), `abw-${id}.pdf`); fs.writeFileSync(f, pdf);
  const st = (await j(`/api/books/${id}/stats`)).b; const pageText = (n) => execFileSync('pdftotext', ['-f', String(n), '-l', String(n), f, '-']).toString();
  const model = buildBookModel((await j(`/api/books/${id}`)).b); const ch = model.chapters.find((c) => c.number === 2);
  assert.match(pageText(st.chapterPages[ch.id]), new RegExp(ch.title.slice(0, 12)));
});
test('all book types export to PDF/DOCX/TXT without errors', async () => {
  const { newService, buildBook } = await import('./helpers/workflow.js'); const { svc } = newService();
  for (const type of ['educational', 'mathematics', 'technical', 'novel', 'self-help', 'short-stories', 'biography', 'business']) {
    const b = await buildBook(svc, type, { topic: type === 'novel' ? 'A lighthouse mystery' : 'Solar Energy' });
    for (const f of ['pdf', 'docx', 'txt']) { const buf = await EXPORTERS[f].run(b); assert.ok(buf.length > 2000, `${type}.${f}`); }
  }
});
test('non-Latin languages export to PDF with embedded Noto fonts', async () => {
  const { newService, buildBook } = await import('./helpers/workflow.js'); const { svc } = newService(); const b = await buildBook(svc, 'educational');
  for (const [lang, sample] of [['Telugu', 'సౌర శక్తి'], ['Tamil', 'சூரிய ஆற்றல்'], ['Hindi', 'सौर ऊर्जा'], ['Kannada', 'ಸೌರ ಶಕ್ತಿ'], ['Malayalam', 'സൗരോർജ്ജം']]) {
    const nb = { ...b, language: lang, title: sample, chapters: b.chapters.map((c, i) => (i === 1 ? { ...c, sections: [{ ...c.sections[0], content: `${sample} 12 V. Solar panel.` }] } : c)) };
    const pdf = await EXPORTERS.pdf.run(nb); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', lang); const f = path.join(os.tmpdir(), `abw-${lang}.pdf`); fs.writeFileSync(f, pdf);
    assert.match(execFileSync('pdffonts', [f]).toString(), /Noto/, lang);
  }
});
