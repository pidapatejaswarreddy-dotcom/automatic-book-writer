import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, parseFigure, parseInline, countWords, extractFigures } from '../shared/content.js';
import { layoutDiagram, diagramToSvg, diagramToAscii } from '../shared/diagram.js';

test('parses headings, lists, code, tables, boxes, equations and figures', () => {
  const b = parseBlocks('### Sub\n\nText **bold** and *it*.\n\n- a\n- b\n\n1. one\n2. two\n\n```js\nlet x = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$$I = V / R$$\n\n:::example Ohm\nProblem: x\n:::\n\n[[FIGURE: flowchart | Cap | A; B; C]]');
  assert.deepEqual(b.map((x) => x.type), ['heading', 'paragraph', 'bullets', 'numbered', 'code', 'table', 'equation', 'box', 'figure']);
  assert.equal(b[7].title, 'Ohm'); assert.equal(b[8].nodes.length, 3);
});
test('inline formatting', () => assert.deepEqual(parseInline('a **b** `c` *d*').map((s) => [s.text, !!s.bold, !!s.code, !!s.italic]), [['a ', false, false, false], ['b', true, false, false], [' ', false, false, false], ['c', false, true, false], [' ', false, false, false], ['d', false, false, true]]));
test('malformed figure directives are rejected', () => { assert.equal(parseFigure('[[FIGURE: flowchart | only two]]'), null); assert.equal(parseFigure('[[FIGURE: flowchart | Cap | just-one]]'), null); });
test('word count ignores markup and figure lines', () => assert.equal(countWords('### Hi there\n\n**two** words\n\n[[FIGURE: flowchart | C | A; B]]'), 4));
test('figures inside boxes are found', () => assert.equal(extractFigures(':::note X\n[[FIGURE: cycle | C | A; B; C]]\n:::').length, 1));
test('every diagram type lays out inside its canvas and renders SVG + ASCII', () => {
  for (const type of ['flowchart', 'process', 'block', 'architecture', 'cycle', 'timeline', 'comparison', 'hierarchy', 'concept-map']) {
    const fig = { figureType: type, caption: 'Cap', nodes: type === 'comparison' ? ['Left: a, b', 'Right: c, d'] : ['Sun', 'Panel', 'Inverter', 'Grid'] };
    const L = layoutDiagram(fig); assert.ok(L.boxes.length >= 2, type);
    L.boxes.forEach((b) => assert.ok(b.x >= -5 && b.x + b.w <= L.width + 5, `${type} box inside width`));
    assert.ok(diagramToSvg(fig).startsWith('<svg')); assert.ok(diagramToAscii(fig).length > 1);
  }
});
test('SVG output escapes markup in labels', () => assert.ok(!diagramToSvg({ figureType: 'flowchart', caption: '<b>', nodes: ['<script>x</script>', 'B'] }).includes('<script>')));
