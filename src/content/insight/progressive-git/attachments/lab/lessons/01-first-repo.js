/**
 * 第 1 课：把文件夹变成仓库，拍下第一张快照。
 * solution 是给测试脚本用的标准解法；页面上的 step 检查独立于它。
 */
const hello = c => c.files['hello.txt'];

export const config = {
  title: '第 1 课 · 第一个仓库，第一张快照',
  panels: ['areas'],
  next: '第 2 课',
  intro: '这是在浏览器里模拟的终端，命令不会碰你的电脑。\n照着下面的任务一步步敲；任务里的命令点一下就会填进来。',
  tasks: [
    {
      text: '先建一个练习用的文件夹：<code>mkdir git-test</code>，再 <code>cd git-test</code> 进去。',
      hint: c => (c.world.home.dirs.has('git-test') ? 'cd git-test' : 'mkdir git-test'),
      check: c => c.world.cwd === 'git-test',
    },
    { text: '把这个文件夹变成 Git 仓库：<code>git init</code>。', hint: 'git init', check: c => c.repo },
    { text: '问问 Git 现在什么情况：<code>git status</code>。以后不知道该干什么，第一反应就是敲它。', hint: 'git status', check: c => c.ran('status') },
    { text: '创建一个文件：<code>echo "hello git" &gt; hello.txt</code>', hint: 'echo "hello git" > hello.txt', check: c => hello(c) !== undefined },
    { text: '再 <code>git status</code> 一次：hello.txt 出现在 Untracked files 下面，Git 看见了它，但还没开始管它。', hint: 'git status', check: c => c.ran('status') },
    { text: '把它放进暂存区：<code>git add hello.txt</code>，看看上面的图里它跑到了哪一栏。', hint: 'git add hello.txt', check: c => 'hello.txt' in c.index },
    { text: '拍第一张快照：<code>git commit -m "add hello file"</code>', hint: 'git commit -m "add hello file"', check: c => c.commits >= 1 },
    { text: '看看历史：<code>git log</code>', hint: 'git log', check: c => c.ran('log') },
    {
      text: '再来一轮：<code>echo "hello again" &gt;&gt; hello.txt</code>（两个 &gt; 是追加一行），然后 add、commit，说明写 <code>git commit -m "update hello"</code>。',
      hint: c => (hello(c) === c.head['hello.txt'] ? 'echo "hello again" >> hello.txt' : hello(c) !== c.index['hello.txt'] ? 'git add hello.txt' : 'git commit -m "update hello"'),
      check: c => c.commits >= 2,
    },
    { text: '<code>git log --oneline</code>：两张快照，一行一个。', hint: 'git log --oneline', check: c => c.ran('log', args => args.includes('--oneline')) },
  ],
  done: '你已经走完了 Git 最核心的循环：改文件 → status → add → commit → log。接着随便玩，比如 <code>cat hello.txt</code> 或 <code>git status</code>。',
  chips: ['git status', 'ls', 'cat hello.txt', 'help'],
};

export const solution = [
  'mkdir git-test',
  'cd git-test',
  'git init',
  'git status',
  'echo "hello git" > hello.txt',
  'git status',
  'git add hello.txt',
  'git commit -m "add hello file"',
  'git log',
  'echo "hello again" >> hello.txt',
  'git add hello.txt',
  'git commit -m "update hello"',
  'git log --oneline',
];
