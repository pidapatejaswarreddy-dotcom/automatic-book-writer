// Sentence banks for demo mode. Deterministic (seeded) so tests are stable.
export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  return f;
}
export const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

export const GENERAL = [
  'To understand {S}, it helps to begin with the basic ideas behind {T}.',
  'Within {C}, {S} plays a central role because it connects the fundamentals of {T} to everyday practice.',
  'Readers often find that {S} becomes clear once it is broken into small, manageable parts.',
  'A useful way to think about {T} is to ask what problem it solves and who benefits from the solution.',
  'Over time, the thinking around {T} has changed as new evidence and experience have accumulated.',
  'It is important to separate what is well established about {S} from what is still being explored.',
  'Consider how {S} appears in ordinary situations; the pattern is usually easier to spot than expected.',
  'Each idea in {S} builds on the previous one, so it is worth reading the explanations in order.',
  'Experts studying {T} tend to agree that {S} deserves careful attention before moving on to more advanced topics.',
  'Small details matter here: a slight change in context can change how {S} should be applied.',
  'When the basics of {S} are understood, later topics in {T} feel far more natural.',
  'The main lesson is that {S} is not an isolated fact but part of a larger picture of {T}.',
  'Common questions about {S} usually come down to how it differs from neighbouring ideas in {T}.',
  'Practical experience with {T} shows that steady, deliberate practice with {S} produces the best results.',
];
export const BY_TYPE = {
  technical: ['In practice, {S} is implemented as a set of cooperating components that each handle one responsibility.', 'Data moves through {S} in well-defined stages, which makes the behaviour of {T} predictable and testable.', 'Good engineering of {S} favours clear interfaces, small functions and thorough error handling.', 'A common pitfall with {S} is ignoring edge cases such as empty input or unexpected formats.'],
  business: ['Organisations approach {S} by weighing cost, risk and expected return before committing resources.', 'A sound strategy for {S} begins with a clear view of customers and the problem being solved.', 'Leaders working on {T} often find that {S} succeeds when responsibilities and measures of success are explicit.', 'Every option in {S} carries trade-offs, and the best choice depends on the context of the business.'],
  'self-help': ['You may notice that {S} shows up in your daily routine more often than you expect.', 'Change around {T} rarely happens all at once; small, repeatable steps add up over weeks.', 'Be patient with yourself as you work on {S}; setbacks are a normal part of progress.', 'Ask yourself honestly how {S} affects your days, and write down what you observe.'],
  biography: ['Accounts of {S} emphasise how circumstances and choices shaped the direction of events.', 'Those who knew the subject during {S} often described a determined and curious character.', 'Historians note that {S} was a turning point that is best understood in its wider context.', 'Records from the time are limited, so some details of {S} are described cautiously here.'],
  mathematics: ['In {S}, every symbol in a formula stands for a quantity, so identify what each one means before substituting numbers.', 'Check units at each step of {S}; a mismatch is usually the first sign of an error.', 'Working through {S} slowly and writing every step prevents most careless mistakes.', 'The idea behind {S} is simple: express the relationship as an equation, then solve for the unknown.'],
  educational: ['A helpful analogy makes {S} easier to picture within {C}: think of it as a system with inputs, a process and an output.', 'Key vocabulary for {S} is introduced as it appears, so no prior knowledge of {T} is assumed.'],
};

// Demo text avoids repeating a sentence anywhere in the same book (tracked per scope).
const USED = new Map();
const LEAD = ['', 'Moreover, ', 'In addition, ', 'Notably, ', 'Furthermore, ', 'It is also worth noting that '];
export function paragraphs(r, type, vars, words, scope = vars.T) {
  const pool = [...GENERAL, ...(BY_TYPE[type] || BY_TYPE.educational)];
  if (USED.size > 200) USED.clear();
  const used = USED.get(scope) || USED.set(scope, new Set()).get(scope);
  const paras = []; let count = 0; let bag = [];
  const next = () => {
    for (const lead of LEAD) {
      const cands = [...pool].sort(() => r() - 0.5);
      for (const c of cands) { let t = fill(c, vars); if (lead) t = lead + t[0].toLowerCase() + t.slice(1); if (!used.has(t)) { used.add(t); return t; } }
    }
    return fill(r.pick(pool), vars);
  };
  while (count < words) {
    const n = r.int(3, 5); const s = [];
    for (let i = 0; i < n; i++) s.push(next());
    const p = s.join(' '); paras.push(p); count += p.split(/\s+/).length;
  }
  return paras;
}
