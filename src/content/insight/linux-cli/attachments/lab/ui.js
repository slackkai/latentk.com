/**
 * 沙盒界面：上面是当前目录的文件卡片，中间是任务，下面是终端。
 * 每一课只交一份配置给 mount()。
 */
import { borrowFonts, jumpToHeading, escapeHtml as esc } from './frame.js';
import { runLine, can, modeNum } from './shell.js';
import { World } from './fs.js';
import { linesOf } from './fs.js';

const WORDS = ['pwd', 'ls', 'cd', 'cat', 'head', 'tail', 'wc', 'mkdir', 'touch', 'cp', 'mv', 'rm', 'echo', 'chmod', 'grep', 'find', 'tree', 'file', 'which', 'man', 'ln', 'edit', 'clear', 'help'];

function card(name, node) {
  const kind = node.kind === 'dir' ? 'dir' : node.kind === 'link' ? 'link' : can(node, 'x') ? 'exec' : 'file';
  const icon = kind === 'dir' ? '▸' : kind === 'link' ? '↪' : kind === 'exec' ? '▶' : '·';
  const meta = node.kind === 'file' ? `${modeNum(node.mode)}  ${node.content.length}B` : node.kind === 'link' ? `→ ${node.target}` : modeNum(node.mode);
  const peek = node.kind === 'file' ? linesOf(node.content).slice(0, 3).map(l => `<div>${esc(l) || '&nbsp;'}</div>`).join('') : '';
  return `<button type="button" class="card is-${kind}" data-open="${esc(name)}">
    <span class="card-icon">${icon}</span>
    <span class="card-name">${esc(name)}</span>
    <span class="card-meta">${esc(meta)}</span>
    ${peek ? `<span class="card-peek">${peek}</span>` : ''}
  </button>`;
}

export function mount(config) {
  borrowFonts();
  const root = document.getElementById('lab');
  root.classList.add('lab');
  const uid = Math.random().toString(36).slice(2, 7);
  root.innerHTML = `
    <header class="lab-head">
      <span class="lab-tag">终端</span>
      <h1 class="lab-title">${esc(config.title)}</h1>
      <button type="button" class="lab-btn is-quiet" data-reset title="回到这一课开始时的样子">↺ 重来</button>
    </header>
    <div class="stage"></div>
    <div class="task" aria-live="polite"></div>
    <div class="editor" hidden>
      <p class="editor-head"></p>
      <textarea spellcheck="false" aria-label="文件内容"></textarea>
      <div class="editor-tools"><span class="spacer"></span>
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
  const $ = s => root.querySelector(s);
  const out = $('.term-out'), input = $('input'), form = $('form'), stage = $('.stage'), editor = $('.editor');
  const textarea = editor.querySelector('textarea');
  let world, taskIndex = 0, taskSince = 0, editing = null, listOpen = false;
  const history = [];
  let historyPos = 0;

  function start() {
    world = new World();
    config.setup?.(world);
    world.events.length = 0;
    taskIndex = 0;
    taskSince = 0;
    out.innerHTML = '';
    editor.hidden = true;
    for (const line of (config.intro ?? '').split('\n')) if (line) print(`<span class="t-intro">${esc(line)}</span>`);
    check();
    render(false);
  }

  function print(html, extra = '') {
    const div = document.createElement('div');
    div.className = `t-line${extra ? ` ${extra}` : ''}`;
    div.innerHTML = html || '&#8203;';
    out.append(div);
  }
  function printOut(result) {
    for (const segs of result.lines) print(segs.map(([t, c]) => (c ? `<span class="t-${c}">${esc(t)}</span>` : esc(t))).join(''));
    for (const note of result.notes) print(`<span class="t-note">${esc(note)}</span>`);
  }
  function prompt() { return `<span class="t-prompt">${esc(world.where())} $</span>`; }

  function run(line) {
    const text = line.trim();
    print(`${prompt()} ${esc(text)}`, 't-cmd');
    if (!text) return;
    if (history[history.length - 1] !== text) history.push(text);
    historyPos = history.length;
    const result = runLine(world, text);
    if (result.actions.some(a => a.type === 'clear')) out.innerHTML = '';
    else printOut(result);
    const edit = result.actions.find(a => a.type === 'edit');
    if (edit) openEditor(edit.path);
    check();
    render(true);
    out.scrollTop = out.scrollHeight;
  }

  function ctx() {
    const here = world.here();
    const events = world.events.slice(taskSince);
    return {
      world, here, cwd: world.where(),
      ran: (name, test) => events.some(e => e.sh === name && e.status === 0 && (!test || test(e.args.join(' ')))),
      wrote: () => events.some(e => e.write),
    };
  }
  function check() {
    const tasks = config.tasks ?? [];
    while (taskIndex < tasks.length && tasks[taskIndex].check(ctx())) {
      taskIndex++;
      taskSince = world.events.length;
    }
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
    const hint = !done && (typeof task.hint === 'function' ? task.hint(ctx()) : task.hint);
    el.innerHTML = `
      <span class="task-count">${done ? '✓' : `任务 <b>${taskIndex + 1}</b>/${tasks.length}`}</span>
      <p class="task-text">${done ? `<span class="stamp">本课完成</span>${config.done ?? ''}` : task.text}</p>
      ${done && config.next
        ? `<button type="button" class="lab-btn is-quiet" data-next="${esc(config.next)}" title="跳到正文里的下一课">下一课 →</button>`
        : hint
          ? `<button type="button" class="lab-btn is-quiet" data-hint="${esc(hint)}" title="把提示命令填进终端">提示</button>`
          : '<span></span>'}
      <div class="task-dots" aria-hidden="true">${tasks.map((_, i) => `<i class="${i < taskIndex ? 'done' : i === taskIndex ? 'now' : ''}"></i>`).join('')}</div>
      <details class="task-list"${listOpen ? ' open' : ''}><summary>全部任务</summary><ol>${tasks.map((t, i) => `<li class="${i < taskIndex ? 'done' : i === taskIndex ? 'now' : ''}">${t.text}</li>`).join('')}</ol></details>`;
  }

  function render() {
    const here = world.here();
    const names = world.list(here).filter(n => !n.startsWith('.'));
    const hidden = world.list(here).filter(n => n.startsWith('.')).length;
    stage.innerHTML = `<section class="panel">
      <p class="panel-title"><b>${esc(world.where())}</b> · ${names.length} 项${hidden ? ` · 另有 ${hidden} 个隐藏文件，ls -a 能看见` : ''}</p>
      <div class="cards">${names.map(n => card(n, here.children[n])).join('') || '<p class="empty">这个目录是空的。</p>'}</div>
    </section>`;
    form.querySelector('label').innerHTML = prompt();
    renderTask();
    const chips = config.chips ?? [];
    $('.chips').innerHTML = chips.length ? `试试：${chips.map(c => `<code>${esc(c)}</code>`).join(' ')}` : '';
  }

  function openEditor(path) {
    editing = path;
    editor.hidden = false;
    const hit = world.resolve(path);
    editor.querySelector('.editor-head').innerHTML = `编辑 <code>${esc(path)}</code>`;
    textarea.value = hit.node?.kind === 'file' ? hit.node.content : '';
    textarea.focus({ preventScroll: true });
  }
  editor.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if ('cancel' in button.dataset) { editor.hidden = true; editing = null; }
    else if ('save' in button.dataset && editing) {
      world.writeFile(editing, textarea.value.endsWith('\n') ? textarea.value : textarea.value + '\n');
      print(`<span class="t-note">已保存 ${esc(editing)}</span>`);
      editor.hidden = true;
      editing = null;
      check();
      render(true);
    }
  });

  function fill(text) {
    input.value = text;
    input.focus({ preventScroll: true });
    input.setSelectionRange(text.length, text.length);
  }
  function complete() {
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const words = before.split(/\s+/);
    const word = words.at(-1);
    const pool = words.length === 1 ? WORDS : world.list(world.here());
    const hits = [...new Set(pool)].filter(w => w.startsWith(word)).sort();
    if (!hits.length) return false;
    const common = hits.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
    if (hits.length === 1 || common.length > word.length) {
      const insert = hits.length === 1 ? `${hits[0]} ` : common;
      const value = before.slice(0, before.length - word.length) + insert;
      input.value = value + input.value.slice(caret);
      input.setSelectionRange(value.length, value.length);
    } else {
      print(`${prompt()} ${esc(input.value)}`, 't-cmd');
      print(`<span class="t-hint">${esc(hits.join('  '))}</span>`);
      out.scrollTop = out.scrollHeight;
    }
    return true;
  }

  form.addEventListener('submit', event => { event.preventDefault(); const v = input.value; input.value = ''; run(v); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' && historyPos > 0) { event.preventDefault(); historyPos--; fill(history[historyPos]); }
    else if (event.key === 'ArrowDown' && historyPos < history.length) { event.preventDefault(); historyPos++; fill(history[historyPos] ?? ''); }
    else if (event.key === 'Tab' && !event.shiftKey && input.value.trim() && complete()) event.preventDefault();
    else if (event.key === 'l' && event.ctrlKey) { event.preventDefault(); out.innerHTML = ''; }
    else if (event.key === 'c' && event.ctrlKey && !String(window.getSelection())) { event.preventDefault(); print(`${prompt()} ${esc(input.value)}^C`, 't-cmd'); input.value = ''; }
  });
  root.addEventListener('click', event => {
    const t = event.target;
    const code = t.closest('.task-text code, .task-list code, .chips code');
    if (code) { fill(code.textContent); return; }
    const hint = t.closest('[data-hint]');
    if (hint) { fill(hint.dataset.hint); return; }
    const next = t.closest('[data-next]');
    if (next) { jumpToHeading(next.dataset.next); return; }
    const open = t.closest('[data-open]');
    if (open) {
      const node = world.here().children[open.dataset.open];
      const path = JSON.stringify(open.dataset.open);
      fill(node?.kind === 'dir' ? `cd ${path}` : `cat ${path}`);
      return;
    }
    if (t.closest('[data-reset]')) { start(); return; }
    if (t.closest('.term-out') && !String(window.getSelection())) input.focus({ preventScroll: true });
  });

  start();
}
