import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
process.env.AI_API_KEY = ''; // tests always run in demo mode
import { createStore } from '../../database/store.js';
import { createBookService } from '../../backend/services/bookService.js';

export const tmpStore = () => createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'abw-test-')));
export const newService = () => { const store = tmpStore(); return { store, svc: createBookService(store) }; };
export const SETTINGS = { targetPages: 25, targetChapters: 5, audience: 'Beginners', style: 'Simple', tone: 'Professional', difficulty: 'Beginner' };
export const waitDone = async (svc, id) => { while (svc.isRunning(id)) await new Promise((r) => setTimeout(r, 20)); return svc.get(id); };

export async function buildBook(svc, bookType, { topic = 'Solar Energy', settings = SETTINGS, generate = true } = {}) {
  const b = svc.create({ topic, title: `Test ${bookType}`, author: 'John', language: 'English' });
  svc.setType(b.id, { bookType }); svc.setSettings(b.id, settings);
  await svc.generateOutline(b.id); svc.approve(b.id, {});
  if (generate) { svc.start(b.id); return waitDone(svc, b.id); }
  return svc.get(b.id);
}
