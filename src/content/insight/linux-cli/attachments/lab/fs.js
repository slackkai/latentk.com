/**
 * 一层深的迷你文件系统：家目录下若干文件夹，文件夹里若干文件。
 * 权限是 9 位 rwx 字符串，足够讲清楚 ls -l、chmod、以及「为什么不能执行」。
 * 不模拟用户切换：你永远是 kai，属主位就是「你」。
 */

export const HOME = '/home/kai';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function node(kind, extra = {}) {
  return { kind, mode: kind === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--', ...extra };
}

export function file(content = '', mode = 'rw-r--r--') {
  return node('file', { mode, content });
}

export function dir(children = {}, mode = 'rwxr-xr-x') {
  return node('dir', { mode, children });
}

export function link(target) {
  return node('link', { mode: 'rwxrwxrwx', target });
}

const BIT = { r: 4, w: 2, x: 1 };
export function modeNum(mode) {
  return mode.match(/.{3}/g).map(g => [...g].reduce((n, c) => n + (BIT[c] ?? 0), 0)).join('');
}

/** 只看属主那一位：这个沙盒里你就是文件主人。 */
export function can(node, bit) {
  return node.mode[bit === 'r' ? 0 : bit === 'w' ? 1 : 2] === bit;
}

export function linesOf(content) {
  if (!content) return [];
  const parts = content.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

export class Fail {
  constructor(message, code = 1) { this.message = message; this.code = code; }
}
export const fail = (message, code = 1) => { throw new Fail(message, code); };

/** 把一段路径收成相对于家目录的片段数组；越界（../ 超出家目录）返回 null。 */
export function segments(cwd, input) {
  const raw = input === undefined || input === '' || input === '~' ? '~' : input;
  const abs = raw === '~' || raw.startsWith('~/') ? raw.replace(/^~/, HOME) : raw.startsWith('/') ? raw : null;
  const base = abs ?? `${HOME}/${[...cwd, raw].filter(Boolean).join('/')}`;
  const home = HOME.split('/').filter(Boolean);
  const parts = base.split('/').filter(p => p && p !== '.');
  const stack = [];
  for (const part of parts) {
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  if (stack.length < home.length || home.some((p, i) => stack[i] !== p)) return null;
  return stack.slice(home.length);
}

export class World {
  constructor() {
    this.tree = dir();
    this.cwd = [];
    this.events = [];
  }

  /** 走到路径的父节点，返回 { parent, name, node }。name 为空表示家目录本身。 */
  resolve(input) {
    const segs = segments(this.cwd, input);
    if (!segs) fail(`bash: ${input}: Permission denied\n（沙盒把你关在家目录里，出不去）`);
    if (!segs.length) return { parent: null, name: '', node: this.tree };
    let parent = this.tree;
    for (const name of segs.slice(0, -1)) {
      const next = parent.children[name];
      if (!next) fail(`bash: ${input}: No such file or directory`);
      if (next.kind === 'link') fail(`bash: ${input}: 沙盒里的链接不能当目录走进去`);
      if (next.kind !== 'dir') fail(`bash: ${input}: Not a directory`);
      if (!can(next, 'x')) fail(`bash: ${input}: Permission denied`);
      parent = next;
    }
    const name = segs[segs.length - 1];
    return { parent, name, node: parent.children[name] ?? null };
  }

  /** 必须存在的路径。 */
  at(input) {
    const hit = this.resolve(input);
    if (!hit.node) fail(`bash: ${input}: No such file or directory`);
    return hit;
  }

  where() {
    return this.cwd.length ? `~/${this.cwd.join('/')}` : '~';
  }

  /** 当前目录的真实节点（沿着 cwd 走）。 */
  here() {
    let node = this.tree;
    for (const name of this.cwd) node = node.children[name];
    return node;
  }

  list(folder) {
    return Object.keys(folder.children).sort(cmp);
  }

  writeFile(path, content, { append = false } = {}) {
    const hit = this.resolve(path);
    if (!hit.name) fail(`bash: ${path}: Is a directory`);
    if (hit.node?.kind === 'dir') fail(`bash: ${path}: Is a directory`);
    const text = content;
    if (hit.node) {
      if (!can(hit.node, 'w')) fail(`bash: ${path}: Permission denied`);
      hit.node.content = append ? hit.node.content + text : text;
    } else {
      if (!can(hit.parent, 'w')) fail(`bash: ${path}: Permission denied`);
      hit.parent.children[hit.name] = file(text);
    }
    this.events.push({ write: hit.name });
  }

  /** 按 ~/a/b 建出整条目录（给课程 setup 用），返回最后一级。 */
  ensure(path) {
    const segs = segments([], path.startsWith('~') ? path : `~/${path}`) ?? [];
    let node = this.tree;
    for (const name of segs) {
      if (!node.children[name]) node.children[name] = dir();
      node = node.children[name];
    }
    return node;
  }

  put(path, content, mode) {
    const segs = segments([], path.startsWith('~') ? path : `~/${path}`);
    const parent = this.ensure('~/' + segs.slice(0, -1).join('/'));
    parent.children[segs.at(-1)] = file(content, mode);
  }
}
