import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './routes/api.js';
import { createBookService } from './services/bookService.js';
import { createStore } from '../database/store.js';
import { AppError } from './errors.js';
import { log } from './logger.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ store = createStore(), serveStatic = true } = {}) {
  const app = express(); const svc = createBookService(store);
  svc.recoverInterrupted();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"); next(); });
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createApiRouter(svc));
  if (serveStatic) { app.use('/shared', express.static(path.join(root, 'shared'))); app.use(express.static(path.join(root, 'public'))); app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(root, 'public', 'index.html'))); }
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That request could not be found.' } }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.userMessage, details: err.details } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'The request could not be read.' } });
    log.error('unhandled error', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } });
  });
  return { app, svc, store };
}
