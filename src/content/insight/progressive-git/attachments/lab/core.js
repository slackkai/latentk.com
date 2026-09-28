/**
 * 沙盒的底层工具：与 Git 相同的对象哈希、Myers 行差异、统一差异块、三方合并、日期格式。
 * 不依赖 DOM，可以在 Node 里直接 import 做对照测试。
 */

const encoder = new TextEncoder();
export const utf8 = text => encoder.encode(text);

/** SHA-1，输入字节，输出 40 位十六进制。 */
export function sha1(bytes) {
  const length = bytes.length;
  const words = new Uint32Array((((length + 8) >> 6) + 1) * 16);
  for (let i = 0; i < length; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words[length >> 2] |= 0x80 << (24 - (length % 4) * 8);
  words[words.length - 1] = length * 8;
  words[words.length - 2] = Math.floor((length * 8) / 2 ** 32);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let block = 0; block < words.length; block += 16) {
    for (let i = 0; i < 16; i++) w[i] = words[block + i];
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(h => h.toString(16).padStart(8, '0')).join('');
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function hexBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function object(type, body) {
  return sha1(concat(utf8(`${type} ${body.length}\0`), body));
}

const blobCache = new Map();
/** 与 `git hash-object` 相同的 blob ID。 */
export function blobId(content) {
  let id = blobCache.get(content);
  if (!id) { id = object('blob', utf8(content)); blobCache.set(content, id); }
  return id;
}

/** 与 Git 相同的 tree ID（只有一层文件，模式都是 100644）。 */
export function treeId(tree) {
  const names = Object.keys(tree).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return object('tree', concat(...names.map(name => concat(utf8(`100644 ${name}\0`), hexBytes(blobId(tree[name]))))));
}

const ident = person => `${person.name} <${person.email}> ${person.time} ${person.tz}`;
/** 与 Git 相同的 commit ID：同样的内容、作者、时间和说明，得到同样的哈希。 */
export function commitId({ tree, parents, author, committer, message }) {
  const text = `tree ${treeId(tree)}\n${parents.map(p => `parent ${p}\n`).join('')}author ${ident(author)}\ncommitter ${ident(committer)}\n\n${message}`;
  return object('commit', utf8(text));
}

/** `git commit -m` 的默认清理：去掉首尾空行与行尾空白，连续空行合并，结尾补一个换行。 */
export function cleanMessage(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+$/, ''));
  const out = [];
  for (const line of lines) if (line !== '' || (out.length && out[out.length - 1] !== '')) out.push(line);
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.length ? out.join('\n') + '\n' : '';
}

export const subject = message => message.split('\n')[0];

/** 文件内容 ⇄ 行数组；内容总以换行结尾。 */
export function lines(content) {
  if (!content) return [];
  const parts = content.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}
export const joinLines = list => (list.length ? list.join('\n') + '\n' : '');

/** Myers 差异：返回 [op, aIndex, bIndex]，op 为 '=' '-' '+'。 */
export function diff(a, b) {
  const n = a.length, m = b.length, max = n + m;
  if (max === 0) return [];
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }
  const moves = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d], k = x - y;
    const prevK = k === -d || (k !== d && vd[offset + k - 1] < vd[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = vd[offset + prevK], prevY = prevX - prevK;
    while (x > prevX && y > prevY) { moves.push(['=', x - 1, y - 1]); x--; y--; }
    if (d > 0) moves.push(x === prevX ? ['+', -1, y - 1] : ['-', x - 1, -1]);
    x = prevX; y = prevY;
  }
  return moves.reverse();
}

/** 增删行数，用于 diffstat。 */
export function countChanges(before, after) {
  let add = 0, del = 0;
  for (const [op] of diff(lines(before), lines(after))) { if (op === '+') add++; else if (op === '-') del++; }
  return { add, del };
}

const funcLine = line => /^[A-Za-z_$]/.test(line);

/** 统一差异格式的差异块（3 行上下文），与 `git diff` 的块头格式一致。 */
export function hunks(before, after, context = 3) {
  const a = lines(before), b = lines(after);
  const ops = diff(a, b);
  const changes = [];
  ops.forEach(([op], i) => { if (op !== '=') changes.push(i); });
  if (!changes.length) return [];
  const groups = [];
  let start = changes[0], end = changes[0];
  for (const i of changes.slice(1)) {
    if (i - end - 1 <= context * 2) end = i;
    else { groups.push([start, end]); start = end = i; }
  }
  groups.push([start, end]);
  return groups.map(([first, last]) => {
    const from = Math.max(0, first - context), to = Math.min(ops.length, last + context + 1);
    let aBefore = 0, bBefore = 0;
    for (let i = 0; i < from; i++) { if (ops[i][0] !== '+') aBefore++; if (ops[i][0] !== '-') bBefore++; }
    const body = [];
    let aCount = 0, bCount = 0;
    for (let i = from; i < to; i++) {
      const [op, ai, bi] = ops[i];
      if (op === '=') { body.push([' ', a[ai]]); aCount++; bCount++; }
      else if (op === '-') { body.push(['-', a[ai]]); aCount++; }
      else { body.push(['+', b[bi]]); bCount++; }
    }
    const range = (before, count) => `${count === 0 ? before : before + 1}${count === 1 ? '' : ',' + count}`;
    let func = '';
    for (let i = aBefore - 1; i >= 0; i--) if (funcLine(a[i])) { func = a[i].replace(/\s+$/, '').slice(0, 80); break; }
    return { header: `@@ -${range(aBefore, aCount)} +${range(bBefore, bCount)} @@${func ? ' ' + func : ''}`, body };
  });
}

const same = (x, y) => x.length === y.length && x.every((line, i) => line === y[i]);

/**
 * 三方合并（diff3）：base 为共同祖先，冲突处写入 Git 格式的冲突标记。
 * 返回 { content, conflicts }。
 */
export function merge3(base, ours, theirs, labels = { ours: 'HEAD', theirs: 'theirs' }) {
  const B = lines(base), O = lines(ours), T = lines(theirs);
  const inO = new Int32Array(B.length).fill(-1), inT = new Int32Array(B.length).fill(-1);
  for (const [op, bi, oi] of diff(B, O)) if (op === '=') inO[bi] = oi;
  for (const [op, bi, ti] of diff(B, T)) if (op === '=') inT[bi] = ti;
  const out = [];
  let conflicts = 0, b = 0, o = 0, t = 0;
  for (;;) {
    let i = b;
    while (i < B.length && !(inO[i] >= o && inT[i] >= t)) i++;
    const oEnd = i < B.length ? inO[i] : O.length, tEnd = i < B.length ? inT[i] : T.length;
    const bc = B.slice(b, i), oc = O.slice(o, oEnd), tc = T.slice(t, tEnd);
    if (bc.length || oc.length || tc.length) {
      if (same(oc, bc)) out.push(...tc);
      else if (same(tc, bc) || same(oc, tc)) out.push(...oc);
      else {
        let p = 0;
        while (p < oc.length && p < tc.length && oc[p] === tc[p]) p++;
        let s = 0;
        while (s < oc.length - p && s < tc.length - p && oc[oc.length - 1 - s] === tc[tc.length - 1 - s]) s++;
        out.push(...oc.slice(0, p), `<<<<<<< ${labels.ours}`, ...oc.slice(p, oc.length - s), '=======', ...tc.slice(p, tc.length - s), `>>>>>>> ${labels.theirs}`, ...oc.slice(oc.length - s));
        conflicts++;
      }
    }
    if (i >= B.length) break;
    out.push(B[i]);
    b = i + 1; o = oEnd + 1; t = tEnd + 1;
  }
  return { content: joinLines(out), conflicts };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const tzMinutes = tz => (tz[0] === '-' ? -1 : 1) * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));

/** Git 默认日期格式：Sun Sep 27 14:00:00 2026 +0800 */
export function gitDate(time, tz) {
  const d = new Date((time + tzMinutes(tz) * 60) * 1000);
  const two = n => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${d.getUTCFullYear()} ${tz}`;
}

/** 浏览器当前时区，格式 +0800。 */
export function localTz(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const abs = Math.abs(offset);
  return `${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

/** Git 的加权 Damerau-Levenshtein（help.c 用它推荐“最相近的命令”）：交换 0、替换 2、插入 1、删除 3。 */
export function distance(a, b, w = 0, s = 2, add = 1, del = 3) {
  let row0 = new Array(b.length + 1).fill(0);
  let row1 = Array.from({ length: b.length + 1 }, (_, j) => j * add);
  let row2 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    row2[0] = (i + 1) * del;
    for (let j = 0; j < b.length; j++) {
      row2[j + 1] = row1[j] + s * (a[i] !== b[j] ? 1 : 0);
      if (i > 0 && j > 0 && a[i - 1] === b[j] && a[i] === b[j - 1] && row2[j + 1] > row0[j - 1] + w) row2[j + 1] = row0[j - 1] + w;
      if (row2[j + 1] > row1[j + 1] + del) row2[j + 1] = row1[j + 1] + del;
      if (row2[j + 1] > row2[j] + add) row2[j + 1] = row2[j] + add;
    }
    [row0, row1, row2] = [row1, row2, row0];
  }
  return row1[b.length];
}
