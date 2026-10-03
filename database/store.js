// File-based store: one JSON document per book (data/books/<id>.json), cached in memory.
// A book document embeds its chapters and sections (see README "Data model"). To use SQL instead,
// implement the same five methods (list/get/create/update/remove) and swap the import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createStore(dir = process.env.DATA_DIR || './data') {
  const root = path.resolve(dir, 'books');
  fs.mkdirSync(root, { recursive: true });
  const cache = new Map();
  const file = (id) => path.join(root, `${id}.json`);
  const load = () => { for (const f of fs.readdirSync(root)) if (f.endsWith('.json')) { try { const b = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); cache.set(b.id, b); } catch { /* skip corrupt file */ } } };
  load();
  const persist = (b) => { const tmp = `${file(b.id)}.tmp`; fs.writeFileSync(tmp, JSON.stringify(b)); fs.renameSync(tmp, file(b.id)); };
  const clone = (x) => structuredClone(x);
  return {
    list: () => [...cache.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone),
    get: (id) => (cache.has(id) ? clone(cache.get(id)) : null),
    create(data) { const now = new Date().toISOString(); const b = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 16), createdAt: now, updatedAt: now, ...data }; cache.set(b.id, b); persist(b); return clone(b); },
    // Synchronous read-modify-write: safe with a single Node process.
    update(id, mutate) { const cur = cache.get(id); if (!cur) return null; const draft = clone(cur); const res = mutate(draft); if (res === false) return clone(cur); draft.updatedAt = new Date().toISOString(); cache.set(id, draft); persist(draft); return clone(draft); },
    remove(id) { if (!cache.has(id)) return false; cache.delete(id); fs.rmSync(file(id), { force: true }); return true; },
  };
}
