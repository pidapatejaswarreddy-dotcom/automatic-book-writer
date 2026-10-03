// Font handling for the PDF exporter. English uses built-in Times/Helvetica; symbols outside
// WinAnsi (Ω, ⇒, ≈ ...) and Indic scripts use bundled Noto fonts from @fontsource packages.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const fontFile = (pkg, name) => path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files', name);

const WIN_EXTRA = new Set([...'–—‘’“”•…€™†‡‰‹›']);
export const isWin = (ch) => ch.codePointAt(0) <= 0xff || WIN_EXTRA.has(ch);
const isIndic = (cp) => (cp >= 0x0900 && cp <= 0x0dff) || cp === 0x200c || cp === 0x200d;
const isGreek = (cp) => cp >= 0x0370 && cp <= 0x03ff;
const isMath = (cp) => (cp >= 0x2190 && cp <= 0x22ff) || (cp >= 0x2070 && cp <= 0x209f) || (cp >= 0x27c0 && cp <= 0x27ef) || cp === 0x2212 || cp === 0x00bd;

export function registerFonts(doc, lang) {
  const reg = (name, file) => { if (fs.existsSync(file)) doc.registerFont(name, file); else throw new Error(`Missing font file ${file}`); };
  reg('sym-greek', fontFile('noto-sans', 'noto-sans-greek-400-normal.woff'));
  reg('sym-greek-b', fontFile('noto-sans', 'noto-sans-greek-700-normal.woff'));
  reg('sym-math', fontFile('noto-sans-math', 'noto-sans-math-latin-400-normal.woff'));
  if (lang.script === 'indic') {
    const { pkg, subset } = lang.font;
    reg('ind-r', fontFile(pkg, `${pkg}-${subset}-400-normal.woff`)); reg('ind-b', fontFile(pkg, `${pkg}-${subset}-700-normal.woff`));
    // Latin glyphs come from Noto Sans (the Indic packages' own latin subsets share a font name with the Indic file, which confuses some PDF viewers).
    reg('lat-r', fontFile('noto-sans', 'noto-sans-latin-400-normal.woff')); reg('lat-b', fontFile('noto-sans', 'noto-sans-latin-700-normal.woff'));
  }
}

// Split text into runs of the same font class so every glyph is drawn with a font that has it.
export function splitRuns(text, lang) {
  const runs = []; let cls = 'base';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    let c;
    if (lang.script === 'indic' && isIndic(cp)) c = 'indic'; else if (isGreek(cp)) c = 'greek'; else if (isMath(cp)) c = 'math';
    else if (/\s/.test(ch)) c = cls; // spaces exist in every font: keep runs long
    else c = 'base'; // digits/punctuation/Latin come from the Latin font (Indic/symbol fonts lack them)
    cls = c;
    if (runs.length && runs[runs.length - 1].cls === c) runs[runs.length - 1].text += ch; else runs.push({ cls: c, text: ch });
  }
  return runs;
}

export function fontName(cls, style, lang) {
  if (style === 'code') return 'Courier';
  const bold = style === 'bold' || style === 'head' || style === 'bolditalic'; const italic = style === 'italic' || style === 'bolditalic';
  if (cls === 'math') return 'sym-math';
  if (cls === 'greek') return bold ? 'sym-greek-b' : 'sym-greek';
  if (lang.script === 'indic') return cls === 'indic' ? (bold ? 'ind-b' : 'ind-r') : (bold ? 'lat-b' : 'lat-r');
  if (style === 'head') return 'Helvetica-Bold';
  return bold && italic ? 'Times-BoldItalic' : bold ? 'Times-Bold' : italic ? 'Times-Italic' : 'Times-Roman';
}
