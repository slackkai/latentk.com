/**
 * 浏览器里的 Git 沙盒：家目录 ~ 下一层文件夹，每个文件夹可以是一个仓库；另有几个“GitHub”远程仓库。
 * world.run('git status') 返回带颜色标记的输出行，UI 直接读取 world 的状态画出三个区域和提交图。
 * 命令输出逐条对照过 Git 2.55 的真实输出；提交 ID 按 Git 的对象格式计算。
 */
import { blobId, commitId, cleanMessage, subject, lines, countChanges, hunks, merge3, gitDate, localTz, distance } from './core.js';

export const HOME = '/home/you';
export const TEAMMATE = { name: 'teammate', email: 'teammate@example.com' };
export const short = id => id.slice(0, 7);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const keys = (...objects) => [...new Set(objects.flatMap(o => Object.keys(o)))].sort(cmp);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortRef = ref => ref.replace(/^refs\/(heads|remotes|tags)\//, '');
const urlKey = url => String(url).replace(/\/+$/, '').replace(/\.git$/, '');

/* ---------------- 输出与错误 ---------------- */

export class Fail extends Error {
  constructor(text, code = 128, note = '') { super(text); this.code = code; this.note = note; }
}
const fail = (text, code, note) => { throw new Fail(text, code, note); };

/** 一次命令的输出：lines 是行数组，每行是 [文字, 样式类] 片段。 */
export class Out {
  constructor() { this.lines = []; this.actions = []; this.status = 0; }
  put(...parts) { this.lines.push(parts.map(p => (Array.isArray(p) ? p : [String(p), '']))); }
  text(text, cls = '') { for (const line of String(text).split('\n')) this.lines.push([[line, cls]]); }
  git(text) {
    for (const line of String(text).split('\n')) {
      const cls = /^(fatal|error|CONFLICT)\b/.test(line) || /^ ! /.test(line) ? 'err' : /^hint:/.test(line) ? 'hint' : /^warning:/.test(line) ? 'warn' : '';
      this.lines.push([[line, cls]]);
    }
  }
  note(text) { this.text(text, 'note'); }
  plain() { return this.lines.map(line => line.map(p => p[0]).join('')).join('\n'); }
}

const NOT_REPO = 'fatal: not a git repository (or any of the parent directories): .git';
const UNKNOWN_REV = rev => `fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`;
const UNMERGED_FILES = `hint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.`;
const IDENTITY = `Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account's default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got 'you@sandbox.(none)')`;
const DIVERGENT = `hint: You have divergent branches and need to specify how to reconcile them.\nhint: You can do so by running one of the following commands sometime before\nhint: your next pull:\nhint:\nhint:   git config pull.rebase false  # merge\nhint:   git config pull.rebase true   # rebase\nhint:   git config pull.ff only       # fast-forward only\nhint:\nhint: You can replace "git config" with "git config --global" to set a default\nhint: preference for all repositories. You can also pass --rebase, --no-rebase,\nhint: or --ff-only on the command line to override the configured default per\nhint: invocation.\nfatal: Need to specify how to reconcile divergent branches.`;
const DETACHED_ADVICE = `You are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nTurn off this advice by setting config variable advice.detachedHead to false\n`;
const REBASE_HINT = `hint: Resolve all conflicts manually, mark them as resolved with\nhint: "git add/rm <conflicted_files>", then run "git rebase --continue".\nhint: You can instead skip this commit: run "git rebase --skip".\nhint: To abort and get back to the state before "git rebase", run "git rebase --abort".\nhint: Disable this message with "git config set advice.mergeConflict false"`;

/* ---------------- 选项解析 ---------------- */

/** spec 形如 ['m|message:list', 'a|all', 'n|max-count:value', 'v|verbose:count']。 */
function opts(args, spec) {
  const defs = new Map();
  const o = { _: [], paths: null };
  for (const entry of spec) {
    const [names, type = 'bool'] = entry.split(':');
    const list = names.split('|');
    for (const name of list) defs.set(name, { key: list[0], type });
    if (type === 'list') o[list[0]] = [];
  }
  const take = (def, name, value) => {
    if (value === undefined) fail(`error: ${name.length === 1 ? 'switch' : 'option'} \`${name}' requires a value`, 129);
    if (def.type === 'list') o[def.key].push(value); else o[def.key] = value;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { o.paths = args.slice(i + 1); break; }
    if (/^-\d+$/.test(a) && defs.has('n')) { o.n = a.slice(1); continue; }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const def = defs.get(name);
      if (!def) fail(`error: unknown option \`${name}'`, 129, '（沙盒没有模拟这个选项，也可能是拼写不对）');
      if (def.type === 'bool') o[def.key] = true;
      else if (def.type === 'count') o[def.key] = (o[def.key] ?? 0) + 1;
      else take(def, name, eq > 0 ? a.slice(eq + 1) : args[++i]);
    } else if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const def = defs.get(a[j]);
        if (!def) fail(`error: unknown switch \`${a[j]}'`, 129, '（沙盒没有模拟这个选项，也可能是拼写不对）');
        if (def.type === 'bool') o[def.key] = true;
        else if (def.type === 'count') o[def.key] = (o[def.key] ?? 0) + 1;
        else { take(def, a[j], a.slice(j + 1) || args[++i]); break; }
      }
    } else o._.push(a);
  }
  return o;
}

/* ---------------- 仓库模型 ---------------- */

function newRepo(branch = 'main', bare = false) {
  return {
    bare, objects: new Map(), refs: new Map(), symrefs: new Map(), head: { ref: `refs/heads/${branch}` },
    index: {}, unmerged: new Map(), config: {}, reflog: [], op: null, stash: [],
  };
}

export const headId = repo => (repo.head.ref ? repo.refs.get(repo.head.ref) ?? null : repo.head.id);
export const headBranch = repo => (repo.head.ref ? repo.head.ref.slice(11) : null);
export const treeOf = (repo, id) => (id ? repo.objects.get(id).tree : {});

export function ancestors(repo, ids) {
  const seen = new Set();
  const stack = ids.filter(Boolean);
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const commit = repo.objects.get(id);
    if (commit) stack.push(...commit.parents);
  }
  return seen;
}
export const isAncestor = (repo, a, b) => ancestors(repo, [b]).has(a);
const newer = (a, b) => b.committer.time - a.committer.time || b.seq - a.seq;

function mergeBase(repo, a, b) {
  const A = ancestors(repo, [a]);
  const common = [...ancestors(repo, [b])].filter(id => A.has(id));
  const best = common.filter(id => !common.some(other => other !== id && ancestors(repo, [other]).has(id)));
  best.sort((x, y) => newer(repo.objects.get(x), repo.objects.get(y)));
  return best[0] ?? null;
}

/** 按提交时间从新到旧遍历（git log 的默认顺序）。 */
function dateOrder(repo, starts, exclude = new Set()) {
  // 时间相同的提交按加入队列的先后排（与 Git 的稳定插入一致）
  const seen = new Set(), out = [];
  let tick = 0;
  const queue = [...new Set(starts.filter(Boolean))].map(id => ({ commit: repo.objects.get(id), tick: tick++ }));
  while (queue.length) {
    queue.sort((a, b) => b.commit.committer.time - a.commit.committer.time || a.tick - b.tick);
    const { commit } = queue.shift();
    if (seen.has(commit.id)) continue;
    seen.add(commit.id);
    if (exclude.has(commit.id)) continue;
    out.push(commit);
    for (const p of commit.parents) if (!seen.has(p)) queue.push({ commit: repo.objects.get(p), tick: tick++ });
  }
  return out;
}

/** --graph 使用的拓扑顺序：子提交总在父提交之前，同一条线尽量连续。 */
export function topoOrder(repo, starts, exclude) {
  const all = dateOrder(repo, starts, exclude);
  const set = new Set(all.map(c => c.id));
  const indegree = new Map(all.map(c => [c.id, 0]));
  for (const c of all) for (const p of c.parents) if (set.has(p)) indegree.set(p, indegree.get(p) + 1);
  const stack = all.filter(c => indegree.get(c.id) === 0).reverse();
  const out = [];
  while (stack.length) {
    const commit = stack.pop();
    out.push(commit);
    for (const p of commit.parents) {
      if (!set.has(p)) continue;
      indegree.set(p, indegree.get(p) - 1);
      if (indegree.get(p) === 0) stack.push(repo.objects.get(p));
    }
  }
  return out;
}

/** 与 `git log --graph` 相同的列分配。每行返回提交所在列、行首图形和其后的连线行。 */
export function graphRows(order) {
  const inSet = new Set(order.map(c => c.id));
  let cols = [];
  return order.map(commit => {
    let col = cols.indexOf(commit.id);
    if (col < 0) { cols.push(commit.id); col = cols.length - 1; }
    const parents = commit.parents.filter(p => inSet.has(p));
    const fresh = parents.slice(1).filter(p => !cols.includes(p));
    const row = cols.map((_, i) => (i === col ? '*' : '|')).join(' ') + '  '.repeat(fresh.length);
    const width = cols.length + fresh.length;
    if (parents.length) cols[col] = parents[0]; else cols.splice(col, 1);
    cols.splice(col + 1, 0, ...fresh);
    const post = [];
    if (fresh.length) {
      const left = cols.slice(0, col).map(() => '|');
      const right = cols.slice(col + 1 + fresh.length).map(() => '\\');
      post.push([...left, '|' + '\\'.repeat(fresh.length), ...right].join(' ').padEnd(cols.length * 2));
    }
    for (let j = 1; j < cols.length; j++) {
      if (cols.indexOf(cols[j]) < j) {
        const w = cols.length * 2;
        post.push((cols.slice(0, j).map(() => '|').join(' ') + '/' + cols.slice(j + 1).map(() => ' /').join('')).padEnd(w));
        cols.splice(j, 1);
        j--;
      }
    }
    return { commit, col, row, post, width, after: cols.length };
  });
}

/** 指向某个提交的引用，顺序与 Git 的装饰一致：HEAD 在前，其余按完整引用名倒序。 */
export function decorations(repo, id) {
  const refs = [...repo.refs].filter(([, v]) => v === id).map(([k]) => k);
  for (const [name, target] of repo.symrefs) if (repo.refs.get(target) === id) refs.push(name);
  refs.sort(cmp).reverse();
  const out = [];
  if (headId(repo) === id) {
    const ref = repo.head.ref;
    out.push({ kind: 'head', branch: ref && refs.includes(ref) ? ref.slice(11) : null });
    if (ref) refs.splice(refs.indexOf(ref), 1);
  }
  for (const ref of refs) out.push({ kind: ref.startsWith('refs/remotes/') ? 'remote' : 'branch', name: shortRef(ref) });
  return out;
}

function decorSegments(repo, id) {
  const list = decorations(repo, id);
  if (!list.length) return [];
  const segs = [[' (', 'hash']];
  list.forEach((d, i) => {
    if (i) segs.push([', ', 'hash']);
    if (d.kind === 'head') {
      segs.push(['HEAD', 'head']);
      if (d.branch) segs.push([' -> ', 'head'], [d.branch, 'branch']);
    } else segs.push([d.name, d.kind]);
  });
  segs.push([')', 'hash']);
  return segs;
}

/* ---------------- .gitignore ---------------- */

function ignoreRules(text) {
  return lines(text).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(rule => {
    const negate = rule.startsWith('!');
    let body = negate ? rule.slice(1) : rule;
    body = body.replace(/^\//, '').replace(/\/$/, '');
    const source = body.split('**').map(part => part.split('').map(c => (c === '*' ? '[^/]*' : c === '?' ? '[^/]' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('')).join('.*');
    return { negate, re: new RegExp(`^${source}$`) };
  });
}
function isIgnored(rules, path) {
  let result = false;
  for (const rule of rules) if (rule.re.test(path)) result = !rule.negate;
  return result;
}

/* ---------------- 状态 ---------------- */

/** 三个区域的比较结果：staged（HEAD↔暂存区）、unstaged（暂存区↔工作区）、未跟踪、冲突。 */
export function statusOf(dir) {
  const repo = dir.repo, head = treeOf(repo, headId(repo)), index = repo.index, wd = dir.files;
  const staged = [], unstaged = [], untracked = [], ignored = [], unmerged = [];
  for (const path of keys(head, index)) {
    if (repo.unmerged.has(path) || head[path] === index[path]) continue;
    staged.push({ path, kind: head[path] === undefined ? 'new file' : index[path] === undefined ? 'deleted' : 'modified' });
  }
  for (const path of Object.keys(index).sort(cmp)) {
    if (repo.unmerged.has(path)) continue;
    if (!(path in wd)) unstaged.push({ path, kind: 'deleted' });
    else if (wd[path] !== index[path]) unstaged.push({ path, kind: 'modified' });
  }
  const rules = ignoreRules(wd['.gitignore']);
  for (const path of Object.keys(wd).sort(cmp)) {
    if (path in index || repo.unmerged.has(path)) continue;
    (isIgnored(rules, path) ? ignored : untracked).push(path);
  }
  for (const [path, info] of [...repo.unmerged].sort(([a], [b]) => cmp(a, b))) unmerged.push({ path, kind: info.kind });
  return { head, staged, unstaged, untracked, ignored, unmerged };
}

const SHORT = { 'new file': 'A', modified: 'M', deleted: 'D' };
const UNMERGED_SHORT = { 'both modified': 'UU', 'both added': 'AA', 'deleted by us': 'DU', 'deleted by them': 'UD' };

/* ---------------- 命令行解析 ---------------- */

const QUOTES = { '"': '"', "'": "'", '“': '”', '”': '”', '‘': '’', '’': '’', '「': '」' };

function parseLine(line) {
  const tokens = [];
  let smart = false, i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '#') break;
    const two = line.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '>>') { tokens.push({ op: two }); i += 2; continue; }
    if ('>;|&'.includes(ch)) { tokens.push({ op: ch }); i++; continue; }
    let word = '', glob = false;
    while (i < line.length && !/\s/.test(line[i]) && !'>;|&'.includes(line[i])) {
      const c = line[i];
      if (QUOTES[c]) {
        if (!'"\''.includes(c)) smart = true;
        const close = QUOTES[c];
        let j = i + 1;
        while (j < line.length && line[j] !== close && !(close === '”' && line[j] === '"')) {
          if (c === '"' && line[j] === '\\' && '"\\$`'.includes(line[j + 1] ?? '')) { word += line[j + 1]; j += 2; continue; }
          word += line[j];
          j++;
        }
        if (j >= line.length) fail(`bash: unexpected EOF while looking for matching \`${c}'`, 2, '（引号没有配对：检查一下是不是少打了一个引号）');
        i = j + 1;
        continue;
      }
      if (c === '\\' && i + 1 < line.length) { word += line[i + 1]; i += 2; continue; }
      if (c === '*' || c === '?') glob = true;
      word += c;
      i++;
    }
    tokens.push({ word, glob });
  }
  const commands = [];
  let current = { words: [], redirect: null, after: null };
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (token.op === '>' || token.op === '>>') {
      const target = tokens[++t];
      if (!target || target.op) fail("bash: syntax error near unexpected token `newline'", 2);
      current.redirect = { append: token.op === '>>', file: target.word };
    } else if (token.op === '|') fail('（沙盒不支持管道 |，请把命令分开执行）', 1);
    else if (token.op) {
      if (current.words.length) commands.push(current);
      current = { words: [], redirect: null, after: token.op === '&' ? ';' : token.op };
    } else current.words.push(token);
  }
  if (current.words.length || current.redirect) commands.push(current);
  return { commands, smart };
}

/* ---------------- 世界 ---------------- */

export class World {
  constructor({ tz = localTz(), clock = null, user = { name: 'you', email: 'you@example.com' }, progress = true, tty = true } = {}) {
    this.tty = tty;
    this.tz = tz;
    this.clock = clock;
    this.progress = progress;
    this.last = 0;
    this.seq = 0;
    this.home = { name: '~', files: {}, dirs: new Map(), repo: null, home: true };
    this.cwd = null;
    this.remotes = new Map();
    this.global = { 'user.name': user.name, 'user.email': user.email, 'init.defaultbranch': 'main' };
    this.events = [];
  }

  /* ----- 状态读取 ----- */
  get dir() { return this.cwd ? this.home.dirs.get(this.cwd) : this.home; }
  get repo() { return this.dir.repo; }
  get path() { return this.cwd ? `${HOME}/${this.cwd}` : HOME; }
  config(repo, key) { return (repo && repo.config[key]) ?? this.global[key]; }
  now() {
    const t = this.clock ? this.clock() : Math.floor(Date.now() / 1000);
    this.last = Math.max(this.last, t);
    return this.last;
  }
  ident(repo) {
    const name = this.config(repo, 'user.name'), email = this.config(repo, 'user.email');
    if (!name || !email) fail(IDENTITY);
    return { name, email, time: this.now(), tz: this.tz };
  }
  prompt() {
    const repo = this.repo;
    const where = this.cwd ? `~/${this.cwd}` : '~';
    if (!repo) return { where, branch: null, state: null };
    const branch = headBranch(repo);
    const op = repo.op;
    const state = op?.type === 'merge' ? 'MERGING' : op?.type === 'revert' ? 'REVERTING' : op?.type === 'rebase' ? `REBASE ${op.done.length}/${op.done.length + op.todo.length}` : null;
    const label = op?.type === 'rebase' ? shortRef(op.branch) : branch ?? `(${short(headId(repo))}...)`;
    return { where, branch: label, state };
  }

  /* ----- 执行 ----- */
  run(line, { silent = false } = {}) {
    const out = new Out();
    let status = 0;
    try {
      const { commands, smart } = parseLine(line.trim());
      if (smart) out.note('（提示：真终端只认英文引号 " "，中文引号 “ ” 会被当成普通文字。沙盒这次替你当成引号处理了）');
      for (const command of commands) {
        if (command.after === '&&' && status !== 0) continue;
        if (command.after === '||' && status === 0) continue;
        status = this.exec(command, out);
      }
    } catch (error) {
      if (!(error instanceof Fail)) throw error;
      out.git(error.message);
      if (error.note) out.note(error.note);
      status = error.code;
    }
    out.status = status;
    if (!silent) this.events.push({ line, status });
    return out;
  }

  exec({ words, redirect }, out) {
    const argv = this.expand(words);
    const target = redirect ? new Out() : out;
    let status;
    try {
      status = this.command(argv, target);
    } catch (error) {
      if (!(error instanceof Fail)) throw error;
      target.git(error.message);
      if (error.note) target.note(error.note);
      status = error.code;
    }
    if (redirect) {
      if (!redirect.file || redirect.file.includes('/')) { out.note('（沙盒只支持当前文件夹里的文件名）'); return 1; }
      const text = target.lines.length ? target.plain() + '\n' : '';
      const files = this.dir.files;
      files[redirect.file] = redirect.append ? (files[redirect.file] ?? '') + text : text;
      out.actions.push(...target.actions);
      this.events.push({ write: redirect.file });
    }
    return status;
  }

  expand(words) {
    const names = [...Object.keys(this.dir.files), ...(this.cwd ? [] : this.home.dirs.keys())].sort(cmp);
    return words.flatMap(({ word, glob }) => {
      if (!glob) return [word];
      const re = new RegExp('^' + word.split('').map(c => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
      const hits = names.filter(n => re.test(n) && !n.startsWith('.'));
      return hits.length ? hits : [word];
    });
  }

  command(argv, out) {
    const [cmd, ...args] = argv;
    if (!cmd) return 0;
    const shell = SHELL[cmd];
    if (shell) {
      const status = shell.call(this, args, out) ?? 0;
      this.events.push({ sh: cmd, args, status });
      return status;
    }
    if (cmd !== 'git') {
      out.git(`bash: ${cmd}: command not found`);
      if (/^git\w+/.test(cmd)) out.note(`（git 和子命令之间要有空格：git ${cmd.slice(3)}）`);
      return 127;
    }
    const [sub, ...rest] = args;
    if (!sub || sub === 'help' || sub === '--help' || sub === '-h') { out.text(HELP); return 0; }
    if (sub === '--version' || sub === 'version') { out.put('git version 2.55.0'); return 0; }
    const handler = GIT[sub];
    if (!handler) {
      if (REAL_GIT.includes(sub)) { out.note(`（git ${sub} 是真实存在的命令，但这个沙盒没有模拟它）`); return 1; }
      // 与 help.c 相同：常用命令的前缀直接得 0 分，其余按加权编辑距离，只列最高分的一组
      const scored = [...Object.keys(GIT), ...REAL_GIT].map(name => [name, COMMON.includes(name) && name.startsWith(sub) ? 0 : distance(sub, name) + 1]).sort((a, b) => a[1] - b[1] || cmp(a[0], b[0]));
      const near = scored.filter(([, score]) => score === scored[0][1] && score < 7);
      out.put(`git: '${sub}' is not a git command. See 'git --help'.`);
      if (near.length) { out.put(''); out.put(near.length === 1 ? 'The most similar command is' : 'The most similar commands are'); for (const [name] of near) out.put(`\t${name}`); }
      return 1;
    }
    if (!NO_REPO.has(sub) && !this.repo) fail(NOT_REPO);
    let status;
    try {
      status = handler.call(this, rest, out) ?? 0;
    } catch (error) {
      if (error instanceof Fail) this.events.push({ git: sub, args: rest, status: error.code });
      throw error;
    }
    this.events.push({ git: sub, args: rest, status });
    return status;
  }

  /* ----- 文件与提交的底层操作 ----- */
  writeFile(name, content) {
    this.dir.files[name] = content === '' || content.endsWith('\n') ? content : content + '\n';
    this.events.push({ write: name });
  }

  makeCommit(repo, { tree, parents, author, committer, message }) {
    const id = commitId({ tree, parents, author, committer, message });
    if (!repo.objects.has(id)) repo.objects.set(id, { id, tree: { ...tree }, parents, author, committer, message, seq: this.seq++ });
    return repo.objects.get(id);
  }

  /** 把分支（或分离的 HEAD）移到 id，并记一条 HEAD 的 reflog。 */
  moveHead(repo, id, message) {
    if (repo.head.ref) repo.refs.set(repo.head.ref, id); else repo.head.id = id;
    repo.reflog.push({ id, msg: message });
  }

  resolve(repo, spec) {
    const m = String(spec).match(/^(.*?)((?:[~^]\d*)*)$/);
    let base = m[1], id = null;
    if (base === '' || base === '@') base = 'HEAD';
    const reflog = base.match(/^(HEAD)?@\{(\d+)\}$/);
    if (base === 'HEAD') id = headId(repo);
    else if (reflog) id = repo.reflog[repo.reflog.length - 1 - Number(reflog[2])]?.id ?? null;
    else if (base === 'ORIG_HEAD') id = repo.origHead ?? null;
    else if (base === 'FETCH_HEAD') id = repo.fetchHead ?? null;
    else {
      for (const ref of [`refs/heads/${base}`, `refs/remotes/${base}`, base]) if (repo.refs.has(ref)) { id = repo.refs.get(ref); break; }
      if (!id && repo.symrefs.has(`refs/remotes/${base}/HEAD`)) id = repo.refs.get(repo.symrefs.get(`refs/remotes/${base}/HEAD`)) ?? null;
      if (!id && /^[0-9a-f]{4,40}$/.test(base)) {
        const hits = [...repo.objects.keys()].filter(k => k.startsWith(base));
        if (hits.length === 1) id = hits[0];
      }
    }
    if (!id) return null;
    for (const [, op, num] of m[2].matchAll(/([~^])(\d*)/g)) {
      const n = num === '' ? 1 : Number(num);
      if (op === '~') for (let k = 0; k < n && id; k++) id = repo.objects.get(id).parents[0] ?? null;
      else id = n === 0 ? id : repo.objects.get(id).parents[n - 1] ?? null;
      if (!id) return null;
    }
    return id;
  }
  must(repo, spec, message) {
    const id = this.resolve(repo, spec);
    if (!id) fail(message ?? UNKNOWN_REV(spec));
    return id;
  }

  /** 本地修改（暂存或未暂存）涉及的已跟踪路径。 */
  dirtyPaths(dir) {
    const s = statusOf(dir);
    return new Set([...s.staged, ...s.unstaged].map(x => x.path));
  }

  /** 切换到另一个提交的快照；有会被覆盖的本地修改时拒绝，其余修改原样带过去。 */
  checkoutTree(dir, targetId, word = 'checkout') {
    const repo = dir.repo, cur = treeOf(repo, headId(repo)), next = treeOf(repo, targetId), index = repo.index, wd = dir.files;
    if (repo.unmerged.size) fail(`error: you need to resolve your current index first\n${[...repo.unmerged.keys()].map(p => `${p}: needs merge`).join('\n')}`, 1);
    const blocked = [], untracked = [];
    for (const path of keys(cur, next)) {
      if (cur[path] === next[path]) continue;
      const local = index[path] !== cur[path] || (path in index && wd[path] !== index[path]);
      if (local) { if (index[path] !== next[path] || wd[path] !== next[path]) blocked.push(path); }
      else if (!(path in index) && path in wd && wd[path] !== next[path]) untracked.push(path);
    }
    const verb = word === 'checkout' ? 'switch branches' : word;
    if (blocked.length) fail(`error: Your local changes to the following files would be overwritten by ${word}:\n${blocked.map(p => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you ${verb}.\nAborting`, 1);
    if (untracked.length) fail(`error: The following untracked working tree files would be overwritten by ${word}:\n${untracked.map(p => `\t${p}`).join('\n')}\nPlease move or remove them before you ${verb}.\nAborting`, 1);
    for (const path of keys(cur, next)) {
      if (cur[path] === next[path]) continue;
      const local = index[path] !== cur[path] || (path in index && wd[path] !== index[path]);
      if (local) continue;
      if (next[path] === undefined) { delete index[path]; delete wd[path]; }
      else { index[path] = next[path]; wd[path] = next[path]; }
    }
    const carried = [];
    for (const path of keys(next, index)) {
      if (index[path] !== next[path]) carried.push(`${next[path] === undefined ? 'A' : index[path] === undefined ? 'D' : 'M'}\t${path}`);
      else if (path in index && wd[path] !== index[path]) carried.push(`${path in wd ? 'M' : 'D'}\t${path}`);
    }
    return carried;
  }

  /** 把分支/HEAD 硬重置到 id：暂存区与已跟踪文件都换成那个快照，未跟踪文件不动。 */
  hardReset(dir, id, paths = null) {
    const repo = dir.repo, next = treeOf(repo, id), wd = dir.files;
    for (const path of paths ?? keys(repo.index, next, Object.fromEntries([...repo.unmerged.keys()].map(k => [k, 1])))) {
      if (next[path] === undefined) { if (path in repo.index || repo.unmerged.has(path)) delete wd[path]; delete repo.index[path]; }
      else { repo.index[path] = next[path]; wd[path] = next[path]; }
    }
    repo.unmerged.clear();
  }

  /** 三方合并两个快照。返回结果快照、冲突与“Auto-merging”提示。 */
  mergeTrees(base, ours, theirs, labels) {
    const tree = {}, conflicts = [], messages = [];
    for (const path of keys(base, ours, theirs)) {
      const b = base[path], o = ours[path], t = theirs[path];
      if (o === t) { if (o !== undefined) tree[path] = o; continue; }
      if (b === o) { if (t !== undefined) tree[path] = t; continue; }
      if (b === t) { if (o !== undefined) tree[path] = o; continue; }
      if (o === undefined || t === undefined) {
        const kept = o ?? t;
        tree[path] = kept;
        const deletedIn = o === undefined ? labels.ours : labels.theirs, modifiedIn = o === undefined ? labels.theirs : labels.ours;
        messages.push(`CONFLICT (modify/delete): ${path} deleted in ${deletedIn} and modified in ${modifiedIn}.  Version ${modifiedIn} of ${path} left in tree.`);
        conflicts.push({ path, kind: o === undefined ? 'deleted by us' : 'deleted by them', content: kept, ours: o });
        continue;
      }
      messages.push(`Auto-merging ${path}`);
      const merged = merge3(b ?? '', o, t, labels);
      tree[path] = merged.content;
      if (merged.conflicts) {
        messages.push(`CONFLICT (${b === undefined ? 'add/add' : 'content'}): Merge conflict in ${path}`);
        conflicts.push({ path, kind: b === undefined ? 'both added' : 'both modified', content: merged.content, ours: o });
      }
    }
    return { tree, conflicts, messages };
  }

  /** 把合并结果写进暂存区和工作区；冲突文件带标记进工作区并记为未合并。 */
  applyMerge(dir, result, touched) {
    const repo = dir.repo;
    for (const path of touched) {
      const conflict = result.conflicts.find(c => c.path === path);
      if (conflict) {
        repo.unmerged.set(path, { kind: conflict.kind });
        if (conflict.ours === undefined) delete repo.index[path]; else repo.index[path] = conflict.ours;
        dir.files[path] = conflict.content;
      } else if (result.tree[path] === undefined) { delete repo.index[path]; delete dir.files[path]; }
      else { repo.index[path] = result.tree[path]; dir.files[path] = result.tree[path]; }
    }
  }

  /** 合并前检查：会被合并改写的路径上不能有本地修改。 */
  guardMerge(dir, touched, word = 'merge') {
    const repo = dir.repo, dirty = this.dirtyPaths(dir);
    const blocked = touched.filter(p => dirty.has(p));
    if (blocked.length) fail(`error: Your local changes to the following files would be overwritten by ${word}:\n${blocked.map(p => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you ${word}.\nAborting`, 1);
    const untracked = touched.filter(p => !(p in repo.index) && p in dir.files);
    if (untracked.length) fail(`error: The following untracked working tree files would be overwritten by ${word}:\n${untracked.map(p => `\t${p}`).join('\n')}\nPlease move or remove them before you ${word}.\nAborting`, 1);
  }

  /* ----- 远程 ----- */
  remoteRepo(url) { return this.remotes.get(urlKey(url)); }
  /** 只有网络远程（https）才有进度行；本地路径的远程没有。 */
  showProgress(url) { return this.progress && /^https?:\/\//.test(url); }
  createRemote(url, { branch = 'main', commits = [] } = {}) {
    const repo = newRepo(branch, true);
    repo.url = url;
    this.remotes.set(urlKey(url), repo);
    for (const c of commits) this.remoteCommit(url, { branch, ...c });
    return repo;
  }
  /** 模拟别人在 GitHub 上推送了一个提交。files 的值可以是新内容、null（删除）或 旧内容 => 新内容。 */
  remoteCommit(url, { branch = 'main', files = {}, message = 'update', author = TEAMMATE }) {
    const remote = this.remoteRepo(url), ref = `refs/heads/${branch}`, parent = remote.refs.get(ref) ?? null;
    const tree = { ...treeOf(remote, parent) };
    for (const [name, value] of Object.entries(files)) {
      if (value === null) delete tree[name];
      else tree[name] = typeof value === 'function' ? value(tree[name] ?? '') : value;
    }
    const who = { ...author, time: this.now(), tz: this.tz };
    const commit = this.makeCommit(remote, { tree, parents: parent ? [parent] : [], author: who, committer: who, message: cleanMessage(message) });
    remote.refs.set(ref, commit.id);
    return commit;
  }
  /** 模拟在 GitHub 上点了 “Merge pull request”。 */
  remoteMerge(url, { from, into = 'main', number = 1, title = '', author = TEAMMATE }) {
    const remote = this.remoteRepo(url);
    const ours = remote.refs.get(`refs/heads/${into}`), theirs = remote.refs.get(`refs/heads/${from}`);
    if (!theirs || !ours || isAncestor(remote, theirs, ours)) return null;
    const base = mergeBase(remote, ours, theirs);
    const result = this.mergeTrees(treeOf(remote, base), treeOf(remote, ours), treeOf(remote, theirs), { ours: into, theirs: from });
    if (result.conflicts.length) return null;
    const who = { ...author, time: this.now(), tz: this.tz };
    const owner = urlKey(remote.url).split('/').slice(-2)[0];
    const commit = this.makeCommit(remote, { tree: result.tree, parents: [ours, theirs], author: who, committer: who, message: cleanMessage(`Merge pull request #${number} from ${owner}/${from}\n\n${title || subject(remote.objects.get(theirs).message)}`) });
    remote.refs.set(`refs/heads/${into}`, commit.id);
    return commit;
  }

  /** 从 src 复制 tips 可达、dst 还没有的提交；返回数量，用来生成“Counting objects”。 */
  transfer(src, dst, tips) {
    const commits = [...ancestors(src, tips)].filter(id => !dst.objects.has(id)).map(id => src.objects.get(id));
    const known = new Set();
    for (const c of dst.objects.values()) for (const content of Object.values(c.tree)) known.add(blobId(content));
    const blobs = new Set();
    for (const c of commits) for (const content of Object.values(c.tree)) { const b = blobId(content); if (!known.has(b)) blobs.add(b); }
    for (const c of commits) dst.objects.set(c.id, c);
    return { commits: commits.length, objects: commits.length * 2 + blobs.size };
  }

  fetchInto(repo, remoteName, out) {
    const url = repo.config[`remote.${remoteName}.url`];
    if (!url) fail(`fatal: '${remoteName}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.`);
    const remote = this.remoteRepo(url);
    if (!remote) fail(`remote: Repository not found.\nfatal: repository '${url}/' not found`);
    const updates = [];
    for (const [ref, id] of [...remote.refs].sort(([a], [b]) => cmp(a, b))) {
      if (!ref.startsWith('refs/heads/')) continue;
      const name = ref.slice(11), local = `refs/remotes/${remoteName}/${name}`, old = repo.refs.get(local);
      if (old !== id) updates.push({ name, local, old, id });
    }
    if (!updates.length) return updates;
    const moved = this.transfer(remote, repo, updates.map(u => u.id));
    if (moved.objects && this.showProgress(url)) {
      const n = moved.objects, total = n + 2;
      out.put(`remote: Enumerating objects: ${total}, done.`);
      out.put(`remote: Counting objects: 100% (${total}/${total}), done.`);
      out.put(`remote: Compressing objects: 100% (${moved.commits}/${moved.commits}), done.`);
      out.put(`remote: Total ${n} (delta 0), reused ${n} (delta 0), pack-reused 0 (from 0)`);
      out.put(`Unpacking objects: 100% (${n}/${n}), ${n * 88} bytes | ${(n * 8.8).toFixed(2)} KiB/s, done.`);
    }
    for (const u of updates) repo.refs.set(u.local, u.id);
    const headRef = `refs/remotes/${remoteName}/HEAD`;
    if (!repo.symrefs.has(headRef) && remote.head.ref) repo.symrefs.set(headRef, `refs/remotes/${remoteName}/${remote.head.ref.slice(11)}`);
    repo.fetchHead = updates[0].id;
    out.put(`From ${urlKey(url)}`);
    const width = Math.max(10, ...updates.map(u => u.name.length));
    for (const u of updates) {
      const tail = `${u.name.padEnd(width)} -> ${remoteName}/${u.name}`;
      if (!u.old) out.put(` * ${'[new branch]'.padEnd(17)} ${tail}`);
      else if (isAncestor(repo, u.old, u.id)) out.put(`   ${`${short(u.old)}..${short(u.id)}`.padEnd(17)} ${tail}`);
      else out.put(` + ${`${short(u.old)}...${short(u.id)}`.padEnd(17)} ${tail}  (forced update)`);
    }
    return updates;
  }

  upstream(repo, branch) {
    const remote = repo.config[`branch.${branch}.remote`], merge = repo.config[`branch.${branch}.merge`];
    if (!remote || !merge) return null;
    return { remote, branch: merge.replace(/^refs\/heads\//, ''), name: `${remote}/${merge.replace(/^refs\/heads\//, '')}`, ref: `refs/remotes/${remote}/${merge.replace(/^refs\/heads\//, '')}` };
  }
  tracking(repo, branch) {
    const up = this.upstream(repo, branch);
    if (!up) return null;
    const theirs = repo.refs.get(up.ref), ours = repo.refs.get(`refs/heads/${branch}`);
    if (!theirs) return { ...up, gone: true };
    const A = ancestors(repo, [ours]), B = ancestors(repo, [theirs]);
    return { ...up, ahead: [...A].filter(x => !B.has(x)).length, behind: [...B].filter(x => !A.has(x)).length };
  }
  setUpstream(repo, branch, remote, remoteBranch) {
    repo.config[`branch.${branch}.remote`] = remote;
    repo.config[`branch.${branch}.merge`] = `refs/heads/${remoteBranch}`;
  }

  /* ----- 输出片段 ----- */
  statSummary(files, add, del) {
    let text = ` ${plural(files, 'file')} changed`;
    if (add || !del) text += `, ${plural(add, 'insertion')}(+)`;
    if (del || !add) text += `, ${plural(del, 'deletion')}(-)`;
    return text;
  }
  /** diffstat；full 为 false 时只有汇总行（git commit 的格式）。 */
  printStat(out, before, after, { full = true, modes = true } = {}) {
    const rows = [];
    for (const path of keys(before, after)) {
      if (before[path] === after[path]) continue;
      rows.push({ path, ...countChanges(before[path] ?? '', after[path] ?? ''), created: before[path] === undefined, deleted: after[path] === undefined });
    }
    if (!rows.length) return;
    const add = rows.reduce((s, r) => s + r.add, 0), del = rows.reduce((s, r) => s + r.del, 0);
    if (full) {
      const nameW = Math.max(...rows.map(r => r.path.length)), numW = Math.max(...rows.map(r => String(r.add + r.del).length));
      const most = Math.max(...rows.map(r => r.add + r.del)), scale = most > 40 ? 40 / most : 1;
      for (const r of rows) {
        const plus = '+'.repeat(Math.round(r.add * scale)), minus = '-'.repeat(Math.round(r.del * scale));
        out.put(` ${r.path.padEnd(nameW)} | ${String(r.add + r.del).padStart(numW)} `, [plus, 'add'], [minus, 'del']);
      }
    }
    out.put(this.statSummary(rows.length, add, del));
    if (modes) for (const r of rows) { if (r.created) out.put(` create mode 100644 ${r.path}`); else if (r.deleted) out.put(` delete mode 100644 ${r.path}`); }
  }
  printDiff(out, path, before, after) {
    if (before === after) return;
    out.put([`diff --git a/${path} b/${path}`, 'meta']);
    if (before === undefined) { out.put(['new file mode 100644', 'meta']); out.put([`index 0000000..${short(blobId(after))}`, 'meta']); }
    else if (after === undefined) { out.put(['deleted file mode 100644', 'meta']); out.put([`index ${short(blobId(before))}..0000000`, 'meta']); }
    else out.put([`index ${short(blobId(before))}..${short(blobId(after))} 100644`, 'meta']);
    if (!hunks(before ?? '', after ?? '').length) return;
    out.put([before === undefined ? '--- /dev/null' : `--- a/${path}`, 'meta']);
    out.put([after === undefined ? '+++ /dev/null' : `+++ b/${path}`, 'meta']);
    for (const h of hunks(before ?? '', after ?? '')) {
      const [range, rest] = [h.header.match(/^@@[^@]*@@/)[0], h.header.replace(/^@@[^@]*@@/, '')];
      out.put([range, 'hunk'], rest);
      for (const [op, text] of h.body) out.put([op + text, op === '+' ? 'add' : op === '-' ? 'del' : '']);
    }
  }
  printCommitSummary(out, repo, commit, { showDate = false } = {}) {
    const branch = headBranch(repo) ?? 'detached HEAD';
    out.put(`[${branch}${commit.parents.length ? '' : ' (root-commit)'} ${short(commit.id)}] ${subject(commit.message)}`);
    if (commit.author.name !== commit.committer.name || commit.author.email !== commit.committer.email) out.put(` Author: ${commit.author.name} <${commit.author.email}>`);
    if (showDate) out.put(` Date: ${gitDate(commit.author.time, commit.author.tz)}`);
    if (commit.parents.length < 2) this.printStat(out, treeOf(repo, commit.parents[0]), commit.tree, { full: false });
  }
  printLogEntry(out, repo, commit, { oneline, stat, prefix = '', more = '', patch = false, decorate = true }) {
    const decor = decorate ? decorSegments(repo, commit.id) : [];
    if (oneline) {
      out.put(prefix, [short(commit.id), 'hash'], ...decor, ` ${subject(commit.message)}`);
      if (stat) this.printStat(out, treeOf(repo, commit.parents[0]), commit.tree, { modes: false });
      return;
    }
    out.put(prefix, [`commit ${commit.id}`, 'hash'], ...decor);
    if (commit.parents.length > 1) out.put(more + `Merge: ${commit.parents.map(short).join(' ')}`);
    out.put(more + `Author: ${commit.author.name} <${commit.author.email}>`);
    out.put(more + `Date:   ${gitDate(commit.author.time, commit.author.tz)}`);
    out.put(more.trimEnd());
    for (const line of commit.message.replace(/\n$/, '').split('\n')) out.put(more + '    ' + line);
    if (stat && commit.parents.length < 2) { out.put(more.trimEnd()); this.printStat(out, treeOf(repo, commit.parents[0]), commit.tree, { modes: false }); }
    if (patch && commit.parents.length < 2) {
      out.put(more.trimEnd());
      const before = treeOf(repo, commit.parents[0]);
      for (const path of keys(before, commit.tree)) this.printDiff(out, path, before[path], commit.tree[path]);
    }
  }

  /** git status 的长格式。commitMode 用于 git commit 无内容可提交时。 */
  printStatus(out, dir, { commitMode = false } = {}) {
    const repo = dir.repo, s = statusOf(dir), branch = headBranch(repo), id = headId(repo), op = repo.op;
    if (op?.type === 'rebase') this.printRebaseState(out, repo, s);
    else if (branch) out.put(`On branch ${branch}`);
    else { const d = detachedInfo(repo); out.put(`HEAD detached ${d.at ? 'at' : 'from'} ${d.from}`); }
    if (!id) { out.put(''); out.put(commitMode ? 'Initial commit' : 'No commits yet'); out.put(''); }
    const track = branch && op?.type !== 'rebase' ? this.tracking(repo, branch) : null;
    if (track) {
      if (track.gone) out.text(`Your branch is based on '${track.name}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)`);
      else if (!track.ahead && !track.behind) out.put(`Your branch is up to date with '${track.name}'.`);
      else if (!track.behind) out.text(`Your branch is ahead of '${track.name}' by ${plural(track.ahead, 'commit')}.\n  (use "git push" to publish your local commits)`);
      else if (!track.ahead) out.text(`Your branch is behind '${track.name}' by ${plural(track.behind, 'commit')}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)`);
      else out.text(`Your branch and '${track.name}' have diverged,\nand have ${track.ahead} and ${track.behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)`);
      out.put('');
    }
    if (op?.type === 'merge') {
      if (s.unmerged.length) out.text('You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)');
      else out.text('All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)');
      out.put('');
    }
    if (op?.type === 'revert') {
      out.put(`You are currently reverting commit ${short(op.commit)}.`);
      out.text(s.unmerged.length ? '  (fix conflicts and run "git revert --continue")\n  (use "git revert --skip" to skip this patch)\n  (use "git revert --abort" to cancel the revert operation)' : '  (all conflicts fixed: run "git revert --continue")\n  (use "git revert --skip" to skip this patch)\n  (use "git revert --abort" to cancel the revert operation)');
      out.put('');
    }
    const merging = op?.type === 'merge';
    const file = (label, path, width, cls) => out.put([`\t${(label + ':').padEnd(width)}${path}`, cls]);
    if (s.staged.length) {
      out.put('Changes to be committed:');
      if (!merging) out.put(id ? '  (use "git restore --staged <file>..." to unstage)' : '  (use "git rm --cached <file>..." to unstage)');
      for (const f of s.staged) file(f.kind, f.path, 12, 'add');
      out.put('');
    }
    if (s.unmerged.length) {
      out.put('Unmerged paths:');
      if (!merging) out.put('  (use "git restore --staged <file>..." to unstage)');
      const modDel = s.unmerged.some(u => u.kind.startsWith('deleted'));
      out.put(modDel ? '  (use "git add/rm <file>..." as appropriate to mark resolution)' : '  (use "git add <file>..." to mark resolution)');
      for (const f of s.unmerged) file(f.kind, f.path, 17, 'del');
      out.put('');
    }
    if (s.unstaged.length) {
      out.put('Changes not staged for commit:');
      out.put(s.unstaged.some(f => f.kind === 'deleted') ? '  (use "git add/rm <file>..." to update what will be committed)' : '  (use "git add <file>..." to update what will be committed)');
      out.put('  (use "git restore <file>..." to discard changes in working directory)');
      for (const f of s.unstaged) file(f.kind, f.path, 12, 'del');
      out.put('');
    }
    if (s.untracked.length) {
      out.put('Untracked files:');
      out.put('  (use "git add <file>..." to include in what will be committed)');
      for (const path of s.untracked) out.put([`\t${path}`, 'del']);
      out.put('');
    }
    if (!s.staged.length && !(merging && !s.unmerged.length)) {
      if (s.unstaged.length || s.unmerged.length) out.put('no changes added to commit (use "git add" and/or "git commit -a")');
      else if (s.untracked.length) out.put('nothing added to commit but untracked files present (use "git add" to track)');
      else if (!id) out.put('nothing to commit (create/copy files and use "git add" to track)');
      else out.put('nothing to commit, working tree clean');
    }
    return s;
  }
  printRebaseState(out, repo, s) {
    const op = repo.op;
    const pick = id => `   pick ${short(id)} # ${subject(repo.objects.get(id).message)}`;
    out.put(`interactive rebase in progress; onto ${short(op.onto)}`);
    const done = op.done;
    out.put(done.length === 1 ? 'Last command done (1 command done):' : `Last commands done (${done.length} commands done):`);
    for (const id of done.slice(-2)) out.put(pick(id));
    if (done.length > 2) out.put('  (see more in file .git/rebase-merge/done)');
    if (!op.todo.length) out.put('No commands remaining.');
    else {
      out.put(op.todo.length === 1 ? 'Next command to do (1 remaining command):' : `Next commands to do (${op.todo.length} remaining commands):`);
      for (const id of op.todo.slice(0, 2)) out.put(pick(id));
      out.put('  (use "git rebase --edit-todo" to view and edit)');
    }
    out.put(`You are currently rebasing branch '${shortRef(op.branch)}' on '${short(op.onto)}'.`);
    out.text(s.unmerged.length ? '  (fix conflicts and then run "git rebase --continue")\n  (use "git rebase --skip" to skip this patch)\n  (use "git rebase --abort" to check out the original branch)' : '  (all conflicts fixed: run "git rebase --continue")');
    out.put('');
  }

  /* ----- 变基与挑选：把一个提交的改动重放到当前 HEAD 上 ----- */
  replay(dir, id, labels) {
    const repo = dir.repo, commit = repo.objects.get(id);
    const base = treeOf(repo, commit.parents[0]), ours = treeOf(repo, headId(repo));
    const result = this.mergeTrees(base, ours, commit.tree, labels);
    const touched = keys(ours, result.tree).filter(p => ours[p] !== result.tree[p] || result.conflicts.some(c => c.path === p));
    return { commit, result, touched };
  }
  continueRebase(dir, out) {
    const repo = dir.repo, op = repo.op;
    while (op.todo.length) {
      const id = op.todo.shift();
      op.done.push(id);
      const { commit, result, touched } = this.replay(dir, id, { ours: 'HEAD', theirs: `${short(id)} (${subject(repo.objects.get(id).message)})` });
      this.applyMerge(dir, result, touched);
      if (result.conflicts.length) {
        op.current = id;
        out.git(result.messages.join('\n'));
        out.git(`error: could not apply ${short(id)}... ${subject(commit.message)}\n${REBASE_HINT}\nCould not apply ${short(id)}... # ${subject(commit.message)}`);
        return 1;
      }
      this.commitPick(repo, commit, 'rebase (pick)');
    }
    return this.finishRebase(repo, out);
  }
  commitPick(repo, original, reflogVerb) {
    const tree = { ...repo.index }, parent = headId(repo);
    if (Object.keys(tree).length === Object.keys(treeOf(repo, parent)).length && keys(tree, treeOf(repo, parent)).every(p => tree[p] === treeOf(repo, parent)[p])) return null;
    const committer = this.ident(repo);
    const commit = this.makeCommit(repo, { tree, parents: [parent], author: original.author, committer, message: original.message });
    this.moveHead(repo, commit.id, `${reflogVerb}: ${subject(commit.message)}`);
    return commit;
  }
  finishRebase(repo, out) {
    const op = repo.op, tip = headId(repo);
    repo.refs.set(op.branch, tip);
    repo.head = { ref: op.branch };
    repo.reflog.push({ id: tip, msg: `rebase (finish): returning to ${op.branch}` });
    repo.op = null;
    out.put(`Successfully rebased and updated ${op.branch}.`);
    return 0;
  }
  startRebase(dir, upstreamId, upstreamName, out) {
    const repo = dir.repo, branch = repo.head.ref, head = headId(repo);
    if (!branch) fail('fatal: No rebase in progress?\n（沙盒：请先切到一个分支再变基）');
    if (this.dirtyPaths(dir).size) fail('error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.', 1);
    if (isAncestor(repo, upstreamId, head)) { out.put(`Current branch ${shortRef(branch)} is up to date.`); return 0; }
    repo.origHead = head;
    if (isAncestor(repo, head, upstreamId)) {
      this.checkoutTree(dir, upstreamId, 'checkout');
      repo.refs.set(branch, upstreamId);
      repo.reflog.push({ id: upstreamId, msg: `rebase (finish): returning to ${branch}` });
      out.put(`Successfully rebased and updated ${branch}.`);
      return 0;
    }
    const exclude = ancestors(repo, [upstreamId]);
    const todo = topoOrder(repo, [head], exclude).filter(c => c.parents.length < 2).reverse().map(c => c.id);
    this.checkoutTree(dir, upstreamId, 'checkout');
    repo.head = { id: upstreamId };
    repo.reflog.push({ id: upstreamId, msg: `rebase (start): checkout ${upstreamName}` });
    repo.op = { type: 'rebase', branch, orig: head, onto: upstreamId, todo, done: [], current: null };
    return this.continueRebase(dir, out);
  }
}

/* ---------------- shell 命令 ---------------- */

const EDITORS = ['edit', 'vim', 'vi', 'nano', 'code', 'notepad'];
const SHELL = {
  echo(args, out) {
    let newline = true;
    if (args[0] === '-n') { newline = false; args = args.slice(1); }
    if (args[0] === '-e') args = args.slice(1).map(a => a.replace(/\\n/g, '\n'));
    const text = args.join(' ');
    if (newline) out.text(text); else out.lines.push([[text, '']]);
    return 0;
  },
  cat(args, out) {
    if (!args.length) { out.note('（cat 后面跟文件名，例如 cat hello.txt）'); return 1; }
    let status = 0;
    for (const name of args) {
      const content = this.dir.files[name];
      if (content === undefined) {
        out.put(this.cwd === null && this.home.dirs.has(name) ? `cat: ${name}: Is a directory` : `cat: ${name}: No such file or directory`);
        status = 1;
      } else for (const line of lines(content)) out.put(line);
    }
    return status;
  },
  ls(args, out) {
    const all = args.some(a => /^-\w*a/.test(a));
    const dir = this.dir;
    const entries = [];
    if (all) entries.push(['.', 'dir'], ['..', 'dir']);
    if (all && dir.repo) entries.push(['.git', 'dir']);
    if (!this.cwd) for (const name of dir.dirs.keys()) entries.push([name, 'dir']);
    for (const name of Object.keys(dir.files)) if (all || !name.startsWith('.')) entries.push([name, '']);
    entries.sort((a, b) => cmp(a[0].replace(/^\.+/, ''), b[0].replace(/^\.+/, '')) || cmp(a[0], b[0]));
    if (entries.length) out.put(...entries.flatMap(([name, cls], i) => (i ? [['  ', ''], [name, cls]] : [[name, cls]])));
    return 0;
  },
  cd(args, out) {
    const target = (args[0] ?? '~').replace(/\/+$/, '').replace(/^~\/?/, '').replace(new RegExp(`^${HOME}/?`), '');
    if (target === '' || target === '..' || target === '.' && !this.cwd) { this.cwd = null; return 0; }
    if (target === '.') return 0;
    if (this.cwd && target !== '..') {
      if (this.home.dirs.has(target)) { out.note(`（沙盒只有一层文件夹：先 cd .. 回到 ~，再 cd ${target}）`); return 1; }
      out.put(`bash: cd: ${args[0]}: No such file or directory`);
      return 1;
    }
    if (!this.home.dirs.has(target)) { out.put(`bash: cd: ${args[0]}: No such file or directory`); return 1; }
    this.cwd = target;
    return 0;
  },
  pwd(args, out) { out.put(this.path); return 0; },
  mkdir(args, out) {
    const names = args.filter(a => !a.startsWith('-'));
    if (!names.length) { out.put('mkdir: missing operand'); return 1; }
    if (this.cwd) { out.note('（沙盒只支持一层文件夹：先 cd .. 回到 ~ 再新建）'); return 1; }
    for (const name of names) {
      if (this.home.dirs.has(name) || name in this.home.files) { out.put(`mkdir: cannot create directory '${name}': File exists`); return 1; }
      this.home.dirs.set(name, { name, files: {}, repo: null });
    }
    return 0;
  },
  touch(args) {
    for (const name of args) if (!(name in this.dir.files)) this.dir.files[name] = '';
    return 0;
  },
  rm(args, out) {
    const recursive = args.some(a => /^-\w*r/i.test(a));
    let status = 0;
    for (const name of args.filter(a => !a.startsWith('-'))) {
      const clean = name.replace(/\/+$/, '');
      if (clean === '.git' && this.repo) {
        if (!recursive) { out.put(`rm: cannot remove '${name}': Is a directory`); status = 1; continue; }
        this.dir.repo = null;
      } else if (clean in this.dir.files) delete this.dir.files[clean];
      else if (!this.cwd && this.home.dirs.has(clean)) {
        if (!recursive) { out.put(`rm: cannot remove '${name}': Is a directory`); status = 1; continue; }
        this.home.dirs.delete(clean);
      } else { out.put(`rm: cannot remove '${name}': No such file or directory`); status = 1; }
    }
    return status;
  },
  mv(args, out) {
    const [from, to] = args.filter(a => !a.startsWith('-'));
    if (!(from in this.dir.files)) { out.put(`mv: cannot stat '${from}': No such file or directory`); return 1; }
    this.dir.files[to] = this.dir.files[from];
    delete this.dir.files[from];
    return 0;
  },
  cp(args, out) {
    const [from, to] = args.filter(a => !a.startsWith('-'));
    if (!(from in this.dir.files)) { out.put(`cp: cannot stat '${from}': No such file or directory`); return 1; }
    this.dir.files[to] = this.dir.files[from];
    return 0;
  },
  clear(args, out) { out.actions.push({ type: 'clear' }); return 0; },
  help(args, out) { out.text(HELP); return 0; },
};
for (const name of EDITORS) {
  SHELL[name] = function (args, out) {
    const file = args.find(a => !a.startsWith('-'));
    if (!file) { out.note(`（用法：${name} 文件名）`); return 1; }
    out.actions.push({ type: 'edit', path: file });
    return 0;
  };
}

const HELP = `这个沙盒里可以用的命令：
  文件   ls  cat 文件  echo "文字" > 文件  echo "文字" >> 文件  edit 文件
         touch  rm  mv  cp  mkdir  cd  pwd  clear
  本地   git init  status  add  commit  log  diff  show  restore  rm
  分支   git branch  switch  checkout  merge  rebase  stash  cherry-pick
  撤销   git commit --amend  reset  revert  reflog
  远程   git clone  remote  fetch  pull  push  config
↑ ↓ 翻看历史命令，Tab 补全命令和文件名。`;

const COMMON = ["add", "bisect", "branch", "clone", "commit", "diff", "fetch", "grep", "init", "log", "merge", "mv", "pull", "push", "rebase", "reset", "restore", "rm", "show", "status", "switch", "tag"];
const NO_REPO = new Set(['init', 'clone', 'config']);
const REAL_GIT = ['am', 'archive', 'bisect', 'blame', 'bundle', 'clean', 'describe', 'format-patch', 'gc', 'grep', 'gui', 'notes', 'range-diff', 'request-pull', 'shortlog', 'sparse-checkout', 'submodule', 'tag', 'worktree', 'mv', 'apply', 'fsck', 'ls-files', 'cat-file', 'hash-object', 'rev-parse', 'maintenance', 'restore-staged', 'whatchanged'];

/* ---------------- git 子命令 ---------------- */

const GIT = {
  init(args, out) {
    const o = opts(args, ['q|quiet', 'b|initial-branch:value', 'bare']);
    let dir = this.dir;
    if (o._[0]) {
      if (this.cwd) { out.note('（沙盒只支持一层文件夹：先 cd .. 回到 ~）'); return 1; }
      if (!this.home.dirs.has(o._[0])) this.home.dirs.set(o._[0], { name: o._[0], files: {}, repo: null });
      dir = this.home.dirs.get(o._[0]);
    } else if (!this.cwd) {
      out.note('（先给项目建一个文件夹：mkdir git-test，再 cd git-test，然后 git init。别把整个家目录变成仓库）');
      return 1;
    }
    const where = `${HOME}/${dir.name}/.git/`;
    if (dir.repo) { out.put(`Reinitialized existing Git repository in ${where}`); return 0; }
    dir.repo = newRepo(o.b || this.global['init.defaultbranch'] || 'main');
    if (!o.q) out.put(`Initialized empty Git repository in ${where}`);
    return 0;
  },

  status(args, out) {
    const o = opts(args, ['s|short', 'b|branch', 'porcelain', 'u|untracked-files:value', 'v|verbose']);
    const dir = this.dir, repo = dir.repo;
    if (!o.s && !o.porcelain) { this.printStatus(out, dir); return 0; }
    const s = statusOf(dir);
    if (o.b) {
      const branch = headBranch(repo), track = branch ? this.tracking(repo, branch) : null;
      let head = branch ? (headId(repo) ? branch : `No commits yet on ${branch}`) : 'HEAD (no branch)';
      if (track && !track.gone) head += `...${track.name}${track.ahead || track.behind ? ` [${[track.ahead && `ahead ${track.ahead}`, track.behind && `behind ${track.behind}`].filter(Boolean).join(', ')}]` : ''}`;
      out.put(['## ', ''], [head, 'branch']);
    }
    const rows = new Map();
    for (const f of s.staged) rows.set(f.path, [SHORT[f.kind], ' ']);
    for (const f of s.unstaged) rows.set(f.path, [rows.get(f.path)?.[0] ?? ' ', SHORT[f.kind]]);
    for (const f of s.unmerged) rows.set(f.path, [UNMERGED_SHORT[f.kind][0], UNMERGED_SHORT[f.kind][1]]);
    for (const [path, [x, y]] of [...rows].sort(([a], [b]) => cmp(a, b))) {
      const unmerged = s.unmerged.some(u => u.path === path);
      out.put([x, unmerged ? 'del' : 'add'], [y, 'del'], ` ${path}`);
    }
    for (const path of s.untracked) out.put(['??', 'del'], ` ${path}`);
    return 0;
  },

  add(args, out) {
    const o = opts(args, ['A|all', 'u|update', 'f|force', 'p|patch', 'n|dry-run', 'v|verbose', 'i|interactive']);
    if (o.p || o.i) { out.note('（沙盒不支持交互式暂存，请直接写文件名：git add 文件名）'); return 1; }
    const dir = this.dir, repo = dir.repo, wd = dir.files, index = repo.index;
    const specs = [...o._, ...(o.paths ?? [])];
    if (!specs.length && !o.A && !o.u) {
      out.git('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\nhint: Disable this message with "git config set advice.addEmptyPathspec false"');
      return 0;
    }
    const rules = ignoreRules(wd['.gitignore']);
    const tracked = new Set([...Object.keys(index), ...repo.unmerged.keys()]);
    const every = [...new Set([...Object.keys(wd), ...tracked])].sort(cmp);
    const chosen = new Set(), ignoredHits = [];
    const wholeTree = o.A && !specs.length || specs.some(p => p === '.' || p === './' || p === '*' && false);
    if (wholeTree || o.u && !specs.length) {
      for (const path of every) if (tracked.has(path) || (!o.u && !isIgnored(rules, path))) chosen.add(path);
    }
    for (const spec of specs) {
      if (spec === '.' || spec === './') continue;
      const re = new RegExp('^' + spec.split('').map(c => (c === '*' ? '[^/]*' : c === '?' ? '[^/]' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
      const hits = every.filter(path => path === spec || (/[*?]/.test(spec) && re.test(path)));
      if (!hits.length) fail(`fatal: pathspec '${spec}' did not match any files`);
      for (const path of hits) {
        if (o.u && !tracked.has(path)) continue;
        if (!tracked.has(path) && isIgnored(rules, path) && !o.f) { if (path === spec) ignoredHits.push(path); continue; }
        chosen.add(path);
      }
    }
    for (const path of chosen) {
      if (o.n) { out.put(`add '${path}'`); continue; }
      if (path in wd) index[path] = wd[path]; else delete index[path];
      repo.unmerged.delete(path);
    }
    if (ignoredHits.length) {
      out.git(`The following paths are ignored by one of your .gitignore files:\n${ignoredHits.join('\n')}\nhint: Use -f if you really want to add them.\nhint: Disable this message with "git config set advice.addIgnoredFile false"`);
      return 1;
    }
    return 0;
  },

  rm(args, out) {
    const o = opts(args, ['cached', 'f|force', 'r', 'q|quiet', 'n|dry-run']);
    const dir = this.dir, repo = dir.repo;
    const specs = [...o._, ...(o.paths ?? [])];
    if (!specs.length) fail('usage: git rm [<options>] [--] <file>...', 129);
    const hits = [];
    for (const spec of specs) {
      const found = Object.keys(repo.index).filter(p => p === spec || spec === '.');
      if (!found.length) fail(`fatal: pathspec '${spec}' did not match any files`);
      hits.push(...found);
    }
    for (const path of hits) {
      delete repo.index[path];
      repo.unmerged.delete(path);
      if (!o.cached) delete dir.files[path];
      if (!o.q) out.put(`rm '${path}'`);
    }
    return 0;
  },

  commit(args, out) {
    const o = opts(args, ['m|message:list', 'a|all', 'amend', 'no-edit', 'q|quiet', 'v|verbose', 'allow-empty', 'e|edit', 'F|file:value', 'n|no-verify', 's|signoff']);
    const dir = this.dir, repo = dir.repo;
    const op = repo.op;
    if (repo.unmerged.size) {
      out.git(`error: Committing is not possible because you have unmerged files.\n${UNMERGED_FILES}`);
      for (const path of repo.unmerged.keys()) out.put(`U\t${path}`);
      return 128;
    }
    const head = headId(repo);
    if (o.amend && !head) fail('fatal: You have nothing to amend.');
    if (o.amend && op?.type === 'merge') fail('fatal: You are in the middle of a merge -- cannot amend.');
    if (o.a) for (const f of statusOf(dir).unstaged) { if (f.kind === 'deleted') delete repo.index[f.path]; else repo.index[f.path] = dir.files[f.path]; }
    const old = o.amend ? repo.objects.get(head) : null;
    let message = o.m.length ? cleanMessage(o.m.join('\n\n')) : '';
    if (!message) {
      if (o.amend) {
        message = old.message;
        if (!o['no-edit']) out.note('（真终端会打开编辑器让你修改说明；沙盒按原说明保存。想改说明就用 --amend -m "新说明"）');
      } else if (op?.msg && (op.type === 'merge' || op.type === 'revert')) message = op.msg;
      else if (o.m.length) { out.put('Aborting commit due to empty commit message.'); return 1; }
      else {
        out.note('（真终端会在这里打开一个编辑器让你写提交说明；沙盒没有编辑器，请用 git commit -m "说明"）');
        return 1;
      }
    }
    const tree = { ...repo.index };
    const headTree = treeOf(repo, head);
    const merging = op?.type === 'merge';
    const unchanged = keys(tree, headTree).every(p => tree[p] === headTree[p]);
    if (!o.amend && !merging && !o['allow-empty'] && unchanged) {
      this.printStatus(out, dir, { commitMode: true });
      return 1;
    }
    const author = o.amend ? old.author : this.ident(repo);
    const committer = this.ident(repo);
    const parents = o.amend ? old.parents : merging ? [head, ...op.heads] : head ? [head] : [];
    const commit = this.makeCommit(repo, { tree, parents, author, committer, message });
    const kind = o.amend ? 'commit (amend)' : merging ? 'commit (merge)' : !parents.length ? 'commit (initial)' : 'commit';
    this.moveHead(repo, commit.id, `${kind}: ${subject(message)}`);
    if (op?.type === 'merge' || op?.type === 'revert') repo.op = null;
    if (!o.q) this.printCommitSummary(out, repo, commit, { showDate: o.amend || op?.type === 'revert' });
    return 0;
  },

  log(args, out) {
    const o = opts(args, ['oneline', 'graph', 'all', 'n|max-count:value', 'stat', 'decorate', 'no-decorate', 'p|patch', 'reverse', 'first-parent']);
    const repo = this.repo;
    let exclude = new Set();
    let starts = [];
    for (const spec of o._) {
      const range = spec.match(/^(.*)\.\.(.*)$/);
      if (range) {
        exclude = ancestors(repo, [this.must(repo, range[1] || 'HEAD')]);
        starts.push(this.must(repo, range[2] || 'HEAD'));
      } else starts.push(this.must(repo, spec));
    }
    if (o.all) starts.push(...[...repo.refs].sort(([a], [b]) => cmp(a, b)).map(([, id]) => id), headId(repo));
    if (!o._.length && !o.all) {
      const head = headId(repo);
      if (!head) fail(`fatal: your current branch '${headBranch(repo)}' does not have any commits yet`);
      starts.push(head);
    }
    starts = starts.filter(Boolean);
    if (!starts.length) return 0;
    let order = o.graph ? topoOrder(repo, starts, exclude) : dateOrder(repo, starts, exclude);
    if (o['first-parent']) {
      const keep = new Set();
      let id = starts[0];
      while (id) { keep.add(id); id = repo.objects.get(id).parents[0]; }
      order = order.filter(c => keep.has(c.id));
    }
    if (o.n !== undefined) order = order.slice(0, Number(o.n));
    if (o.reverse && !o.graph) order.reverse();
    const decorate = o.decorate || (this.tty && !o["no-decorate"]);
    if (o.graph) {
      const rows = graphRows(order);
      rows.forEach((r, i) => {
        const more = r.after ? Array.from({ length: r.after }, () => '|').join(' ') + ' ' : '';
        this.printLogEntry(out, repo, r.commit, { oneline: o.oneline, stat: o.stat, prefix: [r.row + ' ', 'graph'], more: o.oneline ? '' : more, decorate, patch: o.p });
        for (const line of r.post) out.put([line, 'graph']);
        if (!o.oneline && i < rows.length - 1 && !r.post.length) out.put([more.trimEnd(), 'graph']);
      });
      return 0;
    }
    order.forEach((c, i) => {
      this.printLogEntry(out, repo, c, { oneline: o.oneline, stat: o.stat, decorate, patch: o.p });
      if (!o.oneline && i < order.length - 1) out.put('');
    });
    return 0;
  },

  show(args, out) {
    const o = opts(args, ['stat', 'oneline', 'name-only', 's|no-patch']);
    const repo = this.repo;
    const spec = o._[0] ?? 'HEAD';
    const blob = spec.match(/^([^:]*):(.+)$/);
    if (blob) {
      const id = this.must(repo, blob[1] || 'HEAD');
      const content = treeOf(repo, id)[blob[2]];
      if (content === undefined) fail(`fatal: path '${blob[2]}' does not exist in '${blob[1] || 'HEAD'}'`);
      for (const line of lines(content)) out.put(line);
      return 0;
    }
    if (!headId(repo) && spec === 'HEAD') fail(UNKNOWN_REV('HEAD'));
    const commit = repo.objects.get(this.must(repo, spec));
    this.printLogEntry(out, repo, commit, { oneline: o.oneline, decorate: this.tty });
    if (o.s || commit.parents.length > 1) return 0;
    const before = treeOf(repo, commit.parents[0]);
    if (o.stat) {
      if (!o.oneline) out.put('');
      this.printStat(out, before, commit.tree, { modes: false });
      return 0;
    }
    if (o['name-only']) { for (const path of keys(before, commit.tree)) if (before[path] !== commit.tree[path]) out.put(path); return 0; }
    if (!o.oneline) out.put('');
    for (const path of keys(before, commit.tree)) this.printDiff(out, path, before[path], commit.tree[path]);
    return 0;
  },

  diff(args, out) {
    const o = opts(args, ['staged', 'cached', 'stat', 'name-only', 'name-status']);
    const dir = this.dir, repo = dir.repo;
    const revs = [], paths = [...(o.paths ?? [])];
    for (const arg of o._) {
      const range = arg.match(/^(.+?)\.\.\.?(.+)$/);
      if (range) revs.push(this.must(repo, range[1]), this.must(repo, range[2]));
      else if (!o.paths && this.resolve(repo, arg) && !(arg in dir.files)) revs.push(this.resolve(repo, arg));
      else if (arg in dir.files || arg in repo.index || arg in treeOf(repo, headId(repo))) paths.push(arg);
      else fail(UNKNOWN_REV(arg));
    }
    const staged = o.staged || o.cached;
    let before, after, unmergedNote = [];
    if (revs.length >= 2) { before = treeOf(repo, revs[0]); after = treeOf(repo, revs[1]); }
    else if (staged) {
      if (!headId(repo) && !revs.length) before = {};
      else before = treeOf(repo, revs[0] ?? this.must(repo, 'HEAD'));
      after = { ...repo.index };
      unmergedNote = [...repo.unmerged.keys()];
      for (const path of unmergedNote) { delete after[path]; delete before[path]; }
    } else if (revs.length === 1) {
      before = treeOf(repo, revs[0]);
      after = {};
      for (const path of keys(before, repo.index)) if (path in dir.files) after[path] = dir.files[path];
    } else {
      before = { ...repo.index };
      after = {};
      for (const path of Object.keys(repo.index)) if (path in dir.files && !repo.unmerged.has(path)) after[path] = dir.files[path];
      for (const path of repo.unmerged.keys()) { delete before[path]; unmergedNote.push(path); }
    }
    let list = keys(before, after).filter(p => before[p] !== after[p]);
    if (paths.length) list = list.filter(p => paths.includes(p));
    for (const path of unmergedNote) if (!paths.length || paths.includes(path)) out.put(`* Unmerged path ${path}`);
    if (o.stat) { this.printStat(out, Object.fromEntries(list.map(p => [p, before[p]]).filter(([, v]) => v !== undefined)), Object.fromEntries(list.map(p => [p, after[p]]).filter(([, v]) => v !== undefined)), { modes: false }); return 0; }
    if (o['name-only']) { for (const path of list) out.put(path); return 0; }
    if (o['name-status']) { for (const path of list) out.put(`${before[path] === undefined ? 'A' : after[path] === undefined ? 'D' : 'M'}\t${path}`); return 0; }
    for (const path of list) this.printDiff(out, path, before[path], after[path]);
    if (unmergedNote.length && !staged) out.note('（冲突中的文件用 cat 文件名 查看冲突标记，改好后 git add 标记为已解决）');
    return 0;
  },

  restore(args, out) {
    const o = opts(args, ['S|staged', 'W|worktree', 's|source:value', 'q|quiet', 'p|patch']);
    if (o.p) { out.note('（沙盒不支持交互式恢复）'); return 1; }
    const dir = this.dir, repo = dir.repo;
    const specs = [...o._, ...(o.paths ?? [])];
    if (!specs.length) fail('fatal: you must specify path(s) to restore');
    const staged = !!o.S, worktree = !!o.W || !o.S;
    const head = treeOf(repo, headId(repo));
    const source = o.s ? treeOf(repo, this.must(repo, o.s, `fatal: could not resolve ${o.s}`)) : null;
    const known = keys(repo.index, staged ? head : {}, source ?? {}, Object.fromEntries([...repo.unmerged.keys()].map(k => [k, 1])));
    const chosen = [];
    for (const spec of specs) {
      const hits = spec === '.' ? known : known.filter(p => p === spec);
      if (!hits.length) { out.git(`error: pathspec '${spec}' did not match any file(s) known to git`); return 1; }
      chosen.push(...hits);
    }
    for (const path of new Set(chosen)) {
      if (worktree && !staged && !source && repo.unmerged.has(path)) fail(`error: path '${path}' is unmerged`, 1);
      if (staged) {
        const from = source ?? head;
        if (from[path] === undefined) delete repo.index[path]; else repo.index[path] = from[path];
        repo.unmerged.delete(path);
      }
      if (worktree) {
        const from = source ?? (staged ? head : repo.index);
        if (from[path] === undefined) { if (source || staged) delete dir.files[path]; }
        else dir.files[path] = from[path];
      }
    }
    return 0;
  },

  branch(args, out) {
    const o = opts(args, ['d|delete', 'D', 'a|all', 'r|remotes', 'v|verbose:count', 'm|move', 'M', 'u|set-upstream-to:value', 'unset-upstream', 'show-current', 'f|force', 'l|list', 'c|copy']);
    const repo = this.repo;
    const current = headBranch(repo);
    if (o['show-current']) { if (current) out.put(current); return 0; }
    if (o.d || o.D) {
      if (!o._.length) fail('fatal: branch name required');
      for (const name of o._) {
        const ref = `refs/heads/${name}`;
        if (!repo.refs.has(ref)) fail(`error: branch '${name}' not found`, 1);
        if (name === current) fail(`error: cannot delete branch '${name}' used by worktree at '${this.path}'`, 1);
        const tip = repo.refs.get(ref);
        const up = this.upstream(repo, name);
        const mergedInto = [headId(repo), up && repo.refs.get(up.ref)].filter(Boolean);
        if (!o.D && !o.f && !mergedInto.some(t => isAncestor(repo, tip, t))) {
          fail(`error: the branch '${name}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${name}'\nhint: Disable this message with "git config set advice.forceDeleteBranch false"`, 1);
        }
        repo.refs.delete(ref);
        delete repo.config[`branch.${name}.remote`];
        delete repo.config[`branch.${name}.merge`];
        out.put(`Deleted branch ${name} (was ${short(tip)}).`);
      }
      return 0;
    }
    if (o.m || o.M) {
      const [from, to] = o._.length >= 2 ? o._ : [current, o._[0]];
      if (!to) fail('fatal: branch name required');
      if (!repo.refs.has(`refs/heads/${from}`) && !(from === current && !headId(repo))) fail(`error: refname refs/heads/${from} not found\nfatal: branch rename failed`);
      if (repo.refs.has(`refs/heads/${to}`) && !o.M) fail(`fatal: a branch named '${to}' already exists`);
      if (repo.refs.has(`refs/heads/${from}`)) { repo.refs.set(`refs/heads/${to}`, repo.refs.get(`refs/heads/${from}`)); repo.refs.delete(`refs/heads/${from}`); }
      if (from === current) repo.head = { ref: `refs/heads/${to}` };
      return 0;
    }
    if (o.u) {
      const branch = o._[0] ?? current;
      const target = o.u.match(/^([^/]+)\/(.+)$/);
      if (!target || !repo.refs.has(`refs/remotes/${o.u}`)) fail(`fatal: the requested upstream branch '${o.u}' does not exist`);
      this.setUpstream(repo, branch, target[1], target[2]);
      out.put(`branch '${branch}' set up to track '${o.u}'.`);
      return 0;
    }
    if (o['unset-upstream']) { delete repo.config[`branch.${current}.remote`]; delete repo.config[`branch.${current}.merge`]; return 0; }
    if (o._.length && !o.l) {
      const [name, start] = o._;
      validateBranch(name);
      if (repo.refs.has(`refs/heads/${name}`) && !o.f) fail(`fatal: a branch named '${name}' already exists`);
      const id = start ? this.must(repo, start, `fatal: not a valid object name: '${start}'`) : headId(repo);
      if (!id) fail(`fatal: not a valid object name: '${current}'`);
      repo.refs.set(`refs/heads/${name}`, id);
      if (start && repo.refs.has(`refs/remotes/${start}`)) {
        const [remote, ...rest] = start.split('/');
        this.setUpstream(repo, name, remote, rest.join('/'));
        out.put(`branch '${name}' set up to track '${start}'.`);
      }
      return 0;
    }
    const rows = [];
    if (!current && headId(repo)) {
      const op = repo.op;
      const d = detachedInfo(repo);
      rows.push({ name: op?.type === 'rebase' ? `(no branch, rebasing ${shortRef(op.branch)})` : `(HEAD detached ${d.at ? 'at' : 'from'} ${d.from})`, id: headId(repo), current: true, local: true });
    }
    if (!o.r) for (const [ref, id] of [...repo.refs].filter(([r]) => r.startsWith('refs/heads/')).sort(([a], [b]) => cmp(a, b))) rows.push({ name: ref.slice(11), id, current: ref.slice(11) === current, local: true });
    if (o.a || o.r) {
      for (const [name, target] of [...repo.symrefs].sort(([a], [b]) => cmp(a, b))) rows.push({ name: `${o.a ? 'remotes/' : ''}${shortRef(name)} -> ${shortRef(target)}`, symbolic: true });
      for (const [ref, id] of [...repo.refs].filter(([r]) => r.startsWith('refs/remotes/')).sort(([a], [b]) => cmp(a, b))) rows.push({ name: `${o.a ? 'remotes/' : ''}${shortRef(ref)}`, id });
    }
    const width = Math.max(0, ...rows.filter(r => !r.symbolic).map(r => r.name.length));
    for (const r of rows) {
      const mark = r.current ? '* ' : '  ';
      const cls = r.current ? 'branch' : r.local ? '' : 'remote';
      if (!o.v || r.symbolic) { out.put(mark, [r.name, cls]); continue; }
      let track = '';
      const t = r.local && !r.name.startsWith('(') ? this.tracking(repo, r.name) : null;
      if (t) {
        const counts = t.gone ? 'gone' : [t.ahead && `ahead ${t.ahead}`, t.behind && `behind ${t.behind}`].filter(Boolean).join(', ');
        if (o.v >= 2) track = `[${t.name}${counts ? `: ${counts}` : ''}] `;
        else if (counts) track = `[${counts}] `;
      }
      out.put(mark, [r.name.padEnd(width), cls], ' ', [short(r.id), 'hash'], ` ${track}${subject(repo.objects.get(r.id).message)}`);
    }
    return 0;
  },

  switch(args, out) {
    const o = opts(args, ['c|create:value', 'C|force-create:value', 'd|detach', 'f|force|discard-changes', 't|track', 'q|quiet']);
    return this.switchTo(o, out, 'switch');
  },

  checkout(args, out) {
    const o = opts(args, ['b:value', 'B:value', 'f|force', 'detach', 't|track', 'q|quiet']);
    const dir = this.dir, repo = dir.repo;
    const first = o._[0];
    const isPathForm = o.paths !== null || (first && !o.b && !o.B && !this.resolve(repo, first) && !repo.refs.has(`refs/remotes/origin/${first}`) && first !== '-');
    if (isPathForm) {
      const specs = o.paths !== null ? o.paths : o._;
      const source = o.paths !== null && o._.length ? treeOf(repo, this.must(repo, o._[0])) : null;
      const from = source ?? repo.index;
      let count = 0;
      for (const spec of specs) {
        const hits = spec === '.' ? Object.keys(from) : Object.keys(from).filter(p => p === spec);
        if (!hits.length) fail(`error: pathspec '${spec}' did not match any file(s) known to git`, 1);
        for (const path of hits) {
          dir.files[path] = from[path];
          if (source) repo.index[path] = from[path];
          count++;
        }
      }
      out.put(`Updated ${plural(count, 'path')} from ${source ? 'the tree' : 'the index'}`);
      return 0;
    }
    return this.switchTo({ ...o, c: o.b, C: o.B, d: o.detach, checkoutStyle: true }, out, 'checkout');
  },

  merge(args, out) {
    const o = opts(args, ['abort', 'continue', 'no-ff', 'ff-only', 'ff', 'm|message:value', 'no-edit', 'e|edit', 'squash', 'q|quiet', 'no-commit', 'X|strategy-option:value']);
    const dir = this.dir, repo = dir.repo;
    if (o.abort) {
      if (repo.op?.type !== 'merge') fail('fatal: There is no merge to abort (MERGE_HEAD missing).');
      this.hardReset(dir, repo.op.orig, repo.op.touched);
      repo.reflog.push({ id: repo.op.orig, msg: 'reset: moving to HEAD' });
      repo.op = null;
      return 0;
    }
    if (o.continue) {
      if (repo.op?.type !== 'merge') fail('fatal: There is no merge in progress (MERGE_HEAD missing).');
      return GIT.commit.call(this, [], out);
    }
    if (o.squash) { out.note('（沙盒没有模拟 --squash）'); return 1; }
    if (repo.unmerged.size) fail(`error: Merging is not possible because you have unmerged files.\n${UNMERGED_FILES}`);
    if (repo.op?.type === 'merge') fail('fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.');
    const name = o._[0];
    if (!name) fail('fatal: No remote for the current branch.');
    const theirs = this.resolve(repo, name);
    if (!theirs) fail(`merge: ${name} - not something we can merge`, 1);
    const branch = headBranch(repo);
    const label = repo.refs.has(`refs/remotes/${name}`) ? `remote-tracking branch '${name}'` : repo.refs.has(`refs/heads/${name}`) ? `branch '${name}'` : `commit '${short(theirs)}'`;
    const msg = o.m ?? `Merge ${label}${branch && !['main', 'master'].includes(branch) ? ` into ${branch}` : ''}`;
    return this.mergeCommitish(dir, theirs, { name, msg, noFf: o['no-ff'], ffOnly: o['ff-only'], labelTheirs: name }, out);
  },

  reset(args, out) {
    const o = opts(args, ['soft', 'mixed', 'hard', 'merge', 'keep', 'q|quiet']);
    const dir = this.dir, repo = dir.repo;
    const head = headId(repo);
    const words = [...o._];
    let rev = null;
    const paths = [...(o.paths ?? [])];
    if (words.length && this.resolve(repo, words[0]) && !(words[0] in dir.files && words.length === 1 && !o.soft && !o.hard)) rev = words.shift();
    paths.push(...words);
    if (paths.length) {
      if (o.soft || o.hard) fail(`fatal: Cannot do ${o.soft ? 'soft' : 'hard'} reset with paths.`);
      const source = treeOf(repo, rev ? this.must(repo, rev) : head);
      for (const path of paths) {
        if (!(path in repo.index) && !(path in source) && !repo.unmerged.has(path)) fail(UNKNOWN_REV(path));
        if (source[path] === undefined) delete repo.index[path]; else repo.index[path] = source[path];
        repo.unmerged.delete(path);
      }
      this.printUnstaged(out, dir);
      return 0;
    }
    const target = rev ? this.must(repo, rev) : head;
    if (!target) fail(UNKNOWN_REV('HEAD'));
    repo.origHead = head;
    if (repo.head.ref) repo.refs.set(repo.head.ref, target); else repo.head.id = target;
    repo.reflog.push({ id: target, msg: `reset: moving to ${rev ?? 'HEAD'}` });
    if (repo.op?.type === 'merge' || repo.op?.type === 'revert') repo.op = null;
    if (o.soft) return 0;
    if (o.hard) {
      this.hardReset(dir, target);
      out.put(`HEAD is now at ${short(target)} ${subject(repo.objects.get(target).message)}`);
      return 0;
    }
    repo.index = { ...treeOf(repo, target) };
    repo.unmerged.clear();
    this.printUnstaged(out, dir);
    return 0;
  },

  revert(args, out) {
    const o = opts(args, ['no-edit', 'e|edit', 'n|no-commit', 'abort', 'continue', 'skip', 'm|mainline:value']);
    const dir = this.dir, repo = dir.repo;
    if (o.abort) {
      if (repo.op?.type !== 'revert') fail('error: no cherry-pick or revert in progress\nfatal: revert failed');
      this.hardReset(dir, repo.op.orig, repo.op.touched);
      repo.op = null;
      return 0;
    }
    if (o.continue) {
      if (repo.op?.type !== 'revert') fail('error: no cherry-pick or revert in progress\nfatal: revert failed');
      if (repo.unmerged.size) fail(`error: Committing is not possible because you have unmerged files.\n${UNMERGED_FILES}`);
      return GIT.commit.call(this, [], out);
    }
    if (!o._.length) fail('usage: git revert [--[no-]edit] [-n] [-m <parent-number>] [-s] [-S[<keyid>]] <commit>...', 129);
    const id = this.must(repo, o._[0], `fatal: bad revision '${o._[0]}'`);
    const commit = repo.objects.get(id);
    if (commit.parents.length > 1 && !o.m) fail(`error: commit ${id} is a merge but no -m option was given.\nfatal: revert failed`);
    if (this.dirtyPaths(dir).size) fail('error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed');
    const parent = commit.parents[o.m ? Number(o.m) - 1 : 0];
    const ours = treeOf(repo, headId(repo));
    const result = this.mergeTrees(commit.tree, ours, treeOf(repo, parent), { ours: 'HEAD', theirs: `parent of ${short(id)} (${subject(commit.message)})` });
    const touched = keys(ours, result.tree).filter(p => ours[p] !== result.tree[p] || result.conflicts.some(c => c.path === p));
    this.applyMerge(dir, result, touched);
    const msg = `Revert "${subject(commit.message)}"\n\nThis reverts commit ${id}.\n`;
    if (result.conflicts.length) {
      repo.op = { type: 'revert', commit: id, msg, orig: headId(repo), touched };
      out.git(result.messages.join('\n'));
      out.git(`error: could not revert ${short(id)}... ${subject(commit.message)}\nhint: After resolving the conflicts, mark them with\nhint: "git add/rm <pathspec>", then run\nhint: "git revert --continue".\nhint: You can instead skip this commit with "git revert --skip".\nhint: To abort and get back to the state before "git revert",\nhint: run "git revert --abort".\nhint: Disable this message with "git config set advice.mergeConflict false"`);
      return 1;
    }
    if (o.n) return 0;
    const who = this.ident(repo);
    const created = this.makeCommit(repo, { tree: { ...repo.index }, parents: [headId(repo)], author: who, committer: who, message: msg });
    this.moveHead(repo, created.id, `revert: ${subject(msg)}`);
    this.printCommitSummary(out, repo, created, { showDate: true });
    return 0;
  },

  'cherry-pick'(args, out) {
    const o = opts(args, ['abort', 'continue', 'x', 'e|edit', 'n|no-commit']);
    const dir = this.dir, repo = dir.repo;
    if (o.abort || o.continue) {
      if (repo.op?.type !== 'merge' || !repo.op.pick) fail('error: no cherry-pick or revert in progress\nfatal: cherry-pick failed');
      if (o.abort) { this.hardReset(dir, repo.op.orig, repo.op.touched); repo.op = null; return 0; }
      return GIT.commit.call(this, [], out);
    }
    const id = this.must(repo, o._[0] ?? '', `fatal: bad revision '${o._[0] ?? ''}'`);
    if (this.dirtyPaths(dir).size) fail('error: your local changes would be overwritten by cherry-pick.\nhint: commit your changes or stash them to proceed.\nfatal: cherry-pick failed');
    const { commit, result, touched } = this.replay(dir, id, { ours: 'HEAD', theirs: `${short(id)} (${subject(repo.objects.get(id).message)})` });
    this.applyMerge(dir, result, touched);
    if (result.conflicts.length) {
      repo.op = { type: 'merge', heads: [], msg: commit.message, orig: headId(repo), touched, pick: true };
      out.git(result.messages.join('\n'));
      out.git(`error: could not apply ${short(id)}... ${subject(commit.message)}\nhint: After resolving the conflicts, mark them with\nhint: "git add/rm <pathspec>", then run\nhint: "git cherry-pick --continue".\nhint: You can instead skip this commit with "git cherry-pick --skip".\nhint: To abort and get back to the state before "git cherry-pick",\nhint: run "git cherry-pick --abort".\nhint: Disable this message with "git config set advice.mergeConflict false"`);
      return 1;
    }
    const created = this.commitPick(repo, commit, 'cherry-pick');
    if (!created) { out.note('（这个提交的改动当前分支上已经有了，没有产生新提交）'); return 1; }
    this.printCommitSummary(out, repo, created, { showDate: true });
    return 0;
  },

  reflog(args, out) {
    const repo = this.repo;
    const o = opts(args.filter(a => a !== 'show'), ['n|max-count:value', 'all']);
    if (!repo.reflog.length) fail(`fatal: your current branch '${headBranch(repo)}' does not have any commits yet`);
    const entries = [...repo.reflog].reverse().slice(0, o.n !== undefined ? Number(o.n) : undefined);
    entries.forEach((entry, i) => out.put([short(entry.id), "hash"], ...(this.tty ? decorSegments(repo, entry.id) : []), ` HEAD@{${i}}: ${entry.msg}`));
    return 0;
  },

  stash(args, out) {
    const dir = this.dir, repo = dir.repo;
    const sub = args[0] && !args[0].startsWith('-') ? args[0] : 'push';
    const rest = sub === args[0] ? args.slice(1) : args;
    const pick = spec => {
      const n = spec ? Number((spec.match(/^(?:stash@\{)?(\d+)\}?$/) ?? [])[1]) : 0;
      if (!repo.stash[n]) fail(spec ? `error: ${spec} is not a valid reference` : 'No stash entries found.', 1);
      return n;
    };
    if (sub === 'list') { repo.stash.forEach((s, i) => out.put(`stash@{${i}}: ${s.msg}`)); return 0; }
    if (sub === 'show') {
      const s = repo.stash[pick(rest[0])];
      this.printStat(out, treeOf(repo, s.base), s.wd, { modes: false });
      return 0;
    }
    if (sub === 'drop' || sub === 'clear') {
      if (sub === 'clear') { repo.stash = []; return 0; }
      const n = pick(rest[0]);
      const [s] = repo.stash.splice(n, 1);
      out.put(`Dropped refs/stash@{${n}} (${s.id})`);
      return 0;
    }
    if (sub === 'pop' || sub === 'apply') {
      const n = pick(rest.find(a => !a.startsWith('-')));
      const s = repo.stash[n];
      const base = treeOf(repo, s.base), head = treeOf(repo, headId(repo));
      const touched = keys(base, s.wd, s.index).filter(p => s.wd[p] !== base[p] || s.index[p] !== base[p]);
      const dirty = this.dirtyPaths(dir);
      const blocked = touched.filter(p => dirty.has(p));
      if (blocked.length) {
        out.git(`error: Your local changes to the following files would be overwritten by merge:\n${blocked.map(p => `\t${p}`).join('\n')}\nPlease commit your changes or stash them before you merge.\nAborting`);
        out.put('The stash entry is kept in case you need it again.');
        return 1;
      }
      let conflicted = false;
      for (const path of touched) {
        const merged = this.mergeTrees({ [path]: base[path] }, { [path]: head[path] }, { [path]: s.wd[path] }, { ours: 'Updated upstream', theirs: 'Stashed changes' });
        const value = merged.tree[path];
        if (merged.conflicts.length) { conflicted = true; out.git(merged.messages.join('\n')); repo.unmerged.set(path, { kind: merged.conflicts[0].kind }); }
        if (value === undefined) { delete dir.files[path]; if (!(path in head)) delete repo.index[path]; }
        else {
          dir.files[path] = value;
          if (!(path in head) && path in s.index) repo.index[path] = value;
        }
      }
      if (conflicted) { out.put('The stash entry is kept in case you need it again.'); return 1; }
      this.printStatus(out, dir);
      if (sub === 'pop') { repo.stash.splice(n, 1); out.put(`Dropped refs/stash@{${n}} (${s.id})`); }
      return 0;
    }
    if (sub !== 'push' && sub !== 'save') fail(`fatal: subcommand wasn't specified; 'push' can't be assumed due to unexpected token '${sub}'`, 129);
    const o = opts(rest, ['m|message:value', 'u|include-untracked', 'k|keep-index', 'q|quiet']);
    const head = headId(repo);
    if (!head) fail('You do not have the initial commit yet', 1);
    const s = statusOf(dir);
    if (!s.staged.length && !s.unstaged.length && !(o.u && s.untracked.length)) { out.put('No local changes to save'); return 0; }
    const branch = headBranch(repo) ?? '(no branch)';
    const base = repo.objects.get(head);
    const wtree = {};
    for (const path of Object.keys(repo.index)) if (path in dir.files) wtree[path] = dir.files[path];
    const wd = { ...wtree };
    if (o.u) for (const path of s.untracked) wd[path] = dir.files[path];
    const msg = o.m ? `On ${branch}: ${o.m}` : `WIP on ${branch}: ${short(head)} ${subject(base.message)}`;
    // 与 Git 相同的结构：I 记录暂存区，W 记录工作区，W 的父提交是 HEAD 和 I
    const who = this.ident(repo);
    const indexCommit = commitId({ tree: repo.index, parents: [head], author: who, committer: who, message: `index on ${branch}: ${short(head)} ${subject(base.message)}\n` });
    const id = commitId({ tree: wtree, parents: [head, indexCommit], author: who, committer: who, message: msg });
    repo.stash.unshift({ id, base: head, index: { ...repo.index }, wd, msg });
    this.hardReset(dir, head);
    if (o.u) for (const path of s.untracked) delete dir.files[path];
    repo.reflog.push({ id: head, msg: 'reset: moving to HEAD' });
    out.put(`Saved working directory and index state ${msg}`);
    return 0;
  },

  rebase(args, out) {
    const o = opts(args, ['continue', 'abort', 'skip', 'i|interactive', 'onto:value', 'q|quiet']);
    const dir = this.dir, repo = dir.repo, op = repo.op;
    if (o.i) { out.note('（沙盒没有模拟交互式变基 rebase -i）'); return 1; }
    if (o.abort || o.continue || o.skip) {
      if (op?.type !== 'rebase') fail('fatal: No rebase in progress?');
      if (o.abort) {
        this.hardReset(dir, op.orig);
        repo.refs.set(op.branch, op.orig);
        repo.head = { ref: op.branch };
        repo.reflog.push({ id: op.orig, msg: `rebase (abort): returning to ${op.branch}` });
        repo.op = null;
        return 0;
      }
      if (o.skip) { this.hardReset(dir, headId(repo)); return this.continueRebase(dir, out); }
      if (repo.unmerged.size) {
        out.git(`${[...repo.unmerged.keys()].map(p => `${p}: needs merge`).join('\n')}\nYou must edit all merge conflicts and then\nmark them as resolved using git add`);
        return 1;
      }
      if (op.current) {
        const original = repo.objects.get(op.current);
        const created = this.commitPick(repo, original, 'rebase (continue)');
        if (created) this.printCommitSummary(out, repo, created);
        op.current = null;
      }
      return this.continueRebase(dir, out);
    }
    if (op?.type === 'rebase') fail('fatal: It seems that there is already a rebase-merge directory, and\nI wonder if you are in the middle of another rebase.\n（沙盒：先 git rebase --continue 或 git rebase --abort）');
    if (repo.unmerged.size || op) fail('error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.', 1);
    let name = o._[0];
    if (!name) {
      const up = headBranch(repo) && this.upstream(repo, headBranch(repo));
      if (!up) fail('There is no tracking information for the current branch.\nPlease specify which branch you want to rebase against.\nSee git-rebase(1) for details.\n\n    git rebase \'<branch>\'\n', 1);
      name = up.name;
    }
    const upstream = this.must(repo, name, `fatal: invalid upstream '${name}'`);
    return this.startRebase(dir, upstream, name, out);
  },

  remote(args, out) {
    const repo = this.repo;
    const names = [...new Set(Object.keys(repo.config).map(k => k.match(/^remote\.(.+)\.url$/)?.[1]).filter(Boolean))].sort(cmp);
    const [sub, ...rest] = args;
    if (!sub) { for (const n of names) out.put(n); return 0; }
    if (sub === '-v' || sub === '--verbose') { for (const n of names) { out.put(`${n}\t${repo.config[`remote.${n}.url`]} (fetch)`); out.put(`${n}\t${repo.config[`remote.${n}.url`]} (push)`); } return 0; }
    if (sub === 'add') {
      const [name, url] = rest;
      if (!name || !url) fail('usage: git remote add [<options>] <name> <url>', 129);
      if (names.includes(name)) fail(`error: remote ${name} already exists.`, 3);
      repo.config[`remote.${name}.url`] = url;
      repo.config[`remote.${name}.fetch`] = `+refs/heads/*:refs/remotes/${name}/*`;
      return 0;
    }
    if (sub === 'remove' || sub === 'rm') {
      const [name] = rest;
      if (!names.includes(name)) fail(`error: No such remote: '${name}'`, 2);
      for (const k of Object.keys(repo.config)) if (k.startsWith(`remote.${name}.`)) delete repo.config[k];
      for (const ref of [...repo.refs.keys()]) if (ref.startsWith(`refs/remotes/${name}/`)) repo.refs.delete(ref);
      for (const ref of [...repo.symrefs.keys()]) if (ref.startsWith(`refs/remotes/${name}/`)) repo.symrefs.delete(ref);
      return 0;
    }
    if (sub === 'get-url') { const url = repo.config[`remote.${rest[0]}.url`]; if (!url) fail(`error: No such remote '${rest[0]}'`, 2); out.put(url); return 0; }
    if (sub === 'set-url') { if (!repo.config[`remote.${rest[0]}.url`]) fail(`error: No such remote '${rest[0]}'`, 2); repo.config[`remote.${rest[0]}.url`] = rest[1]; return 0; }
    out.note(`（沙盒没有模拟 git remote ${sub}）`);
    return 1;
  },

  clone(args, out) {
    const o = opts(args, ['b|branch:value', 'q|quiet', 'depth:value']);
    const url = o._[0];
    if (!url) fail('fatal: You must specify a repository to clone.', 129);
    if (this.cwd) { out.note('（沙盒只支持一层文件夹：先 cd .. 回到 ~ 再 clone）'); return 1; }
    const name = o._[1] ?? urlKey(url).split('/').pop();
    const existing = this.home.dirs.get(name);
    if (existing && (existing.repo || Object.keys(existing.files).length)) fail(`fatal: destination path '${name}' already exists and is not an empty directory.`);
    out.put(`Cloning into '${name}'...`);
    const remote = this.remoteRepo(url);
    if (!remote) fail(`remote: Repository not found.\nfatal: repository '${url.replace(/\/?$/, '/')}' not found`);
    const branch = o.b ?? remote.head.ref.slice(11);
    const repo = newRepo(branch);
    const dir = { name, files: {}, repo };
    this.home.dirs.set(name, dir);
    repo.config['remote.origin.url'] = url;
    repo.config['remote.origin.fetch'] = '+refs/heads/*:refs/remotes/origin/*';
    const heads = [...remote.refs].filter(([r]) => r.startsWith('refs/heads/'));
    if (!heads.length) { out.git("warning: You appear to have cloned an empty repository."); this.setUpstream(repo, branch, 'origin', branch); return 0; }
    const moved = this.transfer(remote, repo, heads.map(([, id]) => id));
    const n = moved.objects;
    if (!/^https?:\/\//.test(url)) out.put('done.');
    else if (this.progress) {
      out.put(`remote: Enumerating objects: ${n}, done.`);
      out.put(`remote: Counting objects: 100% (${n}/${n}), done.`);
      out.put(`remote: Compressing objects: 100% (${moved.commits}/${moved.commits}), done.`);
      out.put(`remote: Total ${n} (delta 0), reused ${n} (delta 0), pack-reused 0 (from 0)`);
      out.put(`Receiving objects: 100% (${n}/${n}), done.`);
    }
    for (const [ref, id] of heads) repo.refs.set(`refs/remotes/origin/${ref.slice(11)}`, id);
    repo.symrefs.set('refs/remotes/origin/HEAD', `refs/remotes/origin/${remote.head.ref.slice(11)}`);
    const tip = remote.refs.get(`refs/heads/${branch}`);
    if (!tip) fail(`warning: Could not find remote branch ${branch} to clone.\nfatal: Remote branch ${branch} not found in upstream origin`);
    repo.refs.set(`refs/heads/${branch}`, tip);
    this.setUpstream(repo, branch, 'origin', branch);
    repo.index = { ...treeOf(repo, tip) };
    dir.files = { ...repo.index };
    repo.reflog.push({ id: tip, msg: `clone: from ${url}` });
    return 0;
  },

  fetch(args, out) {
    const o = opts(args, ['all', 'p|prune', 'q|quiet', 'v|verbose']);
    const repo = this.repo;
    const remote = o._[0] ?? (headBranch(repo) && this.upstream(repo, headBranch(repo))?.remote) ?? 'origin';
    this.fetchInto(repo, remote, out);
    return 0;
  },

  pull(args, out) {
    const o = opts(args, ['r|rebase', 'no-rebase', 'ff-only', 'ff', 'no-ff', 'q|quiet', 'v|verbose', 'no-edit']);
    const dir = this.dir, repo = dir.repo;
    if (repo.unmerged.size) fail(`error: Pulling is not possible because you have unmerged files.\n${UNMERGED_FILES}`);
    if (repo.op?.type === 'merge') fail('error: You have not concluded your merge (MERGE_HEAD exists).\nhint: Please, commit your changes before merging.\nfatal: Exiting because of unfinished merge.');
    if (repo.op?.type === 'rebase') fail('fatal: It seems that there is already a rebase-merge directory.\n（沙盒：先 git rebase --continue 或 git rebase --abort）');
    const branch = headBranch(repo);
    if (!branch) fail('You are not currently on a branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n', 1);
    const up = this.upstream(repo, branch);
    const remoteName = o._[0] ?? up?.remote;
    const remoteBranch = o._[1] ?? (o._[0] ? (o._[0] === up?.remote ? up?.branch : null) : up?.branch);
    if (!remoteName || !remoteBranch) {
      if (remoteName) this.fetchInto(repo, remoteName, out);
      fail(`There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=${remoteName ?? 'origin'}/<branch> ${branch}\n`, 1);
    }
    this.fetchInto(repo, remoteName, out);
    const theirs = repo.refs.get(`refs/remotes/${remoteName}/${remoteBranch}`);
    if (!theirs) fail(`fatal: couldn't find remote ref ${remoteBranch}`, 1);
    const ours = headId(repo);
    const url = repo.config[`remote.${remoteName}.url`];
    if (!ours) {
      this.checkoutTree(dir, theirs, 'merge');
      this.moveHead(repo, theirs, `pull: Fast-forward`);
      return 0;
    }
    if (isAncestor(repo, theirs, ours)) { out.put('Already up to date.'); return 0; }
    const rebaseConfig = this.config(repo, 'pull.rebase'), ffConfig = this.config(repo, 'pull.ff');
    const mode = o.r ? 'rebase' : o['no-rebase'] ? 'merge' : o['ff-only'] ? 'ff-only' : rebaseConfig === 'true' ? 'rebase' : rebaseConfig === 'false' ? 'merge' : ffConfig === 'only' ? 'ff-only' : null;
    const ff = isAncestor(repo, ours, theirs);
    if (!ff) {
      if (!mode) fail(DIVERGENT);
      if (mode === 'ff-only') fail('fatal: Not possible to fast-forward, aborting.');
      if (mode === 'rebase') return this.startRebase(dir, theirs, `${remoteName}/${remoteBranch}`, out);
    }
    const msg = `Merge branch '${remoteBranch}' of ${urlKey(url)}${!['main', 'master'].includes(branch) ? ` into ${branch}` : ''}`;
    return this.mergeCommitish(dir, theirs, { name: `${remoteName}/${remoteBranch}`, msg, noFf: o['no-ff'], labelTheirs: theirs, reflog: 'pull' }, out);
  },

  push(args, out) {
    const o = opts(args, ['u|set-upstream', 'f|force', 'force-with-lease', 'd|delete', 'all', 'tags', 'q|quiet', 'v|verbose']);
    const repo = this.repo;
    const branch = headBranch(repo);
    const remotes = [...new Set(Object.keys(repo.config).map(k => k.match(/^remote\.(.+)\.url$/)?.[1]).filter(Boolean))];
    let remoteName = o._[0];
    let specs = o._.slice(1);
    const noUpstream = name => `fatal: The current branch ${name} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream ${remotes[0] ?? 'origin'} ${name}\n\nTo have this happen automatically for branches without a tracking\nupstream, see 'push.autoSetupRemote' in 'git help config'.\n`;
    if (!remoteName) {
      if (!branch) fail('fatal: You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push origin HEAD:<name-of-remote-branch>\n');
      remoteName = this.upstream(repo, branch)?.remote;
      if (!remoteName) {
        if (!remotes.length) fail('fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n');
        fail(noUpstream(branch));
      }
    }
    const url = repo.config[`remote.${remoteName}.url`];
    if (!url) fail(`fatal: '${remoteName}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.`);
    if (!specs.length) {
      if (!branch) fail('fatal: You are not currently on a branch.');
      const up = this.upstream(repo, branch);
      if (!up && !o.u && !o._[0]) fail(noUpstream(branch));
      specs = [up && up.remote === remoteName ? `${branch}:${up.branch}` : branch];
    }
    const remote = this.remoteRepo(url);
    if (!remote) fail(`remote: Repository not found.\nfatal: repository '${url.replace(/\/?$/, '/')}' not found`);
    const results = [];
    for (const spec of specs) {
      // 输出里保留原样写法（HEAD -> review），真正推送的是它指向的分支
      let [shown, dst] = spec.split(':');
      if (dst === undefined) dst = shown === 'HEAD' ? branch : shown;
      const src = shown === 'HEAD' ? branch ?? headId(repo) : shown;
      if (o.d || shown === '') {
        const old = remote.refs.get(`refs/heads/${dst}`);
        if (!old) { results.push({ error: `error: unable to delete '${dst}': remote ref does not exist` }); continue; }
        remote.refs.delete(`refs/heads/${dst}`);
        repo.refs.delete(`refs/remotes/${remoteName}/${dst}`);
        results.push({ line: ` - ${'[deleted]'.padEnd(17)} ${dst}` });
        continue;
      }
      const local = this.resolve(repo, src);
      if (!local) { results.push({ error: `error: src refspec ${shown} does not match any` }); continue; }
      const old = remote.refs.get(`refs/heads/${dst}`);
      if (old === local) { results.push({ uptodate: true, src: shown, dst }); if (o.u && branch) this.setUpstream(repo, src, remoteName, dst); continue; }
      const forced = old && !isAncestor(repo, old, local);
      if (forced && !o.f && !o['force-with-lease']) {
        results.push({ rejected: repo.objects.has(old) ? 'non-fast-forward' : 'fetch first', src: shown, dst });
        continue;
      }
      const moved = this.transfer(repo, remote, [local]);
      remote.refs.set(`refs/heads/${dst}`, local);
      repo.refs.set(`refs/remotes/${remoteName}/${dst}`, local);
      results.push({ src: shown, branch: src, dst, old, id: local, forced, moved, created: !old });
      if (o.u) this.setUpstream(repo, src, remoteName, dst);
    }
    const pushed = results.filter(r => r.id);
    if (!pushed.length && results.every(r => r.uptodate)) { out.put('Everything up-to-date'); return 0; }
    const objects = pushed.reduce((s, r) => s + r.moved.objects, 0);
    if (objects && this.showProgress(url)) {
      out.put(`Enumerating objects: ${objects + 1}, done.`);
      out.put(`Counting objects: 100% (${objects + 1}/${objects + 1}), done.`);
      out.put('Delta compression using up to 8 threads');
      out.put(`Compressing objects: 100% (${pushed.reduce((s, r) => s + r.moved.commits, 0)}/${pushed.reduce((s, r) => s + r.moved.commits, 0)}), done.`);
      out.put(`Writing objects: 100% (${objects}/${objects}), ${objects * 95} bytes | ${(objects * 95 / 10).toFixed(2)} KiB/s, done.`);
      out.put(`Total ${objects} (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)`);
    }
    const github = urlKey(url).startsWith('https://github.com/');
    for (const r of pushed.filter(r => r.created && github && r.dst !== remote.head.ref?.slice(11))) {
      out.put('remote: ');
      out.put(`remote: Create a pull request for '${r.dst}' on GitHub by visiting:`);
      out.put(`remote:      ${urlKey(url)}/pull/new/${r.dst}`);
      out.put('remote: ');
    }
    for (const r of results.filter(r => r.error)) out.git(r.error);
    if (results.some(r => !r.error)) out.put(`To ${url}`);
    let status = 0;
    for (const r of results) {
      if (r.line) out.put(r.line);
      else if (r.created) out.put(` * ${'[new branch]'.padEnd(17)} ${r.src} -> ${r.dst}`);
      else if (r.forced) out.put(` + ${`${short(r.old)}...${short(r.id)}`.padEnd(17)} ${r.src} -> ${r.dst} (forced update)`);
      else if (r.id) out.put(`   ${`${short(r.old)}..${short(r.id)}`.padEnd(17)} ${r.src} -> ${r.dst}`);
      else if (r.rejected) { out.put([` ! ${'[rejected]'.padEnd(17)} ${r.src} -> ${r.dst} (${r.rejected})`, 'err']); status = 1; }
      else if (r.error) status = 1;
    }
    if (status) {
      out.git(`error: failed to push some refs to '${url}'`);
      const rejected = results.find(r => r.rejected);
      if (rejected?.rejected === 'fetch first') out.git("hint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.");
      else if (rejected) out.git("hint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart. If you want to integrate the remote changes,\nhint: use 'git pull' before pushing again.\nhint: See the 'Note about fast-forwards' in 'git push --help' for details.");
    }
    if (o.u) for (const r of pushed) out.put(`branch '${r.branch}' set up to track '${remoteName}/${r.dst}'.`);
    return status;
  },

  config(args, out) {
    const o = opts(args, ['global', 'local', 'system', 'l|list', 'unset', 'get', 'add']);
    const words = [...o._];
    if (words[0] === 'set' || words[0] === 'get' || words[0] === 'unset' || words[0] === 'list') {
      const verb = words.shift();
      if (verb === 'get') o.get = true; else if (verb === 'unset') o.unset = true; else if (verb === 'list') o.l = true;
    }
    const repo = this.repo;
    if (!o.global && !repo && !o.l && words.length > 1) fail('fatal: not in a git directory');
    const store = o.global || o.system || !repo ? this.global : repo.config;
    if (o.l) {
      for (const [k, v] of Object.entries(this.global)) out.put(`${k}=${v}`);
      if (repo && !o.global) for (const [k, v] of Object.entries(repo.config)) out.put(`${k}=${v}`);
      return 0;
    }
    const [rawKey, ...value] = words;
    if (!rawKey) fail('usage: git config [<options>]', 129);
    const key = rawKey.replace(/^([^.]+)\.(.*)\.([^.]+)$/, (m, a, b, c) => `${a.toLowerCase()}.${b}.${c.toLowerCase()}`).replace(/^([^.]+)\.([^.]+)$/, (m, a, b) => `${a.toLowerCase()}.${b.toLowerCase()}`);
    if (!/^[a-z][\w-]*\.(.+\.)?[a-z][\w-]*$/i.test(key)) fail(`error: key does not contain a section: ${rawKey}`, 1);
    if (o.unset) { delete store[key]; return 0; }
    if (!value.length || o.get) {
      const found = o.global ? this.global[key] : this.config(repo, key);
      if (found === undefined) return 1;
      out.put(found);
      return 0;
    }
    store[key] = value.join(' ');
    return 0;
  },
};

function validateBranch(name) {
  if (!name || /[\s~^:?*[\\]|\.\.|^[-/.]|[/.]$|@\{|\.lock$/.test(name)) fail(`fatal: '${name}' is not a valid branch name\nhint: See 'git help check-ref-format'\nhint: Disable this message with "git config set advice.refSyntax false"`);
}

/* ----- 需要 World 内部状态的较长流程 ----- */

World.prototype.printUnstaged = function (out, dir) {
  const s = statusOf(dir);
  const listed = s.unstaged.filter(f => !s.untracked.includes(f.path));
  if (!listed.length) return;
  out.put('Unstaged changes after reset:');
  for (const f of listed) out.put(`${f.kind === 'deleted' ? 'D' : 'M'}\t${f.path}`);
};

World.prototype.switchTo = function (o, out, word) {
  const dir = this.dir, repo = dir.repo;
  const current = headBranch(repo), oldId = headId(repo);
  const finish = (targetId, ref, message, { label, quiet = false } = {}) => {
    const carried = this.checkoutTree(dir, targetId);
    if (!quiet) for (const line of carried) out.put(line);
    if (!repo.head.ref && oldId && oldId !== targetId) {
      // 与 Git 相同：从旧 HEAD 出发，所有引用和新 HEAD 都够不着的提交就是“丢下”的
      const reachable = ancestors(repo, [...repo.refs.values(), targetId]);
      const lost = dateOrder(repo, [oldId]).filter(c => !reachable.has(c.id));
      if (lost.length) out.text(`Warning: you are leaving ${plural(lost.length, 'commit')} behind, not connected to\nany of your branches:\n\n${lost.slice(0, 4).map(c => `  ${short(c.id)} ${subject(c.message)}`).join('\n')}\n\nIf you want to keep ${lost.length === 1 ? 'it' : 'them'} by creating a new branch, this may be a good time\nto do so with:\n\n git branch <new-branch-name> ${short(oldId)}\n`, 'warn');
      else out.put(`Previous HEAD position was ${short(oldId)} ${subject(repo.objects.get(oldId).message)}`);
    }
    repo.head = ref ? { ref } : { id: targetId };
    repo.reflog.push({ id: targetId, msg: `checkout: moving from ${current ?? oldId ?? 'HEAD'} to ${ref ? ref.slice(11) : label ?? targetId}` });
    out.put(message);
  };
  const create = o.c || o.C;
  if (create) {
    validateBranch(create);
    if (repo.refs.has(`refs/heads/${create}`) && !o.C) fail(`fatal: a branch named '${create}' already exists`);
    const start = o._[0];
    const id = start ? this.must(repo, start, `fatal: invalid reference: ${start}`) : oldId;
    if (!id) {
      if (repo.unmerged.size) fail('error: you need to resolve your current index first');
      repo.head = { ref: `refs/heads/${create}` };
      out.put(`Switched to a new branch '${create}'`);
      return 0;
    }
    repo.refs.set(`refs/heads/${create}`, id);
    // 在当前提交上开新分支时 Git 不动工作区，也不列出本地修改
    try { finish(id, `refs/heads/${create}`, `Switched to a new branch '${create}'`, { quiet: id === oldId }); }
    catch (error) { repo.refs.delete(`refs/heads/${create}`); throw error; }
    if (start && repo.refs.has(`refs/remotes/${start}`)) {
      const [remote, ...rest] = start.split('/');
      this.setUpstream(repo, create, remote, rest.join('/'));
      out.put(`branch '${create}' set up to track '${start}'.`);
    }
    return 0;
  }
  let name = o._[0];
  if (!name) fail(word === 'switch' ? 'fatal: missing branch or commit argument' : 'fatal: you must specify path(s) to restore');
  if (name === '-') {
    name = previousCheckout(repo);
    if (!name) fail('fatal: invalid reference: @{-1}');
  }
  if (o.d) {
    const id = this.must(repo, name, `fatal: invalid reference: ${name}`);
    finish(id, null, `HEAD is now at ${short(id)} ${subject(repo.objects.get(id).message)}`, { label: name });
    return 0;
  }
  if (repo.refs.has(`refs/heads/${name}`)) {
    if (name === current) { out.put(`Already on '${name}'`); const t = this.tracking(repo, name); if (t && !t.gone) this.printTrackingShort(out, t); return 0; }
    finish(repo.refs.get(`refs/heads/${name}`), `refs/heads/${name}`, `Switched to branch '${name}'`);
    const t = this.tracking(repo, name);
    if (t && !t.gone) this.printTrackingShort(out, t);
    return 0;
  }
  if (!oldId && name === current) { out.put(`Already on '${name}'`); return 0; }
  const remoteRef = [...repo.refs.keys()].find(r => r.startsWith('refs/remotes/') && r.split('/').slice(3).join('/') === name);
  if (remoteRef) {
    const id = repo.refs.get(remoteRef), remote = remoteRef.split('/')[2];
    repo.refs.set(`refs/heads/${name}`, id);
    try { finish(id, `refs/heads/${name}`, `Switched to a new branch '${name}'`); }
    catch (error) { repo.refs.delete(`refs/heads/${name}`); throw error; }
    this.setUpstream(repo, name, remote, name);
    out.put(`branch '${name}' set up to track '${remote}/${name}'.`);
    return 0;
  }
  const id = this.resolve(repo, name);
  if (id && o.checkoutStyle) {
    out.put(`Note: switching to '${name}'.`);
    out.put('');
    out.text(DETACHED_ADVICE, 'hint');
    finish(id, null, `HEAD is now at ${short(id)} ${subject(repo.objects.get(id).message)}`, { label: name });
    return 0;
  }
  if (id) fail(`fatal: a branch is expected, got commit '${name}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.`);
  fail(word === 'switch' ? `fatal: invalid reference: ${name}` : `error: pathspec '${name}' did not match any file(s) known to git`, word === 'switch' ? 128 : 1);
};

/** `git switch -` 的目标：reflog 里最近一次 checkout 的出发点。 */
function previousCheckout(repo) {
  for (let i = repo.reflog.length - 1; i >= 0; i--) {
    const m = repo.reflog[i].msg.match(/^checkout: moving from (.+) to .+$/);
    if (m) return m[1];
  }
  return null;
}

/** 分离 HEAD 的描述，规则同 wt-status.c：看最近一次 checkout 去了哪里、HEAD 还在不在那里。 */
export function detachedInfo(repo) {
  for (let i = repo.reflog.length - 1; i >= 0; i--) {
    const m = repo.reflog[i].msg.match(/^checkout: moving from .+ to (.+)$/);
    if (!m) continue;
    const target = m[1], id = repo.reflog[i].id;
    const named = [`refs/remotes/${target}`, `refs/tags/${target}`].some(ref => repo.refs.get(ref) === id);
    return { from: named ? target : short(id), at: headId(repo) === id };
  }
  return { from: short(headId(repo)), at: true };
}

World.prototype.printTrackingShort = function (out, t) {
  if (!t.ahead && !t.behind) out.put(`Your branch is up to date with '${t.name}'.`);
  else if (!t.behind) out.text(`Your branch is ahead of '${t.name}' by ${plural(t.ahead, 'commit')}.\n  (use "git push" to publish your local commits)`);
  else if (!t.ahead) out.text(`Your branch is behind '${t.name}' by ${plural(t.behind, 'commit')}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)`);
  else out.text(`Your branch and '${t.name}' have diverged,\nand have ${t.ahead} and ${t.behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)`);
};

/** merge 与 pull 共用：快进、已是最新，或三方合并（干净则直接生成合并提交）。 */
World.prototype.mergeCommitish = function (dir, theirs, { name, msg, noFf, ffOnly, labelTheirs, reflog }, out) {
  const repo = dir.repo, ours = headId(repo);
  const verb = reflog ?? `merge ${name}`;
  if (!ours) {
    this.checkoutTree(dir, theirs, 'merge');
    this.moveHead(repo, theirs, `${verb}: Fast-forward`);
    return 0;
  }
  if (isAncestor(repo, theirs, ours)) { out.put('Already up to date.'); return 0; }
  if (isAncestor(repo, ours, theirs) && !noFf) {
    const before = treeOf(repo, ours);
    out.put(`Updating ${short(ours)}..${short(theirs)}`);
    this.checkoutTree(dir, theirs, 'merge');
    this.moveHead(repo, theirs, `${verb}: Fast-forward`);
    out.put('Fast-forward');
    this.printStat(out, before, treeOf(repo, theirs));
    return 0;
  }
  if (ffOnly) fail('fatal: Not possible to fast-forward, aborting.');
  const base = mergeBase(repo, ours, theirs);
  const oursTree = treeOf(repo, ours);
  const result = this.mergeTrees(treeOf(repo, base), oursTree, treeOf(repo, theirs), { ours: 'HEAD', theirs: typeof labelTheirs === 'string' ? labelTheirs : name });
  const touched = keys(oursTree, result.tree).filter(p => oursTree[p] !== result.tree[p] || result.conflicts.some(c => c.path === p));
  this.guardMerge(dir, touched);
  this.applyMerge(dir, result, touched);
  if (result.conflicts.length) {
    repo.op = { type: 'merge', heads: [theirs], msg: msg + '\n', orig: ours, touched };
    out.git(result.messages.join('\n'));
    out.put('Automatic merge failed; fix conflicts and then commit the result.');
    return 1;
  }
  for (const m of result.messages) out.put(m);
  const who = this.ident(repo);
  const commit = this.makeCommit(repo, { tree: { ...repo.index }, parents: [ours, theirs], author: who, committer: who, message: cleanMessage(msg) });
  this.moveHead(repo, commit.id, `${verb}: Merge made by the 'ort' strategy.`);
  out.put("Merge made by the 'ort' strategy.");
  this.printStat(out, oursTree, commit.tree);
  return 0;
};

/** UI 画提交图用：按 --graph 的顺序和列，附带每个提交上的引用；ghosts 为只剩 reflog 记得的提交。 */
export function graphModel(repo, { ghosts = false } = {}) {
  const tips = [...repo.refs.values(), headId(repo)].filter(Boolean);
  const reachable = ancestors(repo, tips);
  const starts = [...tips];
  if (ghosts) for (const entry of repo.reflog) if (!reachable.has(entry.id) && repo.objects.has(entry.id)) starts.push(entry.id);
  const order = topoOrder(repo, [...new Set(starts)]);
  return graphRows(order).map(row => ({ ...row, ghost: !reachable.has(row.commit.id), refs: decorations(repo, row.commit.id) }));
}
