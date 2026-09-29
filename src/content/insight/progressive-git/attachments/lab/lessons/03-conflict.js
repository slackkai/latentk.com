/** 第 3 课：两条线都改了同一行，Git 停下来说：你来决定。 */
export const config = {
  title: '第 3 课 · 冲突：Git 不敢替你做的决定',
  cwd: 'recipe',
  panels: ['areas', 'graph'],
  next: '第 4 课',
  intro: 'main 和 spicy 从同一个提交分开了：一个把番茄减到 1 个，一个加到 4 个。\n这次合并会撞车。别怕，冲突只是 Git 把两个版本都递给你。',
  setup(world, script) {
    script(world, [
      'mkdir recipe',
      'cd recipe',
      'git init',
      w => w.writeFile('recipe.txt', '番茄炒蛋\n- 番茄 2 个\n- 鸡蛋 3 个\n'),
      'git add recipe.txt',
      'git commit -m "recipe: 基础版"',
      'git switch -c spicy',
      w => w.writeFile('recipe.txt', '番茄炒蛋\n- 番茄 4 个\n- 鸡蛋 3 个\n'),
      'git add recipe.txt',
      'git commit -m "spicy: 多放番茄"',
      'git switch main',
      w => w.writeFile('recipe.txt', '番茄炒蛋\n- 番茄 1 个\n- 鸡蛋 3 个\n'),
      'git add recipe.txt',
      'git commit -m "main: 少放番茄"',
    ]);
  },
  tasks: [
    {
      text: '先把 spicy 合进来：<code>git merge spicy</code>。它会失败——这不是坏了，是冲突。',
      hint: 'git merge spicy',
      check: c => c.repo.unmerged.size > 0,
    },
    {
      text: '<code>cat recipe.txt</code>：文件里出现了 <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>、<code>=======</code>、<code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> 三个标记。Git 把两个版本都摆了出来。',
      hint: 'cat recipe.txt',
      check: c => c.sh('cat') && /^<{7} /m.test(c.files['recipe.txt'] ?? ''),
    },
    {
      text: '点上面工作区里的 <code>recipe.txt</code> 打开编辑器：自己改，或者用「留 HEAD 这边 / 留对方那边 / 两边都留」按钮。保存后标记就没了。留下的内容要自己读一遍。',
      hint: 'edit recipe.txt',
      check: c => c.files['recipe.txt'] !== undefined && !/^<{7} /m.test(c.files['recipe.txt']),
    },
    {
      text: '告诉 Git 这处已经解决：<code>git add recipe.txt</code>。文件会从「冲突」变成「已暂存」。',
      hint: 'git add recipe.txt',
      check: c => c.repo.unmerged.size === 0 && 'recipe.txt' in c.index,
    },
    {
      text: '<code>git status</code>：Git 说「冲突都解决了，但合并还没收尾」。',
      hint: 'git status',
      check: c => c.repo.op?.type === 'merge' && c.ran('status'),
    },
    {
      text: '收尾：<code>git commit</code>。沙盒直接用默认合并说明；真实终端可能先打开编辑器让你确认。',
      hint: 'git commit',
      check: c => c.repo.objects.get(c.tip).parents.length === 2,
    },
    {
      text: '<code>git log --oneline --graph</code>：看到一个 Y 字——两条线并进一个合并提交，它有两个父提交。',
      hint: 'git log --oneline --graph',
      check: c => c.ran('log', args => args.includes('--graph')),
    },
  ],
  done: '记住合并冲突的三步：改文件 → git add → git commit。想反悔整场合并，用 git merge --abort。从干净工作区开始，恢复才更完整。',
  chips: ['git status', 'cat recipe.txt', 'git log --oneline --graph --all'],
};

export const solution = [
  { cmd: 'git merge spicy', fails: true },
  'cat recipe.txt',
  w => w.writeFile('recipe.txt', '番茄炒蛋\n- 番茄 4 个\n- 鸡蛋 3 个\n'),
  'git add recipe.txt',
  'git status',
  'git commit',
  'git log --oneline --graph',
];
