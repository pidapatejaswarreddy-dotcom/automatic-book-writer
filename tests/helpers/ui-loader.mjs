// Node ESM loader hook: lets the browser modules (which import "/shared/...") run under jsdom in tests.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('/shared/')) return next(pathToFileURL(path.join(root, specifier)).href, context);
  return next(specifier, context);
}
