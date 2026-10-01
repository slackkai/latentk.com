/**
 * 三个实验共用的纯模型：没有 DOM，页面和 checks.test.js 都从这里取数。
 * 带种子的随机数 → 正态采样 → 点积 → softmax 和它的雅可比。同一个种子永远给出同一串数，
 * 所以文章里写的每个数都能在测试里原样算出来。
 */

/** mulberry32：32 位状态的小随机数发生器，返回 [0, 1) 的均匀数。 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller：两个均匀数换两个独立的标准正态数（均值 0、方差 1），第二个留给下一次调用。 */
export function normal(rand) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    let u = 0;
    while (u === 0) u = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * rand();
    spare = r * Math.sin(angle);
    return r * Math.cos(angle);
  };
}

export const vector = (gauss, d) => Array.from({ length: d }, () => gauss());

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function mean(xs) {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** 标准差。文中说的「典型大小」就是它：大约三分之二的值落在 ±1 个标准差以内。 */
export function sd(xs) {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / xs.length);
}

/** 抽 n 对 d 维随机向量，分量独立、均值 0、方差 1（正是脚注 4 的假设），返回每对的点积。 */
export function sampleDots(d, n, seed) {
  const gauss = normal(rng(seed));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < d; j++) s += gauss() * gauss();
    out[i] = s;
  }
  return out;
}

/** 把值数进 bins 个等宽格子；超出 [lo, hi) 的算进两头的格子。 */
export function histogram(values, lo, hi, bins) {
  const counts = new Array(bins).fill(0);
  const width = (hi - lo) / bins;
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)))]++;
  return counts;
}

/** softmax：先减去最大值再取指数，分数再大也不会溢出。 */
export function softmax(scores) {
  const top = Math.max(...scores);
  const e = scores.map(s => Math.exp(s - top));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / total);
}

/** softmax 的雅可比 J[i][j] = ∂pᵢ/∂sⱼ = pᵢ(δᵢⱼ − pⱼ)：第 j 个分数挪一点，第 i 个权重跟着挪多少。 */
export function jacobian(p) {
  return p.map((pi, i) => p.map((pj, j) => (i === j ? pi * others(p, i) : -pi * pj)));
}

/** 除第 i 个以外的权重之和，也就是 1 − pᵢ。pᵢ 贴近 1 时直接算 1 − pᵢ 会丢掉全部有效数字，所以逐项加。 */
function others(p, i) {
  let s = 0;
  for (let j = 0; j < p.length; j++) if (j !== i) s += p[j];
  return s;
}

/** 第 i 个位置的灵敏度 pᵢ(1 − pᵢ)，就是雅可比的对角元。它最大是 1/4，在 pᵢ = 1/2 时取到。 */
export const sensitivity = (p, i) => p[i] * others(p, i);

/** 三种缩放：分数乘上的系数。 */
export const SCALES = {
  none: () => 1,
  sqrt: d => 1 / Math.sqrt(d),
  linear: d => 1 / d,
};

/**
 * 一行分数的「形状」：抽 keys 个标准正态数，再标准化成均值 0、标准差正好 1。
 * 乘上尺度 s 就得到一行标准差为 s 的分数。只改大小、不改相对高低，才能单独看「变大」这一件事。
 */
export function scoreShape(seed, keys = 8) {
  const gauss = normal(rng(seed));
  const z = Array.from({ length: keys }, () => gauss());
  const m = mean(z), s = sd(z);
  return z.map(x => (x - m) / s);
}

/** 把一行分数乘上 scale 再过 softmax，报告赢家是谁、拿走多少、它自己的灵敏度还剩多少。 */
export function weigh(shape, scale = 1) {
  const scores = shape.map(s => s * scale);
  const p = softmax(scores);
  let top = 0;
  for (let j = 1; j < p.length; j++) if (p[j] > p[top]) top = j;
  return { scores, p, top, share: p[top], signal: sensitivity(p, top) };
}

/** 第三个实验横轴上的维度。 */
export const DIMS = [4, 8, 16, 32, 64, 128, 256, 512];

/** 每个维度抽 n 对向量，量点积的标准差。三种缩放只是再乘一个系数，所以共用同一批样本。 */
export function spreadCurve(n, seed, dims = DIMS) {
  return dims.map((d, i) => {
    const raw = sd(sampleDots(d, n, seed + i));
    return { d, none: raw, sqrt: raw * SCALES.sqrt(d), linear: raw * SCALES.linear(d) };
  });
}

/** 醉汉走 n 步，每步向左或向右 1 格；返回 trials 个醉汉最后离家多远（带正负号）。 */
export function walks(n, trials, seed) {
  const rand = rng(seed);
  const out = new Float64Array(trials);
  for (let t = 0; t < trials; t++) {
    let x = 0;
    for (let i = 0; i < n; i++) x += rand() < 0.5 ? -1 : 1;
    out[t] = x;
  }
  return out;
}
