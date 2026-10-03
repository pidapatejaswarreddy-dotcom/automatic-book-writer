// Solved-problem generators. All arithmetic is computed, so demo answers are always correct.
const f = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
const GENS = [
  (r) => { const V = r.int(6, 48), R = r.pick([2, 3, 4, 6, 8, 12]); const I = V / R; return { title: "Ohm's Law", problem: `A circuit has a voltage of ${V} V and a resistance of ${R} Ω. Find the current.`, given: [`V = ${V} V`, `R = ${R} Ω`], formula: 'I = V / R', steps: [`I = ${V} / ${R}`, `I = ${f(I)} A`], answer: `Current = ${f(I)} A` }; },
  (r) => { const l = r.int(5, 20), w = r.int(3, 12); return { title: 'Area of a Rectangle', problem: `A rectangle is ${l} m long and ${w} m wide. Find its area.`, given: [`length l = ${l} m`, `width w = ${w} m`], formula: 'A = l × w', steps: [`A = ${l} × ${w}`, `A = ${l * w} m²`], answer: `Area = ${l * w} m²` }; },
  (r) => { const t = r.int(2, 8), s = r.int(10, 90); const d = s * t; return { title: 'Speed, Distance and Time', problem: `A car travels at ${s} km/h for ${t} hours. How far does it go?`, given: [`speed s = ${s} km/h`, `time t = ${t} h`], formula: 'd = s × t', steps: [`d = ${s} × ${t}`, `d = ${d} km`], answer: `Distance = ${d} km` }; },
  (r) => { const a = r.int(2, 9), x = r.int(2, 12), b = r.int(1, 15); const c = a * x + b; return { title: 'Solving a Linear Equation', problem: `Solve ${a}x + ${b} = ${c}.`, given: [`${a}x + ${b} = ${c}`], formula: 'ax + b = c  ⇒  x = (c − b) / a', steps: [`${a}x = ${c} − ${b} = ${c - b}`, `x = ${c - b} / ${a}`, `x = ${x}`], answer: `x = ${x}` }; },
  (r) => { const P = r.pick([500, 1000, 2000, 5000]), rt = r.int(2, 9), n = r.int(1, 5); const I = (P * rt * n) / 100; return { title: 'Simple Interest', problem: `Find the simple interest on ${P} at ${rt}% per year for ${n} years.`, given: [`P = ${P}`, `r = ${rt}%`, `n = ${n} years`], formula: 'I = P × r × n / 100', steps: [`I = ${P} × ${rt} × ${n} / 100`, `I = ${f(I)}`], answer: `Interest = ${f(I)}` }; },
  (r) => { const V = r.pick([12, 24, 120, 230]), I = r.int(2, 10); return { title: 'Electric Power', problem: `A device draws ${I} A at ${V} V. Find the power it uses.`, given: [`V = ${V} V`, `I = ${I} A`], formula: 'P = V × I', steps: [`P = ${V} × ${I}`, `P = ${V * I} W`], answer: `Power = ${V * I} W` }; },
];
export function makeProblem(r) { return GENS[Math.floor(r() * GENS.length)](r); }
export function renderSolved(p) {
  return `:::example ${p.title}\n**Problem:** ${p.problem}\n\n**Given:**\n${p.given.map((g) => `- ${g}`).join('\n')}\n\n**Formula:**\n\n$$${p.formula}$$\n\n**Solution:**\n${p.steps.map((s) => `- ${s}`).join('\n')}\n\n**Answer:** ${p.answer}\n:::`;
}
