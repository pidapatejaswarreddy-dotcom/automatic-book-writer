// Language registry. Add a language by appending an entry here (and, for scripts that need
// a special PDF font, a `font` entry pointing at a @fontsource/noto-sans-* package).
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', script: 'latin' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', script: 'indic', font: { pkg: 'noto-sans-telugu', subset: 'telugu' }, docxFont: 'Nirmala UI' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', script: 'indic', font: { pkg: 'noto-sans-tamil', subset: 'tamil' }, docxFont: 'Nirmala UI' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', script: 'indic', font: { pkg: 'noto-sans-devanagari', subset: 'devanagari' }, docxFont: 'Nirmala UI' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', script: 'indic', font: { pkg: 'noto-sans-kannada', subset: 'kannada' }, docxFont: 'Nirmala UI' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', script: 'indic', font: { pkg: 'noto-sans-malayalam', subset: 'malayalam' }, docxFont: 'Nirmala UI' },
];

export const getLanguage = (code) => LANGUAGES.find((l) => l.code === code || l.name.toLowerCase() === String(code).toLowerCase());
