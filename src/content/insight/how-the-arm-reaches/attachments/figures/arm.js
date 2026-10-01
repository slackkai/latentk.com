/**
 * 平面串联机械臂的数学，文中每张图共用。没有 DOM，可以直接在 Node 里跑测试。
 * 坐标沿用 SVG：x 向右、y 向下。每节连杆的角度是它相对「水平向右」的绝对朝向（弧度），
 * 和首页 src/components/Hero.astro 的写法一致；因为 y 朝下，正角度在屏幕上是顺时针。
 */

export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const toDeg = r => (r * 180) / Math.PI;
export const toRad = d => (d * Math.PI) / 180;
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const heading = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

/** 正运动学：从底座出发，沿每节连杆的朝向走过它的长度。返回底座、各关节和指尖的位置。 */
export function forward(base, lens, angles) {
  const pts = [{ x: base.x, y: base.y }];
  let x = base.x, y = base.y;
  for (let i = 0; i < lens.length; i++) {
    x += Math.cos(angles[i]) * lens[i];
    y += Math.sin(angles[i]) * lens[i];
    pts.push({ x, y });
  }
  return pts;
}

/** 绝对朝向 → 关节转角：第一个是肩相对水平，之后每个是这一节相对上一节。 */
export const toRelative = abs => abs.map((a, i) => (i ? wrap(a - abs[i - 1]) : wrap(a)));

/** 关节转角 → 绝对朝向：一路累加。 */
export function toAbsolute(rel) {
  let sum = 0;
  return rel.map(r => (sum += r));
}

/**
 * 两连杆解析逆运动学。三条边 l1、l2、d 都已知，三角形的形状就定了，只剩朝哪边翻：
 * 所以一般有两个解（bend 是肘关节转角的正负号），贴边时两个解重合，够不着时返回空数组。
 */
export function solveTwoLink(base, l1, l2, target) {
  const d = dist(base, target);
  if (d > l1 + l2 + 1e-9 || d < Math.abs(l1 - l2) - 1e-9 || d === 0) return [];
  const c = clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const toward = heading(base, target);
  return [1, -1].map(bend => {
    const q = bend * Math.acos(c);
    const a1 = toward - Math.atan2(l2 * Math.sin(q), l1 + l2 * Math.cos(q));
    return { bend, angles: [a1, a1 + q] };
  });
}

/** 余弦定理里那个角：肘部的内角（上臂和前臂之间的夹角），d 越远它越张开。 */
export function elbowInterior(l1, l2, d) {
  return Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
}

/**
 * 目标离肩膀 d 时有几个解。eps 是「贴边」的宽容度，方便在图上拖出恰好一个解的情况。
 * kind：inside 圆环里、outer 贴外圈、inner 贴内圈、far 太远、near 太近（内圈的洞里）、center 两节等长且目标就在肩上。
 */
export function countSolutions(l1, l2, d, eps = 0) {
  const outer = l1 + l2, inner = Math.abs(l1 - l2);
  if (inner < 1e-9 && d <= eps) return { count: Infinity, kind: 'center' };
  if (d > outer + eps) return { count: 0, kind: 'far' };
  if (d >= outer - eps) return { count: 1, kind: 'outer' };
  if (d < inner - eps) return { count: 0, kind: 'near' };
  if (d <= inner + eps) return { count: 1, kind: 'inner' };
  return { count: 2, kind: 'inside' };
}

/** 够不着时离目标最近的姿态：太远就伸直指过去；太近就折起来，长的那一节决定指尖停在哪一侧。 */
export function nearestTwoLink(base, l1, l2, target) {
  const toward = heading(base, target);
  if (dist(base, target) < 1e-9 && Math.abs(l1 - l2) < 1e-9) return [0, Math.PI];
  if (dist(base, target) >= Math.abs(l1 - l2)) return [toward, toward];
  return l1 >= l2 ? [toward, toward + Math.PI] : [toward + Math.PI, toward];
}

/**
 * 图上用的两连杆姿态：够得着就取 bend 那一支（另一支放在 other 里），够不着就取最近姿态。
 * eps 内的贴边目标也算够得着，指尖会被吸到圈上。
 */
export function twoLinkPose(base, l1, l2, target, bend = 1, eps = 0) {
  const d = dist(base, target);
  const { count, kind } = countSolutions(l1, l2, d, eps);
  let aim = target;
  if (count === 1) {
    const r = kind === 'outer' ? l1 + l2 : Math.abs(l1 - l2);
    const toward = heading(base, target);
    aim = { x: base.x + Math.cos(toward) * r, y: base.y + Math.sin(toward) * r };
  }
  const sols = count === 1 || count === 2 ? solveTwoLink(base, l1, l2, aim) : [];
  if (!sols.length) return { count, kind, angles: nearestTwoLink(base, l1, l2, target), other: null };
  const pick = sols.find(s => s.bend === bend) ?? sols[0];
  const other = count === 2 ? sols.find(s => s !== pick).angles : null;
  return { count, kind, angles: pick.angles, other };
}

/**
 * CCD 的一步：只转第 i 个关节，把「关节→指尖」这条线转向「关节→目标」，gain 是转过去的比例。
 * 转一个关节，它后面的连杆跟着一起转，所以绝对朝向 angles[i..] 都加同一个角度。
 * limits 可选：每个关节转角（相对上一节，肩相对水平）的 [lo, hi]。返回实际转过的角度。
 */
export function ccdStep(base, lens, angles, i, target, gain = 1, limits = null) {
  const pts = forward(base, lens, angles);
  const pivot = pts[i], end = pts[pts.length - 1];
  const a1 = Math.atan2(end.y - pivot.y, end.x - pivot.x);
  const a2 = Math.atan2(target.y - pivot.y, target.x - pivot.x);
  let d = a2 - a1;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  let turn = d * gain;
  if (limits?.[i]) {
    const [lo, hi] = limits[i];
    const mid = (lo + hi) / 2;
    const rel = i ? angles[i] - angles[i - 1] : angles[i];
    const now = mid + wrap(rel - mid);
    turn = clamp(now + turn, lo, hi) - now;
  }
  for (let k = i; k < angles.length; k++) angles[k] += turn;
  return turn;
}

/** 首页 solve() 的同一套循环：每一遍从最后一个关节转到底座，重复 iters 遍。原地修改 angles。 */
export function ccdSolve(base, lens, angles, target, iters = 6, gain = 0.6, limits = null) {
  for (let iter = 0; iter < iters; iter++) {
    for (let i = lens.length - 1; i >= 0; i--) ccdStep(base, lens, angles, i, target, gain, limits);
  }
  return angles;
}

/** 三连杆、指尖钉在 target 上：给定肩膀朝向 a0，后两节按两连杆解析解摆好。后两节够不着时返回 null。 */
export function pinnedThreeLink(base, lens, a0, target, bend = 1) {
  const p1 = { x: base.x + Math.cos(a0) * lens[0], y: base.y + Math.sin(a0) * lens[0] };
  const sols = solveTwoLink(p1, lens[1], lens[2], target);
  if (!sols.length) return null;
  const pick = sols.find(s => s.bend === bend) ?? sols[0];
  return [a0, ...pick.angles];
}

/**
 * 指尖钉住时肩膀朝向能取的范围：第一个关节离目标的距离必须落在后两节够得着的圆环里。
 * |P1 − T|² = D² + l1² − 2·l1·D·cos(a0 − φ)，于是 cos(a0 − φ) 被夹在两个数之间。
 * 返回若干 [lo, hi] 区间（弧度，lo < hi）；一个都没有说明指尖钉的地方整条手臂都够不着。
 */
export function shoulderRange(base, lens, target) {
  const [l1, l2, l3] = lens;
  const D = dist(base, target), phi = heading(base, target);
  const rmin = Math.abs(l2 - l3), rmax = l2 + l3;
  if (D < 1e-9) return l1 >= rmin && l1 <= rmax ? [[-Math.PI, Math.PI]] : [];
  const cosLo = (D * D + l1 * l1 - rmax * rmax) / (2 * l1 * D);
  const cosHi = (D * D + l1 * l1 - rmin * rmin) / (2 * l1 * D);
  if (cosLo > 1 || cosHi < -1 || cosLo > cosHi) return [];
  const outer = Math.acos(clamp(cosLo, -1, 1));
  const inner = Math.acos(clamp(cosHi, -1, 1));
  if (outer >= Math.PI - 1e-9) return inner <= 1e-9 ? [[-Math.PI, Math.PI]] : [[phi + inner, phi + 2 * Math.PI - inner]];
  if (inner <= 1e-9) return [[phi - outer, phi + outer]];
  return [[phi - outer, phi - inner], [phi + inner, phi + outer]];
}

/** 把角度 a 放进最近的可行区间（考虑绕一圈回来的情况）。 */
export function clampToRanges(a, ranges) {
  let best = null, bestGap = Infinity;
  for (const [lo, hi] of ranges) {
    const t = lo + ((((a - lo) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    if (t <= hi) return t;
    for (const edge of [lo, hi]) {
      const gap = Math.abs(wrap(a - edge));
      if (gap < bestGap) { bestGap = gap; best = edge; }
    }
  }
  return best;
}

/** 雅可比矩阵的每一列：只让第 i 个关节以单位角速度转动时，指尖的速度——垂直于「关节→指尖」，长度等于两者的距离。 */
export function jacobianColumns(points) {
  const end = points[points.length - 1];
  return points.slice(0, -1).map(p => ({ x: -(end.y - p.y), y: end.x - p.x }));
}

/** 两列撑开的平行四边形面积（带符号）。两连杆时等于 l1·l2·sin(肘关节转角)，伸直或折叠时为 0。 */
export const cross = (u, v) => u.x * v.y - u.y * v.x;

function segmentsCross(a, b, c, d) {
  const o1 = cross({ x: b.x - a.x, y: b.y - a.y }, { x: c.x - a.x, y: c.y - a.y });
  const o2 = cross({ x: b.x - a.x, y: b.y - a.y }, { x: d.x - a.x, y: d.y - a.y });
  const o3 = cross({ x: d.x - c.x, y: d.y - c.y }, { x: a.x - c.x, y: a.y - c.y });
  const o4 = cross({ x: d.x - c.x, y: d.y - c.y }, { x: b.x - c.x, y: b.y - c.y });
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** 不相邻的两节连杆是否交叉——手臂把自己「打了个结」。 */
export function selfCrossing(points) {
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) return true;
    }
  }
  return false;
}
