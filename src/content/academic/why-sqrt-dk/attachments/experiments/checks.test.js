// Run: node --test src/content/academic/why-sqrt-dk/attachments/experiments/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDots, sd, softmax, jacobian, scoreShape, weigh, spreadCurve, DIMS, SCALES, histogram } from './model.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('fixed experiment reproduces the values printed in the article', () => {
  const a = sd(sampleDots(4, 2500, 41)), b = sd(sampleDots(512, 2500, 42));
  assert.equal(a.toFixed(2), '2.01');
  assert.equal(b.toFixed(2), '22.36');
  assert.equal((b / a).toFixed(2), '11.13');
  near(b / a, Math.sqrt(128), .3);
  assert.deepEqual(sampleDots(4, 10, 5), sampleDots(4, 10, 5));
});
test('histogram retains every observation including outside bins', () => {
  assert.equal(histogram([-100, -2, 0, 1, 100], -3, 3, 6).reduce((a, b) => a + b), 5);
});
test('stable softmax normalizes extreme finite scores and ignores common offsets', () => {
  for (const scores of [[1000, 1001, 999], [-1000, -1001], [0, 0, 0]]) {
    const p = softmax(scores);
    near(p.reduce((a, b) => a + b), 1);
    assert.ok(p.every(x => Number.isFinite(x) && x >= 0 && x <= 1));
    softmax(scores.map(x => x + 123)).forEach((v, i) => near(v, p[i]));
  }
});
test('full Jacobian agrees with central finite differences', () => {
  const s = [.3, -1, 2, .8], j = jacobian(softmax(s)), h = 1e-5;
  for (let k = 0; k < s.length; k++) {
    const plus = s.slice(), minus = s.slice(); plus[k] += h; minus[k] -= h;
    const a = softmax(plus), b = softmax(minus);
    for (let i = 0; i < s.length; i++) near(j[i][k], (a[i] - b[i]) / (2 * h));
  }
  for (const row of j) near(row.reduce((a, b) => a + b), 0);
});
test('sensitivity initially rises, then declines toward saturation', () => {
  const shape = scoreShape(41), values = [1, 2, 4, 8, 16, 32].map(s => weigh(shape, s));
  assert.ok(values[1].signal > values[0].signal);
  for (let i = 2; i < values.length; i++) {
    assert.ok(values[i].share > values[i - 1].share);
    assert.ok(values[i].signal < values[i - 1].signal);
  }
  assert.equal((values[4].share * 100).toFixed(2), '99.62');
  assert.equal(values[4].signal.toFixed(5), '0.00379');
  assert.ok(jacobian(values[5].p).flat().every(x => Math.abs(x) < .0001));
});
test('three scales retain, stabilize, or shrink the measured spread', () => {
  const curve = spreadCurve(1000, 70);
  for (const p of curve) {
    near(p.sqrt, p.none / Math.sqrt(p.d));
    near(p.linear, p.none / p.d);
    assert.ok(p.sqrt > .85 && p.sqrt < 1.15);
  }
  assert.ok(curve.at(-1).none > curve[0].none * 9);
  assert.ok(curve.at(-1).linear < curve[0].linear / 9);
  for (const d of DIMS) near(Math.sqrt(d) * SCALES.sqrt(d), 1);
});
