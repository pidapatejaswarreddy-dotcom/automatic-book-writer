import { h } from '../ui.js';
import { svgUrl } from '../ui.js';
import { coverToSvg } from '/shared/covers.js';

export default async function home(root, { config }) {
  const cover = coverToSvg({ title: 'Solar Energy for Beginners', subtitle: 'A clear guide', author: 'John Kumar' }, 'midnight');
  root.append(
    h('section', { class: 'hero' },
      h('div', {},
        h('h1', {}, 'Create a Complete Book with AI'),
        h('p', { class: 'lead' }, 'Enter your topic, choose your book type and preferences, and let AI build your book chapter by chapter.'),
        h('div', { class: 'cta' }, h('a', { class: 'btn primary', href: '#/new' }, 'Create New Book'), h('a', { class: 'btn', href: '#/books' }, 'My Books'))),
      h('div', { class: 'hero-cover' }, h('img', { src: svgUrl(cover), alt: 'Sample book cover: Solar Energy for Beginners' }))),
    h('h2', {}, 'How It Works'),
    h('ol', { class: 'steps-how' }, ['Enter Topic', 'Choose Book Type', 'Customize Your Book', 'Review Outline', 'Generate Book', 'Download'].map((t) => h('li', {}, t))),
    h('h2', {}, 'Supported Book Types'),
    h('div', { class: 'type-grid' }, config.bookTypes.map((t) => h('div', { class: 'card' }, h('div', { class: 'type-card icon', style: 'padding:0;border:0;background:none' }, h('span', { class: 'icon' }, t.icon)), h('h3', {}, t.name), h('p', { class: 'muted' }, t.description)))));
}
