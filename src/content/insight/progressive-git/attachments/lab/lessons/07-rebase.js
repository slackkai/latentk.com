/** 第 7 课：把没写完的工作收进抽屉，把自己的提交搬到最新主线，再摘一个别人分支上的修复。 */
export const config = {
  title: '第 7 课 · 把历史捋直：stash、rebase、cherry-pick',
  cwd: 'app',
  panels: ['areas', 'graph'],
  next: '一张总表',
  intro: 'feature 上有一个提交，工作区还有没写完的改动；\nmain 已经往前跑了两个提交，另外 hotfix 上有一个还没合并进 main 的修复。',
  setup(world, script) {
    script(world, [
      'mkdir app',
      'cd app',
      'git init',
      w => w.writeFile('app.txt', 'v1\n'),
      'git add .',
      'git commit -m "app: 起步"',
      'git switch -c feature',
      w => w.writeFile('feature.txt', '半成品功能。\n'),
      'git add .',
      'git commit -m "feature: 先搭个架子"',
      'git switch main',
      w => w.writeFile('app.txt', 'v1\n已上线的新功能。\n'),
      'git add .',
      'git commit -m "main: 上线新功能"',
      w => w.writeFile('app.txt', 'v1\n已上线的新功能。\n紧急修复了一个错误。\n'),
      'git add .',
      'git commit -m "main: 紧急修复"',
      'git switch -c hotfix',
      w => w.writeFile('hotfix.txt', '修复说明。\n'),
      'git add .',
      'git commit -m "hotfix: 修一个线上问题"',
      'git switch feature',
    ]);
    world.writeFile('feature.txt', '半成品功能。\n做了一半的修改。\n');
  },
  tasks: [
    {
      text: '<code>git status</code>：feature 的工作区有没提交的改动，历史也和 main 分叉了。',
      hint: 'git status',
      check: c => c.ran('status'),
    },
    {
      text: '先把手头的半成品收进抽屉，让工作区干净下来：<code>git stash</code>。',
      hint: 'git stash',
      check: c => c.repo.stash.length === 1 && c.status.staged.length === 0 && c.status.unstaged.length === 0,
    },
    {
      text: '把 feature 的提交搬到 main 的最新提交上：<code>git rebase main</code>。提交的哈希会变——它是新提交，只是内容和作者不变。',
      hint: 'git rebase main',
      check: c => c.branch === 'feature' && c.repo.objects.get(c.ref('feature'))?.parents[0] === c.ref('main'),
    },
    {
      text: 'hotfix 上有个还没合并的修复，你也要：<code>git cherry-pick hotfix</code>。它只把那个提交的改动摘过来。',
      hint: 'git cherry-pick hotfix',
      check: c => c.message.includes('hotfix'),
    },
    {
      text: '把抽屉里的半成品放回来：<code>git stash pop</code>。改动回到工作区，stash 也清空了。',
      hint: 'git stash pop',
      check: c => c.repo.stash.length === 0 && c.files['feature.txt']?.includes('做了一半'),
    },
    {
      text: '<code>git log --oneline --graph --all</code>：feature 是一条从 main 顶上长出来的直线，hotfix 还在旁边。',
      hint: 'git log --oneline --graph --all',
      check: c => c.ran('log', args => args.includes('--graph') && args.includes('--all')),
    },
  ],
  done: 'stash 是临时抽屉，rebase 是重放提交，cherry-pick 是复制一个提交。整整齐齐之后，去总表里复习一遍。',
  chips: ['git status', 'git stash list', 'git log --oneline --graph --all'],
};

export const solution = [
  'git status',
  'git stash',
  'git rebase main',
  'git cherry-pick hotfix',
  'git stash pop',
  'git log --oneline --graph --all',
];
