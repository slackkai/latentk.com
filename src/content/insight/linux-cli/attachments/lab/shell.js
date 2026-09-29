/**
 * 迷你 shell：解析一行命令，分发给内置命令。
 * 支持引号、> >> 重定向、&& / ||，以及本课使用的文本管道。
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
    } else if (token.op) {
      if (token.op === '&') fail('（沙盒不支持后台进程 &）', 2);
      if (!current.words.length && !current.redirect) fail(`bash: syntax error near unexpected token '${token.op}'`, 2);
      commands.push(current);
      current = { words: [], redirect: null, after: token.op };
    } else current.words.push(token);
  }
  if (current.words.length || current.redirect) commands.push(current);
  else if (current.after && current.after !== ';') fail('bash: syntax error: incomplete command', 2);
  return { commands, smart };
}

const fail = (message, code = 1) => { throw new Fail(message, code); };

export class Out {
  constructor(input = null, piped = false) {
    this.lines = []; this.notes = []; this.actions = [];
    this.input = input; this.piped = piped; this.stdout = '';
  }
  put(...segs) {
    const parts = segs.map(s => (Array.isArray(s) ? s : [String(s), '']));
    this.lines.push(parts);
    this.stdout += parts.map(([t]) => t).join('') + '\n';
  }
  write(text) {
    this.stdout += text;
    for (const line of linesOf(text)) this.lines.push([[line, '']]);
  }
  text(text) { for (const line of String(text).split('\n')) this.put(line); }
  note(text) { this.notes.push(text); }
  err(text) { for (const line of String(text).split('\n')) this.lines.push([[line, 'err']]); }
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
  权限  chmod 644 文件   chmod u+x 文件
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
  chmod: 'chmod — 改权限\n  chmod 644 文件    数字：属主 rw、同组 r、其他人 r\n  chmod u+x 文件     给属主加上可执行\n  chmod u-w 文件     去掉属主的写权限\n九个字符从左到右是：属主、同组、其他人，各三位 rwx。',
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
    if (nl) out.put(text); else out.write(text);
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
    if (out.piped || flags.has('1')) { for (const name of names) out.put(name); return; }
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
    if (!args.length) {
      if (out.input === null) fail('cat: 后面跟文件名，或通过管道提供输入');
      out.write(out.input);
      return;
    }
    let status = 0;
    for (const name of args) {
      try { out.write(readText(world, name)); }
      catch (error) {
        if (!(error instanceof Fail)) throw error;
        out.err(error.message);
        status = error.code;
      }
    }
    return status;
  },
  head(world, args, out) { slice(world, args, out, 'head'); },
  tail(world, args, out) { slice(world, args, out, 'tail'); },
  wc(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const name = rest[0];
    const content = name ? readText(world, name) : out.input;
    if (content === null) fail('wc: 后面跟文件名，或通过管道提供输入');
    const lines = (content.match(/\n/g) ?? []).length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const bytes = new TextEncoder().encode(content).length;
    const cols = [];
    if (!flags.size || flags.has('l')) cols.push(String(lines).padStart(7));
    if (!flags.size || flags.has('w')) cols.push(String(words).padStart(7));
    if (!flags.size || flags.has('c')) cols.push(String(bytes).padStart(7));
    out.put(`${cols.join('')}${name ? ` ${name}` : ''}`);
  },
  cp(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const [from, to] = rest;
    if (!from || !to) fail('cp: missing file operand');
    const src = world.at(from);
    if (src.node.kind === 'dir' && !flags.has('r')) fail(`cp: -r not specified; omitting directory '${from}'`);
    let dest = world.resolve(to);
    if (dest.node?.kind === 'dir') dest = world.resolve(`${to.replace(/\/$/, '')}/${src.name}`);
    else if (to.endsWith('/')) fail(`cp: ${to}: Not a directory`);
    if (!dest.parent || dest.node?.kind === 'dir') fail('cp: 沙盒不支持覆盖目录树');
    if (src.parent === dest.parent && src.name === dest.name) fail('cp: 来源和目标是同一个文件');
    if (!(dest.node ? can(dest.node, 'w') : can(dest.parent, 'w'))) fail(`cp: ${to}: Permission denied`);
    if (src.node.kind === 'dir') dest.parent.children[dest.name] = clone(src.node);
    else dest.parent.children[dest.name] = file(readText(world, from), src.node.mode);
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
    if (!spec || !name) fail('chmod: 用法是 chmod 644 文件 或 chmod u+x 文件');
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
    const who = m[1] || 'a';
    const indexes = [];
    if (who.includes('u') || who.includes('a')) indexes.push(0);
    if (who.includes('g') || who.includes('a')) indexes.push(3);
    if (who.includes('o') || who.includes('a')) indexes.push(6);
    const chars = hit.node.mode.split('');
    for (const start of indexes) for (const bit of m[3]) {
      // 省略身份时按沙盒固定的 umask 022 过滤；显式 u/g/o/a 不过滤。
      if (!m[1] && ((0o022 >> (6 - start)) & ({ r: 4, w: 2, x: 1 }[bit]))) continue;
      const pos = start + (bit === 'r' ? 0 : bit === 'w' ? 1 : 2);
      chars[pos] = m[2] === '+' ? bit : '-';
    }
    hit.node.mode = chars.join('');
  },
  grep(world, args, out) {
    const { flags, rest } = FLAGS(args);
    const [needle, name] = rest;
    if (needle === undefined) fail('grep: 用法是 grep 词 文件，或通过管道提供输入', 2);
    const content = name ? readText(world, name) : out.input;
    if (content === null) fail('grep: 后面跟文件名，或通过管道提供输入', 2);
    const want = flags.has('i') ? needle.toLowerCase() : needle;
    let n = 0;
    linesOf(content).forEach((line, i) => {
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

function readText(world, name) {
  const hit = world.at(name);
  if (hit.node.kind !== 'file') fail(`${name}: 沙盒只支持读取普通文件`);
  if (!can(hit.node, 'r')) fail(`${name}: Permission denied`);
  return hit.node.content;
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
  if (!Number.isInteger(n) || n < 0) fail(`${side}: 行数必须是非负整数`);
  const content = name ? readText(world, name) : out.input;
  if (content === null) fail(`${side}: 后面跟文件名，或通过管道提供输入`);
  const lines = content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const picked = n === 0 ? [] : side === 'head' ? lines.slice(0, n) : lines.slice(-n);
  out.write(picked.join(''));
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
    for (let i = 0; i < commands.length;) {
      const first = commands[i];
      let end = i + 1;
      while (end < commands.length && commands[end].after === '|') end++;
      const skip = (first.after === '&&' && status !== 0) || (first.after === '||' && status === 0);
      if (!skip) {
        let input = null;
        for (let j = i; j < end; j++) {
          const result = exec(world, commands[j], out, input, j + 1 < end);
          status = result.status;
          input = result.stdout;
        }
      }
      i = end;
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

function exec(world, command, out, input, piped) {
  const argv = expand(world, command.words);
  const redirected = !!command.redirect;
  const target = new Out(input, piped || redirected);
  let status = 0;
  try {
    // Shell 先打开（可能清空）目标，再执行命令；标准错误不进入重定向或管道。
    if (redirected) world.writeFile(command.redirect.file, '', { append: command.redirect.append });
    status = dispatch(world, argv, target) ?? 0;
    if (redirected) world.writeFile(command.redirect.file, target.stdout, { append: true });
  } catch (error) {
    if (!(error instanceof Fail)) throw error;
    target.err(error.message);
    status = error.code;
  }
  out.lines.push(...target.lines.filter(segs => (!piped && !redirected) || segs.some(([, cls]) => cls === 'err')));
  if (!piped && !redirected) out.stdout += target.stdout;
  out.notes.push(...target.notes);
  out.actions.push(...target.actions);
  return { status, stdout: redirected ? '' : target.stdout };
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
