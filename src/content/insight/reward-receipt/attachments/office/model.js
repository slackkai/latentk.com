/**
 * 送咖啡的办公室：纯模型（没有 DOM），工作台页面和测试共用。
 *
 * 机器人不是会学习的智能体，而是「完美员工」：拿到价目表，就用有限时域动态规划（逆向归纳）
 * 算出让小票合计最高的走法。它钻的每一个空子，都是这张价目表下的精确最优解。
 *
 * 规则：每一步可以原地等，或者上下左右走一格（撞墙的方向不算选项）。
 * 走进老板桌 = 送到，走进楼梯口 = 掉下去，两种都立刻收工；电量 30 步，用完也收工。
 * 状态 = (格子, 已用步数, 花瓶碎了?, 猫被踩了?)。
 */

/** 地图：# 墙　. 地板　D 充电桩　B 老板桌　S 楼梯口　V 花瓶的位置　C 猫睡觉的位置 */
export const MAP = [
  '######..B',
  '######...',
  'S#...###.',
  '.#.C.###.',
  '...V.....',
  'D########',
];
export const W = MAP[0].length, H = MAP.length;
export const HORIZON = 30;

/** 墙按房间画：[名字, x, y, 宽, 高]（给界面用）。 */
export const ROOMS = [
  ['会议室', 0, 0, 6, 2],
  ['', 1, 2, 1, 2],
  ['打印间', 5, 2, 3, 2],
  ['一排工位', 1, 5, 8, 1],
];

/** 动作的顺序也是平局规则的最后一环：等、上、右、下、左。 */
export const ACTIONS = [
  { id: 'wait', dx: 0, dy: 0 },
  { id: 'up', dx: 0, dy: -1 },
  { id: 'right', dx: 1, dy: 0 },
  { id: 'down', dx: 0, dy: 1 },
  { id: 'left', dx: -1, dy: 0 },
];

/** 价目表可能出现的行；小票按这个顺序打印。 */
export const TERMS = {
  deliver: { label: '送到老板桌', short: '送到' },
  step: { label: '每走一步耗电', short: '耗电', note: '原地等也算一步' },
  fall: { label: '掉下楼梯', short: '掉下楼梯' },
  closer: { label: '每靠近一步', short: '靠近' },
  away: { label: '每离开一步', short: '离开' },
  vase: { label: '打碎花瓶', short: '打碎花瓶' },
  cat: { label: '踩到猫', short: '踩到猫' },
};
export const TERM_ORDER = Object.keys(TERMS);

/** 状态里的两个标记位。 */
const VASE = 1, CAT = 2;
/** 比较合计时的容差：差不到它就算平局，交给平局规则。 */
export const EPS = 1e-9;

/**
 * 搭一个办公室。extras.vase / extras.cat 决定走廊里有没有花瓶、休息区有没有猫（第 4 单才有）。
 * dist 是绕墙走的真实最短距离（从老板桌往外 BFS）；楼梯口只算作死路的尽头，不从它继续往外走。
 */
export function makeWorld(extras = {}) {
  const cells = [], index = new Map();
  let dock = -1, desk = -1, stairs = -1, vase = -1, cat = -1;
  MAP.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') return;
    const id = cells.length;
    cells.push({ x, y, ch });
    index.set(`${x},${y}`, id);
    if (ch === 'D') dock = id;
    if (ch === 'B') desk = id;
    if (ch === 'S') stairs = id;
    if (ch === 'V' && extras.vase) vase = id;
    if (ch === 'C' && extras.cat) cat = id;
  }));
  const at = (x, y) => index.get(`${x},${y}`) ?? -1;
  // 每个格子能做的动作：[动作序号, 目标格子]；撞墙的方向不列出来
  const moves = cells.map(({ x, y }) => ACTIONS.map((a, i) => [i, at(x + a.dx, y + a.dy)]).filter(([, to]) => to >= 0));
  const dist = new Array(cells.length).fill(Infinity);
  dist[desk] = 0;
  const queue = [desk];
  while (queue.length) {
    const id = queue.shift();
    if (id === stairs) continue;
    for (const [, to] of moves[id]) if (dist[to] === Infinity) { dist[to] = dist[id] + 1; queue.push(to); }
  }
  // 平局规则（写死）：先「原地等」，再「走完离老板桌更近」，再按 上、右、下、左。
  // 每个格子的动作按这个顺序排好，打平时取排在前面的那个。
  const rank = ([a, to]) => [a === 0 ? 0 : 1, dist[to], a];
  for (const list of moves) list.sort((p, q) => {
    const [a1, b1, c1] = rank(p), [a2, b2, c2] = rank(q);
    return a1 - a2 || b1 - b2 || c1 - c2;
  });
  return { cells, at, moves, dist, dock, desk, stairs, vase, cat };
}

/**
 * 走一步会发生什么：返回 { flags, events, end }。events 是这一步要记在小票上的事，
 * end 是收工的原因（'deliver' / 'fall'，没收工是 null）。花瓶只能碎一次，猫被踩一次就跑了。
 */
export function stepOf(world, cell, flags, to) {
  const events = ['step'];
  const before = world.dist[cell], after = world.dist[to];
  if (after < before) events.push('closer');
  else if (after > before) events.push('away');
  let next = flags, end = null;
  if (to === world.vase && !(flags & VASE)) { events.push('vase'); next |= VASE; }
  if (to === world.cat && !(flags & CAT)) { events.push('cat'); next |= CAT; }
  if (to === world.desk) { events.push('deliver'); end = 'deliver'; }
  else if (to === world.stairs) { events.push('fall'); end = 'fall'; }
  return { flags: next, events, end };
}

/** 一步值多少分：价目表里没有的行不算钱——机器人眼里它就不存在。 */
export const priceOf = (prices, events) => events.reduce((sum, e) => sum + (prices[e] ?? 0), 0);

/**
 * 逆向归纳：从第 30 步（没电，之后什么都不再发生，值为 0）往回算，每个状态记下「从这里开始最多还能拿几分」
 * 和取到它的那个动作。打平（差不到 EPS）时按 makeWorld 里排好的顺序取第一个。
 */
export function solve(world, prices, horizon = HORIZON) {
  const n = world.cells.length, size = (horizon + 1) * n * 4;
  const value = new Float64Array(size), choice = new Int8Array(size).fill(-1);
  const key = (t, cell, flags) => (t * n + cell) * 4 + flags;
  for (let t = horizon - 1; t >= 0; t--) {
    for (let cell = 0; cell < n; cell++) {
      if (cell === world.desk || cell === world.stairs) continue;
      for (let flags = 0; flags < 4; flags++) {
        let best = -Infinity, pick = -1;
        for (const [a, to] of world.moves[cell]) {
          const s = stepOf(world, cell, flags, to);
          const q = priceOf(prices, s.events) + (s.end ? 0 : value[key(t + 1, to, s.flags)]);
          if (q > best + EPS) { best = q; pick = a; }
        }
        value[key(t, cell, flags)] = best;
        choice[key(t, cell, flags)] = pick;
      }
    }
  }
  return { world, prices, horizon, value, choice, key };
}

/** 从充电桩出发，每一步交给 pick(t, cell, flags) 决定动作，一直走到收工。 */
export function trace(world, pick, horizon = HORIZON) {
  const steps = [];
  let cell = world.dock, flags = 0, end = 'timeout';
  for (let t = 0; t < horizon; t++) {
    const a = pick(t, cell, flags);
    const to = world.moves[cell].find(([i]) => i === a)[1];
    const s = stepOf(world, cell, flags, to);
    steps.push({ t, from: cell, to, action: ACTIONS[a].id, events: s.events });
    cell = to;
    flags = s.flags;
    if (s.end) { end = s.end; break; }
  }
  return { steps, end, cell, flags, length: steps.length };
}

/** 完美员工的走法：解一遍，再照着最优动作走。 */
export function bestTrip(world, prices, horizon = HORIZON) {
  const plan = solve(world, prices, horizon);
  return trace(world, (t, cell, flags) => plan.choice[plan.key(t, cell, flags)], horizon);
}

/** 新手的走法：每一步在能做的动作里均匀随机挑一个。random 可以换成固定种子的函数（测试用）。 */
export function randomTrip(world, random = Math.random, horizon = HORIZON) {
  return trace(world, (t, cell) => {
    const list = world.moves[cell];
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))][0];
  }, horizon);
}

/**
 * 把一趟走法打成小票：价目表里每一行一条（数量 × 单价 = 小计），合计只加这些。
 * 价目表里没有、却真的发生了的事放进 unlisted——它们不算钱。
 */
export function receipt(trip, prices) {
  const counts = {};
  for (const step of trip.steps) for (const e of step.events) counts[e] = (counts[e] ?? 0) + 1;
  const lines = TERM_ORDER.filter(term => term in prices).map(term => {
    const count = counts[term] ?? 0;
    return { term, count, price: prices[term], subtotal: count * prices[term] };
  });
  const unlisted = TERM_ORDER.filter(term => !(term in prices) && counts[term]).map(term => ({ term, count: counts[term] }));
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  return { lines, unlisted, total, end: trip.end, length: trip.length, route: itinerary(trip) };
}

/** 行程摘要：连续的同类步子并成一段——等 ×17、走 ×13、来回 ×8（走过去又原路退回来，算一次来回）。 */
export function itinerary(trip) {
  const parts = [], s = trip.steps;
  const push = kind => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.n++; else parts.push({ kind, n: 1 });
  };
  for (let i = 0; i < s.length; i++) {
    if (s[i].action === 'wait') { push('wait'); continue; }
    const back = s[i + 1];
    if (back && back.action !== 'wait' && back.from === s[i].to && back.to === s[i].from) { push('pace'); i++; continue; }
    push('walk');
  }
  return parts;
}

/**
 * 有多少种走法和最优合计打平（每一步选哪个动作不同，就算不同的走法）。
 * 第 1 单用它说明：只写了「送到 +10」时，早到晚到一样多分，打平的走法多得数不过来。
 */
export function countTies(plan) {
  const { world, prices, horizon, value, key } = plan;
  const n = world.cells.length;
  const ways = new Float64Array((horizon + 1) * n * 4).fill(1);
  for (let t = horizon - 1; t >= 0; t--) for (let cell = 0; cell < n; cell++) {
    if (cell === world.desk || cell === world.stairs) continue;
    for (let flags = 0; flags < 4; flags++) {
      const best = value[key(t, cell, flags)];
      let sum = 0;
      for (const [, to] of world.moves[cell]) {
        const s = stepOf(world, cell, flags, to);
        const q = priceOf(prices, s.events) + (s.end ? 0 : value[key(t + 1, to, s.flags)]);
        if (q >= best - EPS) sum += s.end ? 1 : ways[key(t + 1, to, s.flags)];
      }
      ways[key(t, cell, flags)] = sum;
    }
  }
  return ways[key(0, world.dock, 0)];
}

/**
 * 新手乱走 30 步的精确结局概率（不是抽样）：把「现在在哪一格」的概率一步步往前推。
 * 返回 { deliver, fall, timeout }，三者相加为 1。
 */
export function randomOdds(world, horizon = HORIZON) {
  let now = new Map([[world.dock, 1]]);
  const odds = { deliver: 0, fall: 0, timeout: 0 };
  for (let t = 0; t < horizon; t++) {
    const next = new Map();
    for (const [cell, p] of now) {
      const list = world.moves[cell];
      for (const [, to] of list) {
        const q = p / list.length;
        if (to === world.desk) odds.deliver += q;
        else if (to === world.stairs) odds.fall += q;
        else next.set(to, (next.get(to) ?? 0) + q);
      }
    }
    now = next;
  }
  for (const p of now.values()) odds.timeout += p;
  return odds;
}

/**
 * 找翻转点：价目表里某一行在 [lo, hi] 之间变化时，完美员工的结局在哪个价位变了。
 * 两端结局相同就返回 null。二分到 1e-6，返回的是「结局仍然和 hi 端相同」的最低价位附近。
 */
export function flipPoint(world, prices, term, lo, hi) {
  const endAt = price => bestTrip(world, { ...prices, [term]: price }).end;
  const low = endAt(lo), high = endAt(hi);
  if (low === high) return null;
  for (let i = 0; i < 60 && hi - lo > 1e-6; i++) {
    const mid = (lo + hi) / 2;
    if (endAt(mid) === high) hi = mid; else lo = mid;
  }
  return { at: (lo + hi) / 2, low, high };
}

/** 分数的写法：最多两位小数，负号用真正的减号。 */
export function money(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) < 0.005) return '0';
  const text = Math.abs(rounded).toFixed(2).replace(/\.?0+$/, '');
  return (rounded < 0 ? '−' : '+') + text;
}

/** 大数的中文写法：12345 → 「1.2 万」，3.2e12 → 「3.2 万亿」。 */
export function bigCount(n) {
  const units = [[1e16, '亿亿'], [1e12, '万亿'], [1e8, '亿'], [1e4, '万']];
  for (const [base, unit] of units) if (n >= base) return `${(n / base).toPrecision(2).replace(/\.0$/, '')} ${unit}`;
  return String(Math.round(n));
}
