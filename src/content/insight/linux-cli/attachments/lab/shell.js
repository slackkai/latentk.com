/**
 * 迷你 shell：解析一行命令，分发给内置命令。
 * 支持引号、> >> 重定向、&&，不支持管道——管道在正文里讲概念，沙盒里拆开做。
 */
import { Fail, can, linesOf, modeNum, file, dir, link, HOME } from './fs.js';

const QUOTES = { '"': '"', "'": "'", '“': '”', '”': '”', '‘': '’', '’': '’' };

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
        if (j >= line.length) fail(`bash: unexpected EOF while looking for matching \`${c}'\n（引号没有配对）`, 2);
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
    } else if (token.op === '|') fail('（沙盒不支持管道 |。管道的意思是「左边的输出变成右边的输入」，这里请把两步分开做）', 1);
    else if (token.op) {
      if (current.words.length) commands.push(current);
      current = { words: [], redirect: null, after: token.op === '&' ? ';' : token.op };
    } else current.words.push(token);
  }
  if (current.words.length || current.redirect) commands.push(current);
  return { commands, smart };
}

const fail = (message, code = 1) => { throw new Fail(message, code); };

export class Out {
  constructor() { this.lines = []; this.notes = []; this.actions = []; }
  put(...segs) { this.lines.push(segs.map(s => (Array.isArray(s) ? s : [s, '']))); }
  text(text) { for (const line of String(text).split('\n')) this.put(line); }
  note(text) { this.notes.push(text); }
  err(text) { for (const line of String(text).split('\n')) this.put([line, 'err']); }
  plain() { return this.lines.map(segs => segs.map(([t]) => t).join('')).join('\n'); }
}

const FLAGS = args => {
  const flags = new Set();
  const rest = [];
  for (const a of args) {
    if (a === '--') { rest.push(...args.slice(args.indexOf(a) + 1)); break; }
    if (/^-\w/.test(a)) [...a.slice(1)].forEach(c => flags.add(c));
    else rest.push(a);
  }
  return { flags, rest };
};

const HELP = `这个沙盒里可以用的命令：
  看    pwd  ls  ls -l  ls -a  tree  cat  head  tail  wc  file
  走    cd  mkdir  touch  cp  mv  rm
  写    echo "文字" > 文件   echo "文字" >> 文件   edit 文件
  找    find  grep
  权限  chmod 644 文件   chmod +x 文件
  其他  which  man  clear  help
↑ ↓ 翻看历史命令，Tab 补全命令和文件名。`;

const MAN = {
  ls: 'ls — 列出目录里的名字\n  ls        只列名字\n  ls -l     长格式：权限、大小、名字\n  ls -a     连隐藏文件（以 . 开头）也列出来\n  ls -la    两个选项叠在一起',
  cd: 'cd — 换一个当前目录\n  cd 笔记     走进「笔记」\n  cd ..       回到上一级\n  cd          回到家目录 ~\n  cd -        回到上一次所在的目录',
  pwd: 'pwd — 印出当前目录的完整路径（print working directory）',
  cat: 'cat — 把文件内容从头到尾印出来\n  cat 文件\n  cat 甲 乙   按顺序拼在一起印',
  mkdir: 'mkdir — 新建目录\n  mkdir 名字\n  mkdir -p a/b   中间缺的层级一并建出来',
  rm: 'rm — 删除\n  rm 文件\n  rm -r 目录   目录必须加 -r，因为它里面可能还有东西',
  cp: 'cp — 复制\n  cp 来源 目标\n  cp -r 目录 目标',
  mv: 'mv — 移动，也用来改名\n  mv 旧名 新名\n  mv 文件 目录/',
  chmod: 'chmod — 改权限\n  chmod 644 文件    数字：属主 rw、同组 r、其他人 r\n  chmod +x 文件     给属主加上可执行\n  chmod -w 文件     去掉属主的写权限\n九个字符从左到右是：属主、同组、其他人，各三位 rwx。',
  grep: 'grep — 在文件里找含某个词的行\n  grep 词 文件\n  grep -n 词 文件   行号也印出来\n  grep -i 词 文件   忽略大小写',
  find: 'find — 按名字找文件\n  find . -name "*.md"\n  find 笔记 -name "todo*"',
  echo: 'echo — 印出文字。配合 > 和 >> 就变成写文件\n  echo "一行" > 文件     覆盖写\n  echo "又一行" >> 文件  追加到末尾',
};

function longLine(name, node) {
  const kind = node.kind === 'dir' ? 'd' : node.kind === 'link' ? 'l' : '-';
  const size = node.kind === 'file' ? String(node.content.length).padStart(5) : '    -';
  const shown = node.kind === 'link' ? `${name} -> ${node.target}` : name;
  return `${kind}${node.mode}  ${size}  ${shown}`;
}

export const COMMANDS = {
  echo(world, args, out) {
    let nl = true, list = args;
    if (list[0] === '-n') { nl = false; list = list.slice(1); }
    const text = list.join(' ');
    if (nl) out.put(text); else out.lines.push([[text, '']]);
  },
  pwd(world, args, out) { out.put(world.cwd.length ? `${HOME}/${world.cwd.join('/')}` : HOME); },
  ls(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const target = rest[0] ?? '.';
    const hit = world.at(target);
    const node = hit.node;
    if (node.kind === 'link') { out.put(longLine(hit.name, node)); return; }
    if (node.kind === 'file') { out.put(flags.has('l') ? longLine(hit.name || target, node) : (hit.name || target)); return; }
    if (!can(node, 'r')) fail(`ls: cannot open directory '${target}': Permission denied`);
    let names = world.list(node);
    if (flags.has('a')) names = ['.', '..', ...names];
    else names = names.filter(n => !n.startsWith('.'));
    if (!names.length) return;
    if (flags.has('l')) { for (const name of names) out.put([longLine(name, name === '.' || name === '..' ? node : node.children[name]), clsOf(name === '.' || name === '..' ? node : node.children[name])]); return; }
    out.put(...names.flatMap((name, i) => {
      const child = name === '.' || name === '..' ? node : node.children[name];
      return i ? [['  ', ''], [name, clsOf(child)]] : [[name, clsOf(child)]];
    }));
  },
  tree(world, args, out) {
    const root = world.at(args[0] ?? '.').node;
    if (root.kind !== 'dir') { out.put(args[0] ?? '.'); return; }
    const walk = (folder, prefix) => {
      const names = world.list(folder).filter(n => !n.startsWith('.'));
      names.forEach((name, i) => {
        const last = i === names.length - 1;
        const child = folder.children[name];
        out.put(`${prefix}${last ? '└── ' : '├── '}${name}${child.kind === 'dir' ? '/' : ''}`);
        if (child.kind === 'dir') walk(child, prefix + (last ? '    ' : '│   '));
      });
    };
    out.put(args[0] ?? '.');
    walk(root, '');
  },
  cd(world, args, out) {
    const to = args[0];
    if (to === '-') {
      if (!world.prev) { out.err('bash: cd: OLDPWD not set'); return 1; }
      [world.cwd, world.prev] = [world.prev, [...world.cwd]];
      out.put(world.where());
      return;
    }
    const segs = fullSegs(world, to ?? '~');
    const hit = world.at(to ?? '~');
    if (hit.node.kind !== 'dir') fail(`bash: cd: ${to}: Not a directory`);
    if (!can(hit.node, 'x')) fail(`bash: cd: ${to}: Permission denied`);
    world.prev = [...world.cwd];
    world.cwd = segs;
  },
  mkdir(world, args) {
    const { flags, rest } = FLAGS(args);
    if (!rest.length) fail('mkdir: missing operand');
    for (const name of rest) {
      if (!flags.has('p')) {
        if (name.includes('/')) fail(`mkdir: cannot create directory '${name}': No such file or directory\n（中间的目录还不存在。加上 -p 可以一次建完）`);
        const parent = world.here();
        if (parent.children[name]) fail(`mkdir: cannot create directory '${name}': File exists`);
        if (!can(parent, 'w')) fail(`mkdir: cannot create directory '${name}': Permission denied`);
        parent.children[name] = dir();
        continue;
      }
      const bits = name.replace(/^~\/?/, '').replace(/^\//, '').split('/').filter(Boolean);
      let at = name.startsWith('/') || name.startsWith('~') ? world.tree : world.here();
      for (const bit of bits) {
        if (!at.children[bit]) at.children[bit] = dir();
        else if (at.children[bit].kind !== 'dir') fail(`mkdir: cannot create directory '${name}': File exists`);
        at = at.children[bit];
      }
    }
  },
  touch(world, args) {
    for (const name of args) {
      const hit = world.resolve(name);
      if (!hit.node) hit.parent.children[hit.name] = file('');
    }
  },
  cat(world, args, out) {
    if (!args.length) fail('cat: 后面跟文件名，例如 cat 备忘.md');
    for (const name of args) {
      const hit = world.at(name);
      if (hit.node.kind === 'dir') fail(`cat: ${name}: Is a directory`);
      if (hit.node.kind === 'link') { out.note(`（${name} 是指向 ${hit.node.target} 的链接，cat 读的是它本身，不是目标）`); continue; }
      if (!can(hit.node, 'r')) fail(`cat: ${name}: Permission denied`);
      for (const line of linesOf(hit.node.content)) out.put(line);
    }
  },
  head(world, args, out) { slice(world, args, out, 'head'); },
  tail(world, args, out) { slice(world, args, out, 'tail'); },
  wc(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const name = rest[0];
    if (!name) fail('wc: 后面跟文件名');
    const hit = world.at(name);
    if (hit.node.kind !== 'file') fail(`wc: ${name}: Is a directory`);
    const lines = linesOf(hit.node.content);
    const words = hit.node.content.trim() ? hit.node.content.trim().split(/\s+/).length : 0;
    const bytes = hit.node.content.length;
    const cols = [];
    if (!flags.size || flags.has('l')) cols.push(String(lines.length).padStart(7));
    if (!flags.size || flags.has('w')) cols.push(String(words).padStart(7));
    if (!flags.size || flags.has('c')) cols.push(String(bytes).padStart(7));
    out.put(`${cols.join('')} ${name}`);
  },
  cp(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const [from, to] = rest;
    if (!from || !to) fail('cp: missing file operand');
    const src = world.at(from);
    if (src.node.kind === 'dir' && !flags.has('r')) fail(`cp: -r not specified; omitting directory '${from}'`);
    const dest = world.resolve(to.endsWith('/') ? `${to}${src.name}` : to);
    if (src.node.kind === 'dir') dest.parent.children[dest.name] = clone(src.node);
    else dest.parent.children[dest.name] = file(src.node.content, src.node.mode);
  },
  mv(world, args, out) {
    const [from, to] = args;
    if (!from || !to) fail('mv: missing file operand');
    const src = world.at(from);
    const dest = world.resolve(to.endsWith('/') ? `${to}${src.name}` : to);
    if (dest.node?.kind === 'dir') { dest.node.children[src.name] = src.node; delete src.parent.children[src.name]; return; }
    dest.parent.children[dest.name] = src.node;
    delete src.parent.children[src.name];
  },
  rm(world, args, out) {
    const { flags, rest } = FLAGS(args);
    if (!rest.length) fail('rm: missing operand');
    let status = 0;
    for (const name of rest) {
      const hit = world.resolve(name);
      if (!hit.node) { out.err(`rm: cannot remove '${name}': No such file or directory`); status = 1; continue; }
      if (hit.node.kind === 'dir' && !flags.has('r')) { out.err(`rm: cannot remove '${name}': Is a directory`); status = 1; continue; }
      delete hit.parent.children[hit.name];
    }
    return status;
  },
  chmod(world, args, out) {
    const [spec, name] = args;
    if (!spec || !name) fail('chmod: 用法是 chmod 644 文件 或 chmod +x 文件');
    const hit = world.at(name);
    if (/^[0-7]{3}$/.test(spec)) {
      hit.node.mode = [...spec].map(d => {
        const n = Number(d);
        return `${n & 4 ? 'r' : '-'}${n & 2 ? 'w' : '-'}${n & 1 ? 'x' : '-'}`;
      }).join('');
      return;
    }
    const m = spec.match(/^([ugoa]*)([+-])([rwx]+)$/);
    if (!m) fail(`chmod: invalid mode: '${spec}'`);
    const who = m[1] || 'u';
    const indexes = [];
    if (who.includes('u') || who.includes('a')) indexes.push(0);
    if (who.includes('g') || who.includes('a')) indexes.push(3);
    if (who.includes('o') || who.includes('a')) indexes.push(6);
    const chars = hit.node.mode.split('');
    for (const start of indexes) for (const bit of m[3]) {
      const pos = start + (bit === 'r' ? 0 : bit === 'w' ? 1 : 2);
      chars[pos] = m[2] === '+' ? bit : '-';
    }
    hit.node.mode = chars.join('');
  },
  grep(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const [needle, name] = rest;
    if (!needle || !name) fail('grep: 用法是 grep 词 文件');
    const hit = world.at(name);
    if (hit.node.kind !== 'file') fail(`grep: ${name}: Is a directory`);
    const want = flags.has('i') ? needle.toLowerCase() : needle;
    let n = 0;
    linesOf(hit.node.content).forEach((line, i) => {
      const hay = flags.has('i') ? line.toLowerCase() : line;
      if (!hay.includes(want)) return;
      n++;
      out.put(`${flags.has('n') ? `${i + 1}:` : ''}${line}`);
    });
    return n ? 0 : 1;
  },
  find(world, args, out) {
    let root = '.';
    let pattern = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name') pattern = args[++i];
      else if (!args[i].startsWith('-')) root = args[i];
    }
    if (!pattern) fail('find: 用法是 find . -name "*.md"');
    const re = new RegExp('^' + pattern.split('').map(c => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
    const start = world.at(root).node;
    const walk = (folder, prefix) => {
      for (const name of world.list(folder)) {
        const child = folder.children[name];
        const rel = prefix ? `${prefix}/${name}` : name;
        if (re.test(name)) out.put(root === '.' ? `./${rel}` : `${root.replace(/\/$/, '')}/${rel}`);
        if (child.kind === 'dir') walk(child, rel);
      }
    };
    if (start.kind !== 'dir') { if (re.test(root)) out.put(root); return; }
    walk(start, '');
  },
  file(world, args, out) {
    for (const name of args) {
      const hit = world.at(name);
      const kind = hit.node.kind === 'dir' ? 'directory' : hit.node.kind === 'link' ? `symbolic link to ${hit.node.target}` : hit.node.content.includes('\0') ? 'data' : 'Unicode text';
      out.put(`${name}: ${kind}`);
    }
  },
  which(world, args, out) {
    const name = args[0];
    if (!name) fail('which: missing operand');
    if (COMMANDS[name]) out.put(`/usr/bin/${name}`);
    else { out.err(`${name} not found`); return 1; }
  },
  man(world, args, out) {
    const name = args[0];
    if (!name) fail('man: 后面跟命令名，例如 man ls');
    out.text(MAN[name] ?? `没有 ${name} 的手册页。这个沙盒只为讲过的命令准备了 man。`);
  },
  ln(world, args, out) {
    const { flags, rest } = FLAGS(args);
    if (!flags.has('s')) fail('ln: 沙盒只做符号链接，请加 -s');
    const [target, name] = rest;
    if (!target || !name) fail('ln: 用法是 ln -s 目标 链接名');
    const hit = world.resolve(name);
    if (hit.node) fail(`ln: failed to create symbolic link '${name}': File exists`);
    hit.parent.children[hit.name] = link(target);
  },
  clear(world, args, out) { out.actions.push({ type: 'clear' }); },
  help(world, args, out) { out.text(HELP); },
  edit(world, args, out) {
    const name = args.find(a => !a.startsWith('-'));
    if (!name) fail('edit: 用法是 edit 文件名');
    world.resolve(name);
    out.actions.push({ type: 'edit', path: name });
  },
};

function clsOf(node) {
  if (!node) return '';
  if (node.kind === 'dir') return 'dir';
  if (node.kind === 'link') return 'link';
  if (can(node, 'x') && node.kind === 'file') return 'exec';
  return '';
}

function fullSegs(world, input) {
  const raw = input === undefined || input === '' || input === '~' ? '~' : input;
  const abs = raw === '~' || raw.startsWith('~/') || raw.startsWith('/') ? raw.replace(/^~/, HOME) : null;
  const base = (abs ?? `${HOME}/${world.cwd.join('/')}/${raw}`).split('/');
  const stack = [];
  for (const part of base) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  const home = HOME.split('/').filter(Boolean);
  return stack.slice(home.length);
}

function clone(node) {
  if (node.kind === 'file') return file(node.content, node.mode);
  if (node.kind === 'link') return link(node.target);
  const children = {};
  for (const [k, v] of Object.entries(node.children)) children[k] = clone(v);
  return dir(children, node.mode);
}

function slice(world, args, out, side) {
  let n = 10;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n') n = Number(args[++i]);
    else if (/^-\d+$/.test(args[i])) n = Number(args[i].slice(1));
    else rest.push(args[i]);
  }
  const name = rest[0];
  if (!name) fail(`${side}: 后面跟文件名`);
  const hit = world.at(name);
  if (hit.node.kind !== 'file') fail(`${side}: ${name}: Is a directory`);
  const lines = linesOf(hit.node.content);
  const picked = side === 'head' ? lines.slice(0, n) : lines.slice(-n);
  for (const line of picked) out.put(line);
}

export function expand(world, words) {
  const here = world.here();
  const names = world.list(here);
  return words.flatMap(({ word, glob }) => {
    if (!glob) return [word];
    const re = new RegExp('^' + word.split('').map(c => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
    const hits = names.filter(n => re.test(n) && !n.startsWith('.'));
    return hits.length ? hits : [word];
  });
}

export function runLine(world, line) {
  const out = new Out();
  let status = 0;
  try {
    const { commands, smart } = parseLine(line.trim());
    if (smart) out.note('（提示：真终端只认英文引号。沙盒这次替你当成引号处理了）');
    for (const command of commands) {
      if (command.after === '&&' && status !== 0) continue;
      if (command.after === '||' && status === 0) continue;
      status = exec(world, command, out);
    }
  } catch (error) {
    if (!(error instanceof Fail)) throw error;
    out.err(error.message);
    status = error.code;
  }
  out.status = status;
  world.events.push({ line, status });
  return out;
}

function exec(world, command, out) {
  const argv = expand(world, command.words);
  const target = command.redirect ? new Out() : out;
  let status = 0;
  try {
    status = dispatch(world, argv, target) ?? 0;
  } catch (error) {
    if (!(error instanceof Fail)) throw error;
    target.err(error.message);
    status = error.code;
  }
  if (command.redirect) {
    const text = target.lines.map(segs => segs.map(([t]) => t).join('')).join('\n');
    const body = target.lines.length ? text + '\n' : '';
    world.writeFile(command.redirect.file, body, { append: command.redirect.append });
    out.actions.push(...target.actions);
  }
  return status;
}

function dispatch(world, argv, out) {
  const [cmd, ...args] = argv;
  if (!cmd) return 0;
  const handler = COMMANDS[cmd];
  if (!handler) {
    out.err(`bash: ${cmd}: command not found`);
    const near = Object.keys(COMMANDS).filter(n => n.startsWith(cmd[0]) && n.length <= cmd.length + 2);
    if (near.length) out.note(`（也许你想敲的是 ${near.slice(0, 3).join(' / ')}？输入 help 看全部）`);
    return 127;
  }
  const status = handler(world, args, out) ?? 0;
  world.events.push({ sh: cmd, args, status });
  return status;
}

export { modeNum, can };
