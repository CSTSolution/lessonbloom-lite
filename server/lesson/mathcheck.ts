// Maths answers are never trusted from the model: every item carries an expression and
// the server recomputes it. Supports + - × ÷ ( ) and integers, which covers grades 1-5.
import type { CheckResult, Exercise } from '../types.ts';

const norm = (s: string) => s.replace(/×|x|\*/gi, '*').replace(/÷|:/g, '/').replace(/[−–—]/g, '-').replace(/\s+/g, '');

// Small recursive-descent evaluator, so no eval() on model output.
export function evaluate(expr: string): number {
  const s = norm(expr);
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    if (peek() === '(') { i++; const v = sum(); if (s[i++] !== ')') throw new Error(`missing ) in ${expr}`); return v; }
    if (peek() === '-') { i++; return -num(); }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error(`cannot read "${expr}" at ${i}`);
    i += m[0].length; return parseFloat(m[0]);
  };
  const prod = (): number => {
    let v = num();
    while (peek() === '*' || peek() === '/') { const op = s[i++], r = num(); if (op === '/' && r === 0) throw new Error('division by zero'); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = prod();
    while (peek() === '+' || peek() === '-') { const op = s[i++], r = prod(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  const v = sum();
  if (i !== s.length) throw new Error(`unexpected "${s.slice(i)}" in ${expr}`);
  return Math.round(v * 1e9) / 1e9;
}

const asNum = (s: string) => { const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/\s/g, '')); return m ? parseFloat(m[0].replace(',', '.')) : NaN; };
const fmt = (n: number) => Number.isInteger(n) ? String(n) : String(n).replace('.', ',');   // Vietnamese decimal comma

// "45 - ? = 20" -> 25. Brute force over a sane range: unique, simple, no algebra to get wrong.
export function solveBlank(equation: string): number[] {
  const [l, r] = norm(equation).replace(/…|\.\.\.|_+|□/g, '?').split('=');
  if (r === undefined || !(l + r).includes('?')) throw new Error(`not an equation with a blank: ${equation}`);
  const out: number[] = [];
  for (let x = 0; x <= 10000; x++) {
    try { if (Math.abs(evaluate(l.replace('?', String(x))) - evaluate(r.replace('?', String(x)))) < 1e-9) out.push(x); } catch { /* x makes it invalid */ }
    if (out.length > 1) break;
  }
  return out;
}

export function checkMath(ex: Exercise): CheckResult {
  try {
    switch (ex.type) {
      case 'math_mcq': {
        const v = evaluate(ex.expr), right = ex.options.filter((o) => asNum(o) === v);
        const issues: string[] = [];
        if (right.length !== 1) issues.push(`${right.length} options equal ${fmt(v)}`);
        if (asNum(ex.answer) !== v) issues.push(`answer ${ex.answer} but ${ex.expr} = ${fmt(v)}`);
        return { ok: !issues.length, issues, fixedAnswer: right.length === 1 ? right[0] : undefined };
      }
      case 'math_fill': {
        const xs = solveBlank(ex.equation);
        if (xs.length !== 1) return { ok: false, issues: [xs.length ? 'more than one answer fits' : 'no whole number fits'] };
        return asNum(ex.answer) === xs[0] ? { ok: true, issues: [] } : { ok: false, issues: [`answer ${ex.answer} but the blank is ${xs[0]}`], fixedAnswer: fmt(xs[0]) };
      }
      case 'math_truefalse': {
        const [l, r] = ex.statement.split('=');
        if (r === undefined) return { ok: false, issues: ['statement has no "="'] };
        const truth = Math.abs(evaluate(l) - evaluate(r)) < 1e-9 ? 'true' : 'false';
        return truth === ex.answer ? { ok: true, issues: [] } : { ok: false, issues: [`answer ${ex.answer} but "${ex.statement}" is ${truth}`], fixedAnswer: truth };
      }
      case 'math_word': {
        const v = evaluate(ex.expr);
        if (v < 0 || !Number.isInteger(v)) return { ok: false, issues: [`result ${fmt(v)} is not a whole number a primary pupil can give`] };
        return asNum(ex.answer) === v ? { ok: true, issues: [] } : { ok: false, issues: [`answer ${ex.answer} but ${ex.expr} = ${v}`], fixedAnswer: fmt(v) };
      }
      default: return { ok: true, issues: [] };
    }
  } catch (e) {
    return { ok: false, issues: [`cannot check: ${(e as Error).message}`] };
  }
}
