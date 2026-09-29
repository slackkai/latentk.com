/** 第 6 课：改错了、暂存错了、提交错了、把提交弄丢了，各有一味后悔药。 */
export const config = {
  title: '第 6 课 · 后悔药：restore、amend、revert、reflog',
  cwd: 'blog',
  panels: ['areas', 'graph'],
  ghosts: true,
  next: '第 7 课',
  intro: 'blog 仓库有三个提交，工作区里还留着三样烂摊子：\n改了一半的文章、误加进暂存区的待办、没跟踪的临时文件。一个一个收拾。',
  setup(world, script) {
    script(world, [
      'mkdir blog',
      'cd blog',
      'git init',
      w => w.writeFile('post.txt', '标题：Git 入门\n正文第一段。\n'),
      'git add .',
      'git commit -m "post: 第一篇文章"',
      w => w.writeFile('post.txt', '标题：Git 入门\n正文第一段。\n正文第二段。\n'),
      'git add .',
      'git commit -m "post: 补上第二段"',
      w => w.writeFile('post.txt', '标题：Git 入门\n正文第一段。\n正文第二段。\n（这段先写着，回头再改）\n'),
      'git add .',
      'git commit -m "wip: 试写一段"',
    ]);
    world.writeFile('post.txt', '标题：Git 入门（草稿）\n正文第一段。\n正文第二段。\n（这段先写着，回头再改）\n');
    world.writeFile('notes.txt', '待办：给文章配张图\n');
    world.writeFile('old.txt', '临时记的一句话。\n');
    script(world, ['git add notes.txt']);
  },
  tasks: [
    {
      text: '<code>git status</code>：post.txt 有未暂存的修改，notes.txt 被暂存了（其实不该），old.txt 还没跟踪。',
      hint: 'git status',
      check: c => c.ran('status'),
    },
    {
      text: 'post.txt 没暂存的改写不要了：<code>git restore post.txt</code>。没指定来源时，它从暂存区恢复；这里暂存区正好和最近一次提交一样。',
      hint: 'git restore post.txt',
      check: c => c.files['post.txt'] === c.head['post.txt'],
    },
    {
      text: 'notes.txt 不该进这次提交，把它拿出来（文件本身保留）：<code>git restore --staged notes.txt</code>。',
      hint: 'git restore --staged notes.txt',
      check: c => !('notes.txt' in c.index) && c.files['notes.txt'] !== undefined,
    },
    {
      text: '最后一次提交的说明写得太随意，改写它：<code>git commit --amend -m "wip: 尝试新段落"</code>。--amend 会用新的提交替换上一个。',
      hint: 'git commit --amend -m "wip: 尝试新段落"',
      check: c => c.message.includes('尝试'),
    },
    {
      text: '那段占位文字不该留在历史里，用 revert 撤销它：<code>git revert HEAD</code>。revert 不删除历史，而是生成一个反向提交。',
      hint: 'git revert HEAD',
      check: c => c.message.startsWith('Revert') && !c.files['post.txt'].includes('回头再改'),
    },
    {
      text: '现在模拟手滑：<code>git reset --hard HEAD~1</code>。刚做的撤销提交被扔掉了。真实仓库里，这条命令还会丢掉没提交的修改。',
      hint: 'git reset --hard HEAD~1',
      check: c => !c.message.startsWith('Revert'),
    },
    {
      text: '别慌，HEAD 的每次移动都记在 <code>git reflog</code> 里：看一眼刚才的提交还在不在。',
      hint: 'git reflog',
      check: c => c.ran('reflog'),
    },
    {
      text: '先核对刚才的提交：<code>git show HEAD@{1}</code>。确认它就是那个撤销提交。这个 1 来自刚才的 reflog，不是通用答案。',
      hint: 'git show HEAD@{1}',
      check: c => c.ran('show', a => a === 'HEAD@{1}'),
    },
    {
      text: '给它贴一张便签，先别覆盖现场：<code>git branch rescue HEAD@{1}</code>。main 还停在原地。',
      hint: 'git branch rescue HEAD@{1}',
      check: c => c.ref('rescue') && c.repo.objects.get(c.ref('rescue'))?.message.startsWith('Revert') && c.branch === 'main',
    },
    {
      text: '<code>git log --oneline --graph --all</code>：rescue 指着找回的提交，main 和当前文件都没被再覆盖一次。',
      hint: 'git log --oneline --graph --all',
      check: c => c.ran('log', a => a.includes('--all')),
    },
  ],
  done: '没提交的修改用 restore，没推送的提交用 amend 或 reset，已推送的用 revert。真迷路了，先 reflog、再 show，然后 branch 留一个入口。',
  chips: ['git status', 'git log --oneline', 'git reflog', 'cat post.txt'],
};

export const solution = [
  'git status',
  'git restore post.txt',
  'git restore --staged notes.txt',
  'git commit --amend -m "wip: 尝试新段落"',
  'git revert HEAD',
  'git reset --hard HEAD~1',
  'git reflog',
  'git show HEAD@{1}',
  'git branch rescue HEAD@{1}',
  'git log --oneline --graph --all',
];
