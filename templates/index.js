import educational from './educational.js';
import mathematics from './mathematics.js';
import technical from './technical.js';
import novel from './novel.js';
import shortStories from './short-stories.js';
import selfHelp from './self-help.js';
import biography from './biography.js';
import business from './business.js';

// To add a book type: create templates/<id>.js with defineTemplate({...}) and register it here.
const TEMPLATES = [educational, mathematics, technical, novel, shortStories, selfHelp, biography, business];
const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id) => byId.get(id) || null;
export const hasTemplate = (id) => byId.has(id);
export const listTemplates = () => TEMPLATES.map(({ id, name, icon, description, structure, settings, defaults, chapterLabel }) => ({ id, name, icon, description, structure, settings, defaults, chapterLabel }));
