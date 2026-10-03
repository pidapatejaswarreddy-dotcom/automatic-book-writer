import { Router } from 'express';
import { listTemplates } from '../../templates/index.js';
import { LANGUAGES } from '../../config/languages.js';
import * as O from '../../config/options.js';
import { getAI } from '../../ai/index.js';
import { EXPORTERS, pdfLayout, safeFilename } from '../../exporters/index.js';
import { AppError, badRequest, notFound } from '../errors.js';
import { validId } from '../validation.js';
import { log } from '../logger.js';
import { buildBookModel } from '../../exporters/model.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApiRouter(svc) {
  const r = Router();
  r.param('id', (req, res, next, id) => (validId(id) ? next() : next(notFound())));

  r.get('/config', (req, res) => {
    const ai = getAI();
    res.json({ demoMode: ai.demo, provider: ai.provider, languages: LANGUAGES.map(({ code, name, native }) => ({ code, name, native })), bookTypes: listTemplates(),
      options: { pages: O.PAGE_OPTIONS, chapters: O.CHAPTER_OPTIONS, pageLimits: O.PAGE_LIMITS, chapterLimits: O.CHAPTER_LIMITS, audiences: O.AUDIENCES, styles: O.STYLES, tones: O.TONES, difficulties: O.DIFFICULTIES } });
  });
  r.post('/ai/title', wrap(async (req, res) => res.json(await svc.generateTitle(req.body || {}))));

  r.get('/books', (req, res) => res.json(svc.list(req.query.q)));
  r.post('/books', wrap(async (req, res) => res.status(201).json(svc.create(req.body || {}))));
  r.get('/books/:id', (req, res) => res.json(svc.get(req.params.id)));
  r.patch('/books/:id', (req, res) => {
    const b = req.body || {}; const id = req.params.id;
    if ('bookType' in b) return res.json(svc.setType(id, b));
    if ('targetPages' in b) return res.json(svc.setSettings(id, b));
    if ('coverStyle' in b || 'copyright' in b) return res.json(svc.setCover(id, b));
    if (Object.keys(b).length === 1 && 'title' in b) return res.json(svc.rename(id, b.title));
    return res.json(svc.updateInfo(id, b));
  });
  r.delete('/books/:id', (req, res) => { svc.remove(req.params.id); res.status(204).end(); });

  r.post('/books/:id/analyze', wrap(async (req, res) => res.json(await svc.analyze(req.params.id))));
  r.post('/books/:id/outline', wrap(async (req, res) => res.json(await svc.generateOutline(req.params.id))));
  r.put('/books/:id/outline', (req, res) => res.json(svc.saveOutline(req.params.id, req.body || {})));
  r.post('/books/:id/approve', (req, res) => res.json(svc.approve(req.params.id, req.body || {})));
  r.post('/books/:id/generate', (req, res) => res.json(svc.start(req.params.id)));
  r.post('/books/:id/generate/stop', (req, res) => res.json(svc.stop(req.params.id)));

  r.put('/books/:id/chapters/:cid', (req, res) => res.json(svc.renameChapter(req.params.id, req.params.cid, req.body?.title)));
  r.put('/books/:id/chapters/:cid/sections/:sid', (req, res) => res.json(svc.saveSection(req.params.id, req.params.cid, req.params.sid, req.body || {})));
  r.post('/books/:id/chapters/:cid/sections/:sid/improve', wrap(async (req, res) => res.json(await svc.improveSection(req.params.id, req.params.cid, req.params.sid, req.body?.action, req.body?.text))));

  r.post('/books/:id/validate', (req, res) => res.json({ issues: svc.validate(req.params.id) }));
  r.post('/books/:id/issues/fix-all', wrap(async (req, res) => res.json({ issues: await svc.fixAll(req.params.id) })));
  r.post('/books/:id/issues/:iid/fix', wrap(async (req, res) => res.json({ issues: await svc.fixIssue(req.params.id, req.params.iid) })));
  r.post('/books/:id/issues/:iid/ignore', (req, res) => res.json({ issues: svc.ignoreIssue(req.params.id, req.params.iid) }));

  r.get('/books/:id/stats', wrap(async (req, res) => {
    const book = svc.get(req.params.id); let pages = null, chapterPages = {};
    try { const l = await pdfLayout(book); pages = l.pages; chapterPages = l.chapterPages; } catch (e) { log.warn('page count fallback', e); }
    res.json({ ...svc.stats(req.params.id, pages), chapterPages });
  }));
  r.get('/books/:id/model', (req, res) => res.json(buildBookModel(svc.get(req.params.id))));
  r.post('/books/:id/complete', (req, res) => res.json(svc.markCompleted(req.params.id)));

  r.get('/books/:id/export/:format', wrap(async (req, res) => {
    const exp = EXPORTERS[req.params.format]; if (!exp) throw badRequest('That download format is not supported.');
    const book = svc.get(req.params.id);
    if (!book.chapters.some((c) => c.sections.some((s) => s.content))) throw badRequest('Generate the book before downloading it.');
    let buf; try { buf = await exp.run(book); } catch (e) { log.error(`export ${req.params.format} failed`, e); throw new AppError(500, 'EXPORT_FAILED', 'The file could not be created. Please try again.'); }
    res.setHeader('Content-Type', exp.mime); res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(book.title)}.${req.params.format}"`); res.send(buf);
  }));
  return r;
}
