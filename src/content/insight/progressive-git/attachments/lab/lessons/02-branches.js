/** 第 2 课：分支只是一张贴在提交上的便签，HEAD 指向你在哪张便签上。 */
export const config = {
  title: '第 2 课 · 分支是一张会移动的便签',
  cwd: 'notes',
  panels: ['areas', 'graph'],
  next: '第 3 课',
  intro: '这个文件夹已经是一个仓库，main 上有两个提交。\n盯着上面的提交图：每敲一条命令，看便签和 HEAD 怎么动。',
  setup(world, script) {
    script(world, [
      'mkdir notes',
      'cd notes',
      'git init',
      w => w.writeFile('story.txt', '第一章\n主角在家。\n'),
      'git add story.txt',
      'git commit -m "story: 开头"',
      w => w.writeFile('story.txt', '第一章\n主角在家。\n第二章\n主角出门。\n'),
      'git add story.txt',
      'git commit -m "story: 出门"',
    ]);
  },
  tasks: [
    {
      text: '<code>git branch</code>：现在只有一条 main，星号表示你站在这条分支上。',
      hint: 'git branch',
      check: c => c.ran('branch'),
    },
    {
      text: '<code>git log --oneline</code>：两个提交，新提交的箭头指向上一个。',
      hint: 'git log --oneline',
      check: c => c.ran('log', args => args.includes('--oneline')),
    },
    {
      text: '创建新分支 draft 并立刻切过去：<code>git switch -c draft</code>。注意图里多了张便签，两个分支现在指着同一个提交。',
      hint: 'git switch -c draft',
      check: c => c.branch === 'draft' && c.ref('draft') === c.ref('main'),
    },
    {
      text: '在 draft 上继续写：<code>echo "第三章 主角回来了。" &gt;&gt; story.txt</code>，然后 <code>git add story.txt</code>、<code>git commit -m "story: 回来"</code>。',
      hint: c => (c.files['story.txt'] === c.head['story.txt'] ? 'echo "第三章 主角回来了。" >> story.txt' : c.files['story.txt'] !== c.index['story.txt'] ? 'git add story.txt' : 'git commit -m "story: 回来"'),
      check: c => c.ref('draft') !== c.ref('main'),
    },
    {
      text: '<code>cat story.txt</code>：draft 上有第三章。',
      hint: 'cat story.txt',
      check: c => c.branch === 'draft' && c.sh('cat'),
    },
    {
      text: '切回 main：<code>git switch main</code>，再 <code>cat story.txt</code>。文件里的第三章去哪了？它还在 draft 的提交里，只是 main 的便签没动。',
      hint: c => (c.branch === 'main' ? 'cat story.txt' : 'git switch main'),
      check: c => c.branch === 'main' && c.sh('cat'),
    },
    {
      text: '把 draft 合进来：<code>git merge draft</code>。因为 main 没动过，Git 直接把便签往前挪，这叫快进（fast-forward）。',
      hint: 'git merge draft',
      check: c => c.ref('main') !== null && c.ref('main') === c.ref('draft'),
    },
    {
      text: '分支的使命完成了，撕掉便签：<code>git branch -d draft</code>。提交一个都没少——便签从来不是提交本身。',
      hint: 'git branch -d draft',
      check: c => c.ref('draft') === null,
    },
  ],
  done: '分支 = 指向某个提交的便签，HEAD = 你在哪张便签上。切分支时 Git 会把工作区的文件换成那张便签指向的快照。下一课看两条线打架。',
  chips: ['git branch', 'git log --oneline --graph --all', 'cat story.txt'],
};

export const solution = [
  'git branch',
  'git log --oneline',
  'git switch -c draft',
  'echo "第三章 主角回来了。" >> story.txt',
  'git add story.txt',
  'git commit -m "story: 回来"',
  'cat story.txt',
  'git switch main',
  'cat story.txt',
  'git merge draft',
  'git branch -d draft',
];
