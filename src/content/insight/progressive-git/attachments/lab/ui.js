/**
 * 沙盒界面：上面是三个区域 / 提交图 / 远程的实时图，中间是逐步任务，下面是终端。
 * 每一课的 index.html 只写一份配置交给 mount()：初始状态、要显示哪些图、任务和检查条件。
 */
import { World, statusOf, headId, headBranch, treeOf, graphModel, ancestors, short } from './git.js';
import { lines, diff, subject } from './core.js';
import { borrowFonts, jumpToHeading, escapeHtml as esc } from './frame.js';

const SHELL_WORDS = ['git', 'ls', 'cat', 'echo', 'cd', 'mkdir', 'rm', 'touch', 'mv', 'cp', 'pwd', 'edit', 'clear', 'help'];
const GIT_WORDS = ['add', 'branch', 'checkout', 'cherry-pick', 'clone', 'commit', 'config', 'diff', 'fetch', 'init', 'log', 'merge', 'pull', 'push', 'rebase', 'reflog', 'remote', 'reset', 'restore', 'revert', 'rm', 'show', 'stash', 'status', 'switch'];
const MAX_LINES = 6;
const union = (...lists) => [...new Set(lists.flat())].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** 静默执行一串命令来准备场景；提交时间往前推，看起来像是之前做的。 */
export function script(world, commands, { step = 9 } = {}) {
  let t = Math.floor(Date.now() / 1000) - (commands.length + 2) * step * 60;
  const saved = world.clock;
  world.clock = () => t;
  for (const line of commands) {
    t += step * 60 + (line.length % 7) * 11;
    if (typeof line === 'function') { line(world); continue; }
    const result = world.run(line, { silent: true });
    if (result.status) console.warn('[sandbox setup]', line, '\n' + result.plain());
  }
  world.clock = saved;
  world.events.length = 0;
}

/* ---------------- 视图 ---------------- */

function bodyHtml(content, against, cls) {
  const now = lines(content ?? '');
  let rows;
  if (against === undefined || against === null) rows = now.map(text => [text, cls === 'plain' ? '' : cls]);
  else {
    const before = lines(against);
    rows = diff(before, now).map(([op, a, b]) => (op === '=' ? [now[b], ''] : op === '+' ? [now[b], cls] : [before[a], 'is-gone']));
  }
  if (!rows.length) return '<div class="cell-body"><div class="blank">（空文件）</div></div>';
  let shown = rows;
  if (rows.length > MAX_LINES) {
    const first = Math.max(0, rows.findIndex(r => r[1]) - 1);
    const start = Math.min(first, rows.length - (MAX_LINES - 1));
    shown = rows.slice(start, start + MAX_LINES - 1);
    shown.push([`… 共 ${rows.length} 行`, 'more']);
  }
  return `<div class="cell-body">${shown.map(([text, c]) => `<div class="${/^(<{7}|={7}$|>{7})/.test(text) ? 'is-marker' : c}">${esc(text) || '&nbsp;'}</div>`).join('')}</div>`;
}

function cell({ path, area, state = '', badge = '', badgeClass = '', body = '', editable = false, sig = '' }) {
  return `<div class="cell ${state}${editable ? ' is-editable' : ''}" data-key="${area}:${esc(path)}" data-sig="${esc(sig)}"${editable ? ` data-edit="${esc(path)}" title="点击编辑 ${esc(path)}"` : ''}>
    <div class="cell-name"><span>${esc(path)}</span>${badge ? `<span class="badge ${badgeClass}">${badge}</span>` : ''}</div>${body}</div>`;
}
const emptyCell = (area, path, text = '—') => `<div class="cell is-empty" data-key="${area}:${esc(path)}" data-sig="">${text}</div>`;

function refTags(refs, { hideHead = false, currentBranch = null } = {}) {
  return refs.map(r => {
    if (r.kind === 'head') {
      if (hideHead) return r.branch ? `<span class="ref">${esc(r.branch)}</span>` : '';
      return `<span class="ref head">HEAD</span>${r.branch ? `<span class="ref-arrow">→</span><span class="ref is-current">${esc(r.branch)}</span>` : ''}`;
    }
    return `<span class="ref ${r.kind === 'remote' ? 'remote' : ''}${r.name === currentBranch ? ' is-current' : ''}">${esc(r.name)}</span>`;
  }).join(' ');
}

function areasPanel(world, opts) {
  const dir = world.dir, repo = dir.repo;
  const compact = opts.compact;
  if (!world.cwd) {
    const entries = [...world.home.dirs.keys()].map(name => `<li class="file-chip is-dir">📁 ${esc(name)}</li>`).join('') +
      Object.keys(dir.files).map(name => `<li class="file-chip" data-edit="${esc(name)}">${esc(name)}</li>`).join('');
    return `<section class="panel"><p class="panel-title">你现在在 <b>~</b>（家目录），这里不是项目文件夹。</p>
      ${entries ? `<ul class="files">${entries}</ul>` : '<p class="empty">空空的。先 mkdir 一个练习文件夹，再 cd 进去。</p>'}</section>`;
  }
  const headLabel = !repo ? '还不是仓库' : !headId(repo) ? '还没有提交' : headBranch(repo) ? `HEAD → ${headBranch(repo)}` : 'HEAD（分离）';
  const heads = `
    <div class="area-head"><b>工作区</b><small>你正在改的文件</small></div>
    <div class="area-head"><b>暂存区</b><small>下一次提交会装进去的</small></div>
    <div class="area-head"><b>仓库</b><small>${esc(headLabel)}</small></div>`;
  const arrows = opts.arrows ?? ['add', 'commit'];
  const flow = compact ? '' : `<div class="flow" aria-hidden="true">
    ${arrows.includes('add') ? '<div class="arrow a1"><span>git add</span></div>' : ''}
    ${arrows.includes('commit') ? '<div class="arrow a2"><span>git commit</span></div>' : ''}
    ${arrows.includes('restore') ? '<div class="arrow a1 back"><span>git restore</span></div>' : ''}
    ${arrows.includes('unstage') ? '<div class="arrow a2 back"><span>restore --staged</span></div>' : ''}
  </div>`;
  let rows = '';
  const s = repo ? statusOf(dir) : null;
  const headTree = repo ? treeOf(repo, headId(repo)) : {};
  const index = repo ? repo.index : {};
  const paths = union(Object.keys(dir.files), Object.keys(index), Object.keys(headTree), repo ? [...repo.unmerged.keys()] : []);
  for (const path of paths) {
    const wd = dir.files[path], ix = index[path], hd = headTree[path];
    const unmerged = repo?.unmerged.get(path);
    const tracked = repo && (path in index || unmerged);
    const body = (content, against, cls) => (compact ? '' : bodyHtml(content, against, cls));
    if (wd === undefined) rows += ix !== undefined ? cell({ path, area: 'wd', state: 'is-deleted', badge: '已删除', badgeClass: 'warn', sig: 'deleted' }) : emptyCell('wd', path);
    else if (unmerged) rows += cell({ path, area: 'wd', state: 'is-conflict', badge: '冲突', badgeClass: 'warn', body: body(wd, null, ''), editable: true, sig: wd });
    else if (!tracked) {
      const ignored = s?.ignored.includes(path);
      rows += cell({ path, area: 'wd', state: ignored ? 'is-ignored' : 'is-untracked', badge: !repo ? '' : ignored ? '已忽略' : '未跟踪', badgeClass: 'dim', body: body(wd, null, 'plain'), editable: true, sig: wd });
    } else if (wd !== ix) rows += cell({ path, area: 'wd', state: 'is-changed', badge: '已修改', badgeClass: 'warn', body: body(wd, ix, 'is-add'), editable: true, sig: wd });
    else rows += cell({ path, area: 'wd', body: body(wd, null, 'plain'), editable: true, sig: wd });
    if (!repo) { rows += emptyCell('ix', path, '') + emptyCell('hd', path, ''); continue; }
    if (unmerged) rows += cell({ path, area: 'ix', state: 'is-conflict', badge: '未合并', badgeClass: 'warn', body: compact ? '' : '<div class="cell-body"><div class="more">解决冲突后 git add</div></div>', sig: 'unmerged' });
    else if (ix === undefined) rows += hd !== undefined ? cell({ path, area: 'ix', state: 'is-deleted', badge: '将删除', badgeClass: 'ok', sig: 'deleted' }) : emptyCell('ix', path);
    else if (hd === undefined) rows += cell({ path, area: 'ix', state: 'is-staged', badge: '新文件', badgeClass: 'ok', body: body(ix, null, 'is-staged'), sig: ix });
    else if (ix !== hd) rows += cell({ path, area: 'ix', state: 'is-staged', badge: '已暂存', badgeClass: 'ok', body: body(ix, hd, 'is-staged'), sig: ix });
    else rows += cell({ path, area: 'ix', body: body(ix, null, 'plain'), sig: ix });
    rows += hd === undefined ? emptyCell('hd', path) : cell({ path, area: 'hd', body: body(hd, null, 'plain'), sig: hd });
  }
  if (!paths.length) rows = `<div class="cell is-empty" style="grid-column: 1 / -1">文件夹是空的：用 echo "…" > 文件名 创建一个文件</div>`;
  if (!repo && paths.length) rows += `<p class="empty" style="grid-column: 2 / -1">这里还不是 Git 仓库，Git 什么都看不见。先 git init。</p>`;
  const history = repo && opts.history !== false && !compact ? historyStrip(repo, opts) : '';
  return `<section class="panel"><div class="areas">${heads}${flow}${rows}</div>${history}</section>`;
}

function historyStrip(repo, { ghosts = false } = {}) {
  const id = headId(repo);
  if (!id) return '<div class="history"><span class="history-title">提交历史</span><p class="empty">还没有提交。git commit 之后，这里会出现第一张快照。</p></div>';
  const chain = [];
  for (let c = id; c; c = repo.objects.get(c).parents[0]) chain.unshift(c);
  const shown = chain.slice(-7);
  const tips = new Map();
  for (const [ref, target] of repo.refs) if (ref.startsWith('refs/heads/')) (tips.get(target) ?? tips.set(target, []).get(target)).push(ref.slice(11));
  const branch = headBranch(repo);
  const items = shown.map(c => {
    const commit = repo.objects.get(c), isHead = c === id;
    const names = (tips.get(c) ?? []).filter(n => !(isHead && n === branch));
    const pin = isHead ? `<span class="ref head">HEAD</span>${branch ? `<span class="ref-arrow">→</span><span class="ref is-current">${esc(branch)}</span>` : ''}${names.map(n => ` <span class="ref">${esc(n)}</span>`).join('')}` : names.map(n => `<span class="ref">${esc(n)}</span>`).join(' ');
    return `<li data-key="c:${c}"><span class="snap${isHead ? ' is-head' : ''}" title="${esc(short(c) + ' ' + commit.message.trim())}">${pin ? `<span class="pin">${pin}</span>` : ''}<code>${short(c)}</code><span class="msg">${esc(subject(commit.message))}</span></span></li>`;
  }).join('');
  let lost = '';
  if (ghosts) {
    const reachable = ancestors(repo, [...repo.refs.values(), id]);
    const seen = new Set();
    const list = [...repo.reflog].reverse().map(e => e.id).filter(g => !reachable.has(g) && !seen.has(g) && seen.add(g)).slice(0, 3);
    if (list.length) lost = `<p class="ghosts">不在任何分支上、只有 reflog 还记得：${list.map(g => `<span class="snap is-ghost"><code>${short(g)}</code><span class="msg">${esc(subject(repo.objects.get(g).message))}</span></span>`).join(' ')}</p>`;
  }
  return `<div class="history"><span class="history-title">提交历史（${chain.length > shown.length ? `最近 ${shown.length} 个，` : ''}箭头指向上一个快照）</span><ol class="chain">${chain.length > shown.length ? '<li><span class="more">…</span></li>' : ''}${items}</ol>${lost}</div>`;
}

function graphHtml(repo, { ghosts = false, hideHead = false } = {}) {
  const rows = graphModel(repo, { ghosts });
  if (!rows.length) {
    const branch = headBranch(repo);
    return `<p class="empty">还没有提交${branch ? `（当前分支 ${esc(branch)} 还是空的）` : ''}。</p>`;
  }
  const W = 18, H = 30, x = c => 10 + c * W, y = r => H / 2 + r * H;
  const cols = Math.max(1, ...rows.map(r => r.width));
  const at = new Map(rows.map((r, i) => [r.commit.id, i]));
  const headCommit = headId(repo);
  let paths = '', dots = '';
  rows.forEach((r, i) => {
    for (const p of r.commit.parents) {
      const j = at.get(p);
      if (j === undefined) continue;
      const c = r.col, pc = rows[j].col;
      let d;
      if (pc === c) d = `M${x(c)} ${y(i)} L${x(pc)} ${y(j)}`;
      else if (pc > c) d = `M${x(c)} ${y(i)} C${x(c)} ${y(i) + H * 0.6} ${x(pc)} ${y(i) + H * 0.4} ${x(pc)} ${y(i) + H} L${x(pc)} ${y(j)}`;
      else d = `M${x(c)} ${y(i)} L${x(c)} ${y(j) - H} C${x(c)} ${y(j) - H * 0.4} ${x(pc)} ${y(j) - H * 0.6} ${x(pc)} ${y(j)}`;
      paths += `<path d="${d}" class="lane lane-${Math.max(c, pc) % 4}${r.ghost || rows[j].ghost ? ' is-ghost' : ''}"/>`;
    }
  });
  rows.forEach((r, i) => {
    const isHead = r.commit.id === headCommit && !hideHead;
    dots += `<circle cx="${x(r.col)}" cy="${y(i)}" r="${isHead ? 6.5 : 5.5}" class="dot lane-${r.col % 4}${isHead ? ' is-head' : ''}${r.ghost ? ' is-ghost' : ''}"/>`;
  });
  const indent = cols * W + 8;
  const list = rows.map(r => `<div class="g-row${r.ghost ? ' is-ghost' : ''}" data-key="g:${r.commit.id}" style="padding-left:${indent}px" title="${esc(r.commit.message.trim())}">
    <code>${short(r.commit.id)}</code>${refTags(r.refs, { hideHead, currentBranch: headBranch(repo) })}<span class="msg">${esc(subject(r.commit.message))}</span>${r.ghost ? '<span class="tag-note">只剩 reflog 记得</span>' : ''}</div>`).join('');
  return `<div class="graph"><svg width="${indent}" height="${rows.length * H}" aria-hidden="true">${paths}${dots}</svg>${list}</div>`;
}

function stateLine(world) {
  const repo = world.repo;
  if (!repo) return '';
  const s = statusOf(world.dir);
  const op = repo.op;
  const parts = [];
  if (op?.type === 'merge') parts.push(`<b>合并进行中</b>：${s.unmerged.length ? `${s.unmerged.length} 个文件有冲突，改好后 git add，再 git commit` : '冲突都解决了，git commit 完成合并'}`);
  if (op?.type === 'rebase') parts.push(`<b>变基进行中</b>（${op.done.length}/${op.done.length + op.todo.length}）：${s.unmerged.length ? '解决冲突后 git add，再 git rebase --continue' : 'git rebase --continue 继续'}`);
  if (op?.type === 'revert') parts.push('<b>撤销提交进行中</b>：解决冲突后 git add，再 git revert --continue');
  const changed = new Set([...s.staged, ...s.unstaged].map(f => f.path));
  if (!changed.size && !s.untracked.length && !s.unmerged.length) parts.push('工作区干净：和最近一次提交一模一样');
  else {
    if (changed.size) parts.push(`${changed.size} 个文件有改动${s.staged.length ? `（${s.staged.length} 个已暂存）` : ''}`);
    if (s.untracked.length) parts.push(`${s.untracked.length} 个未跟踪文件`);
  }
  if (repo.stash.length) parts.push(`stash 里收着 ${repo.stash.length} 份`);
  return `<p class="g-state">${parts.join(' · ')}</p>`;
}

function graphPanel(world, opts) {
  const repo = world.repo;
  const where = world.cwd ? `~/${world.cwd}` : '~';
  if (!repo) return `<section class="panel"><p class="panel-title"><b>提交图</b> · ${esc(where)}</p><p class="empty">这里还不是仓库。</p></section>`;
  return `<section class="panel"><p class="panel-title"><b>提交图</b> · 最新的在上面，线连向上一个快照</p>${graphHtml(repo, opts)}${stateLine(world)}</section>`;
}

function localRepoFor(world, url) {
  if (world.repo) return { repo: world.repo, name: world.cwd };
  for (const [name, dir] of world.home.dirs) if (dir.repo && dir.repo.config['remote.origin.url'] === url) return { repo: dir.repo, name };
  return null;
}

function remotePanel(world, opts) {
  const remote = world.remoteRepo(opts.remote);
  const local = localRepoFor(world, opts.remote);
  const slug = opts.remote.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  const inside = world.repo && world.repo === local?.repo;
  return `<div class="remote-pair">
    <section class="panel"><p class="panel-title">☁️ <b>GitHub</b> <span class="where">${esc(slug)}</span></p>${remote ? graphHtml(remote, { hideHead: true }) : '<p class="empty">（没有这个仓库）</p>'}</section>
    <section class="panel"><p class="panel-title">💻 <b>你的电脑</b> <span class="where">${local ? `~/${esc(local.name)}` : ''}</span></p>${local ? graphHtml(local.repo, {}) : '<p class="empty">还没有克隆到本地。</p>'}${inside ? stateLine(world) : ''}</section>
  </div>`;
}

const PANELS = {
  areas: (world, config) => areasPanel(world, { ...config.areas }),
  compact: (world, config) => (world.cwd ? areasPanel(world, { ...config.areas, compact: true }) : ''),
  graph: (world, config) => graphPanel(world, { ghosts: config.ghosts }),
  remote: (world, config) => remotePanel(world, config),
};

/* ---------------- 挂载 ---------------- */

export function mount(config) {
  borrowFonts();
  const root = document.getElementById('lab');
  root.classList.add('lab');
  const uid = Math.random().toString(36).slice(2, 7);
  root.innerHTML = `
    <header class="lab-head">
      <span class="lab-tag">🧪 沙盒</span>
      <h1 class="lab-title">${esc(config.title)}</h1>
      <button type="button" class="lab-btn is-quiet" data-reset title="回到这一课开始时的样子">↺ 重来</button>
    </header>
    <div class="stage"></div>
    <div class="task" aria-live="polite"></div>
    <div class="actions" hidden></div>
    <div class="editor" hidden>
      <p class="editor-head"></p>
      <textarea spellcheck="false" aria-label="文件内容"></textarea>
      <div class="editor-tools">
        <span class="resolve" hidden>
          <button type="button" class="lab-btn is-quiet" data-resolve="ours">留 HEAD 这边</button>
          <button type="button" class="lab-btn is-quiet" data-resolve="theirs">留对方那边</button>
          <button type="button" class="lab-btn is-quiet" data-resolve="both">两边都留</button>
        </span>
        <span class="spacer"></span>
        <button type="button" class="lab-btn is-quiet" data-cancel>取消</button>
        <button type="button" class="lab-btn" data-save>保存</button>
      </div>
    </div>
    <div class="term">
      <div class="term-out" role="log" aria-label="终端输出"></div>
      <form class="term-line">
        <label for="cmd-${uid}"></label>
        <input id="cmd-${uid}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="在这里输入命令，回车执行">
        <button type="submit" class="lab-btn" aria-label="执行命令">⏎</button>
      </form>
    </div>
    <div class="chips"></div>`;
  const $ = selector => root.querySelector(selector);
  const out = $('.term-out'), input = $('input'), form = $('form'), stage = $('.stage'), editor = $('.editor');
  const textarea = editor.querySelector('textarea');
  let world, taskIndex = 0, taskSince = 0, editing = null, listOpen = false;
  const history = [];
  let historyPos = 0;
  const actionsDone = new Set();
  let previous = new Map();

  function start() {
    world = new World();
    if (config.setup) config.setup(world, script);
    if (config.cwd !== undefined) world.cwd = config.cwd;
    world.events.length = 0;
    taskIndex = 0;
    taskSince = 0;
    actionsDone.clear();
    previous = new Map();
    out.innerHTML = '';
    closeEditor();
    for (const line of (config.intro ?? '这是在浏览器里模拟的终端，命令不会碰你的电脑。输入 help 看看能用哪些命令。').split('\n')) printRaw(`<span class="t-intro">${esc(line)}</span>`);
    checkTasks();
    render(false);
  }

  /* ----- 终端 ----- */
  function printRaw(html, extra = '') {
    const div = document.createElement('div');
    div.className = `t-line ${extra}`;
    div.innerHTML = html || '&#8203;';
    out.append(div);
    while (out.childElementCount > 600) out.firstElementChild.remove();
  }
  function printLines(list) {
    for (const segs of list) printRaw(segs.map(([text, cls]) => (cls ? `<span class="t-${cls}">${esc(text)}</span>` : esc(text))).join(''));
  }
  function promptHtml() {
    const p = world.prompt();
    return `<span class="t-prompt">${esc(p.where)}${p.branch ? ` <span class="br">(${esc(p.branch)}${p.state ? `|<span class="st">${esc(p.state)}</span>` : ''})</span>` : ''} $</span>`;
  }
  function run(line) {
    const text = line.trim();
    printRaw(`${promptHtml()} ${esc(text)}`, 't-cmd');
    if (!text) return;
    if (history[history.length - 1] !== text) history.push(text);
    historyPos = history.length;
    const result = world.run(text);
    printLines(result.lines);
    for (const action of result.actions) {
      if (action.type === 'clear') out.innerHTML = '';
      if (action.type === 'edit') openEditor(action.path);
    }
    after();
  }
  function after() {
    checkTasks();
    render(true);
    out.scrollTop = out.scrollHeight;
  }

  /* ----- 任务 ----- */
  function ctx() {
    const repo = world.repo, dir = world.dir;
    const events = world.events.slice(taskSince);
    const head = repo ? treeOf(repo, headId(repo)) : {};
    return {
      world, repo, dir, files: dir.files, head, index: repo ? repo.index : {},
      status: repo ? statusOf(dir) : null,
      branch: repo ? headBranch(repo) : null,
      tip: repo ? headId(repo) : null,
      commits: repo && headId(repo) ? ancestors(repo, [headId(repo)]).size : 0,
      message: repo && headId(repo) ? subject(repo.objects.get(headId(repo)).message) : '',
      ref: name => repo?.refs.get(`refs/heads/${name}`) ?? null,
      ran: (sub, test) => events.some(e => e.git === sub && e.status === 0 && (!test || test(e.args.join(' ')))),
      sh: (name, test) => events.some(e => e.sh === name && (!test || test(e.args.join(' ')))),
      tried: (sub, test) => events.some(e => e.git === sub && (!test || test(e.args.join(' ')))),
      failed: sub => events.some(e => e.git === sub && e.status !== 0),
      wrote: name => events.some(e => e.write === name),
      acted: id => actionsDone.has(id),
      remote: url => world.remoteRepo(url ?? config.remote),
    };
  }
  function checkTasks() {
    const tasks = config.tasks ?? [];
    while (taskIndex < tasks.length) {
      let ok = false;
      try { ok = Boolean(tasks[taskIndex].check(ctx())); } catch (error) { console.warn(error); }
      if (!ok) break;
      taskIndex++;
      taskSince = world.events.length;
    }
  }
  function hintFor(task) {
    return typeof task.hint === 'function' ? task.hint(ctx()) : task.hint;
  }
  function renderTask() {
    const tasks = config.tasks ?? [];
    const el = $('.task');
    if (!tasks.length) { el.hidden = true; return; }
    const details = el.querySelector('details');
    if (details) listOpen = details.open;
    const done = taskIndex >= tasks.length;
    const task = tasks[taskIndex];
    el.classList.toggle('is-done', done);
    const hint = !done && hintFor(task);
    el.innerHTML = `
      <span class="task-count">${done ? '✓' : `任务 <b>${taskIndex + 1}</b>/${tasks.length}`}</span>
      <p class="task-text">${done ? `<span class="stamp">本课完成</span>${config.done ?? '接下来随便玩：想到什么命令就试试。'}` : task.text}</p>
      ${done && config.next
        ? `<button type="button" class="lab-btn is-quiet" data-next="${esc(config.next)}" title="跳到正文里的下一课">下一课 →</button>`
        : hint
          ? `<button type="button" class="lab-btn is-quiet" data-hint="${esc(hint)}" title="把提示命令填进终端">提示</button>`
          : '<span></span>'}
      <div class="task-dots" aria-hidden="true">${tasks.map((_, i) => `<i class="${i < taskIndex ? 'done' : i === taskIndex ? 'now' : ''}"></i>`).join('')}</div>
      <details class="task-list"${listOpen ? ' open' : ''}><summary>全部任务</summary><ol>${tasks.map((t, i) => `<li class="${i < taskIndex ? 'done' : i === taskIndex ? 'now' : ''}">${t.text}</li>`).join('')}</ol></details>`;
  }

  /* ----- 场景按钮（例如“队友推送了一个提交”） ----- */
  function renderActions() {
    const list = config.actions ?? [];
    const el = $('.actions');
    el.hidden = !list.length;
    const c = ctx();
    el.innerHTML = list.map(a => {
      const ready = (!a.once || !actionsDone.has(a.id)) && (!a.when || a.when(c));
      return `<button type="button" class="lab-btn" data-action="${esc(a.id)}"${ready ? '' : ' disabled'} title="${esc(a.title ?? '')}">${a.label}</button>`;
    }).join('');
  }
  function doAction(id) {
    const action = (config.actions ?? []).find(a => a.id === id);
    if (!action) return;
    const note = action.run(world);
    actionsDone.add(id);
    world.events.push({ action: id });
    if (note) printRaw(`<span class="t-note">${esc(note)}</span>`);
    after();
  }

  /* ----- 编辑器 ----- */
  function openEditor(path) {
    editing = path;
    editor.hidden = false;
    editor.querySelector('.editor-head').innerHTML = `编辑 <code>${esc(path)}</code> <small>（相当于在编辑器里打开它。保存之后文件变了，Git 会看到修改）</small>`;
    textarea.value = world.dir.files[path] ?? '';
    editor.querySelector('.resolve').hidden = !/^<{7} /m.test(textarea.value);
    textarea.focus({ preventScroll: true });
  }
  function closeEditor() { editing = null; editor.hidden = true; }
  const RESOLVE = /^<{7} [^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7}[^\n]*\n?/gm;
  editor.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.resolve) {
      const pick = button.dataset.resolve;
      textarea.value = textarea.value.replace(RESOLVE, (m, ours, theirs) => (pick === 'ours' ? ours : pick === 'theirs' ? theirs : ours + theirs));
    } else if ('cancel' in button.dataset) closeEditor();
    else if ('save' in button.dataset && editing) {
      world.writeFile(editing, textarea.value);
      printRaw(`<span class="t-note">（编辑器）已保存 ${esc(editing)}</span>`);
      closeEditor();
      after();
      input.focus({ preventScroll: true });
    }
  });

  /* ----- 渲染 ----- */
  function render(flash) {
    stage.innerHTML = (config.panels ?? ['areas']).map(name => PANELS[name](world, config)).join('');
    const next = new Map();
    for (const el of stage.querySelectorAll('[data-key]')) {
      const key = el.dataset.key, sig = el.dataset.sig ?? '';
      next.set(key, sig);
      if (flash && previous.get(key) !== sig && !el.classList.contains('is-empty')) (el.classList.contains('cell') ? el : el.querySelector('.snap') ?? el).classList.add('is-fresh');
    }
    previous = next;
    const chain = stage.querySelector('.chain');
    if (chain) chain.scrollLeft = chain.scrollWidth;
    form.querySelector('label').innerHTML = promptHtml();
    renderTask();
    renderActions();
    const chips = config.chips ?? ['git status', 'git log --oneline', 'ls'];
    $('.chips').innerHTML = chips.length ? `试试：${chips.map(c => `<code>${esc(c)}</code>`).join(' ')}` : '';
  }

  /* ----- 输入 ----- */
  function fill(text) {
    input.value = text;
    input.focus({ preventScroll: true });
    input.setSelectionRange(text.length, text.length);
  }
  function complete() {
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const words = before.split(/\s+/);
    const word = words[words.length - 1];
    let pool;
    if (words.length === 1) pool = SHELL_WORDS;
    else if (words[0] === 'git' && words.length === 2) pool = GIT_WORDS;
    else {
      const repo = world.repo;
      pool = [...Object.keys(world.dir.files), ...(world.cwd ? [] : world.home.dirs.keys()), ...(repo ? [...repo.refs.keys()].map(r => r.replace(/^refs\/(heads|remotes)\//, '')) : [])];
    }
    const hits = [...new Set(pool)].filter(w => w.startsWith(word)).sort();
    if (!hits.length) return false;
    const common = hits.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
    if (hits.length === 1 || common.length > word.length) {
      const insert = hits.length === 1 ? hits[0] + ' ' : common;
      const value = before.slice(0, before.length - word.length) + insert;
      input.value = value + input.value.slice(caret);
      input.setSelectionRange(value.length, value.length);
    } else {
      printRaw(`${promptHtml()} ${esc(input.value)}`, 't-cmd');
      printRaw(`<span class="t-hint">${esc(hits.join('  '))}</span>`);
      out.scrollTop = out.scrollHeight;
    }
    return true;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = input.value;
    input.value = '';
    run(value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' && historyPos > 0) { event.preventDefault(); historyPos--; fill(history[historyPos]); }
    else if (event.key === 'ArrowDown' && historyPos < history.length) { event.preventDefault(); historyPos++; fill(history[historyPos] ?? ''); }
    else if (event.key === 'Tab' && !event.shiftKey && input.value.trim() && complete()) event.preventDefault();
    else if (event.key === 'l' && event.ctrlKey) { event.preventDefault(); out.innerHTML = ''; }
    else if (event.key === 'c' && event.ctrlKey && !String(window.getSelection())) { event.preventDefault(); printRaw(`${promptHtml()} ${esc(input.value)}^C`, 't-cmd'); input.value = ''; }
  });
  root.addEventListener('click', event => {
    const target = event.target;
    const code = target.closest('.task-text code, .task-list code, .chips code');
    if (code) { fill(code.textContent); return; }
    const hint = target.closest('[data-hint]');
    if (hint) { fill(hint.dataset.hint); return; }
    const action = target.closest('[data-action]');
    if (action && !action.disabled) { doAction(action.dataset.action); return; }
    const next = target.closest('[data-next]');
    if (next) { jumpToHeading(next.dataset.next); return; }
    const edit = target.closest('[data-edit]');
    if (edit) { openEditor(edit.dataset.edit); return; }
    if (target.closest('[data-reset]')) { start(); return; }
    if (target.closest('.term-out') && !String(window.getSelection())) input.focus({ preventScroll: true });
  });

  start();
  return { get world() { return world; }, run };
}
