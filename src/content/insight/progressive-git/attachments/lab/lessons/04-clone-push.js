/** 第 4 课：把 GitHub 上的仓库克隆到本地，再把自己的提交推回去。 */
const REMOTE = 'https://github.com/you/website';
const YOU = { name: 'you', email: 'you@example.com' };

export const config = {
  title: '第 4 课 · 克隆、提交、推送：第一次协作',
  cwd: null,
  panels: ['remote'],
  remote: REMOTE,
  next: '第 5 课',
  intro: '这次不是空文件夹：GitHub 上已经有一个仓库。\n上面两栏会同时显示 GitHub 和你电脑上的提交图。',
  setup(world) {
    world.createRemote(REMOTE, {
      commits: [
        { author: YOU, files: { 'index.html': '<h1>我的主页</h1>\n' }, message: 'page: 第一版主页' },
        { author: YOU, files: { 'about.txt': '你好，我是 Kai。\n' }, message: 'page: 加上关于' },
      ],
    });
  },
  tasks: [
    {
      text: '把仓库克隆到本地：<code>git clone https://github.com/you/website</code>。GitHub 上的提交和历史会整个搬过来。',
      hint: 'git clone https://github.com/you/website',
      check: c => c.world.home.dirs.has('website') && Boolean(c.world.home.dirs.get('website').repo),
    },
    {
      text: '进入克隆下来的文件夹：<code>cd website</code>。',
      hint: 'cd website',
      check: c => c.world.cwd === 'website',
    },
    {
      text: '<code>git remote -v</code>：origin 记住了这个仓库的地址，以后 fetch 和 push 都靠它。',
      hint: 'git remote -v',
      check: c => c.ran('remote'),
    },
    {
      text: '<code>git log --oneline</code>：GitHub 上那几个提交，现在已经在你电脑上了。',
      hint: 'git log --oneline',
      check: c => c.ran('log') && c.commits >= 2,
    },
    {
      text: '改点东西：点开工作区里的 <code>index.html</code>，把标题改成 <code>&lt;h1&gt;我的主页 · 手记&lt;/h1&gt;</code>，保存。',
      hint: 'edit index.html',
      check: c => c.files['index.html'] !== c.head['index.html'] && c.files['index.html'].includes('手记'),
    },
    {
      text: '提交它：<code>git add index.html</code>，再 <code>git commit -m "page: 换个标题"</code>。',
      hint: c => (c.head['index.html'] === c.index['index.html'] ? 'git add index.html' : 'git commit -m "page: 换个标题"'),
      check: c => c.message.includes('换个标题'),
    },
    {
      text: '推回 GitHub：<code>git push</code>。克隆时 Git 已经帮你设好上游，所以不用带参数。看上面右栏的 main 挪到了左栏的位置。',
      hint: 'git push',
      check: c => c.remote()?.refs.get('refs/heads/main') === c.tip,
    },
    {
      text: '开个分支做新样式：<code>git switch -c dark-mode</code>。',
      hint: 'git switch -c dark-mode',
      check: c => c.branch === 'dark-mode',
    },
    {
      text: '把标题改成 <code>&lt;h1&gt;我的主页 · 手记（深色版）&lt;/h1&gt;</code>，然后 add、commit，说明写 <code>page: 加一个深色版</code>。',
      hint: c => (c.files['index.html'] === c.head['index.html'] ? 'edit index.html' : c.files['index.html'] !== c.index['index.html'] ? 'git add index.html' : 'git commit -m "page: 加一个深色版"'),
      check: c => c.message.includes('深色'),
    },
    {
      text: '把新分支推上去：<code>git push -u origin dark-mode</code>。终端里会出现一条 GitHub 的提示，邀请你去开 Pull Request。',
      hint: 'git push -u origin dark-mode',
      check: c => c.remote()?.refs.has('refs/heads/dark-mode') && c.repo.config['branch.dark-mode.remote'] === 'origin',
    },
  ],
  done: '克隆 = 复制仓库 + 记住地址；推送 = 把自己的提交交给服务器。origin/main 是你电脑上对 GitHub 最后一次见面的记忆——下一课它就会过时。',
  chips: ['git status', 'git branch -a', 'git log --oneline --all', 'git remote -v'],
};

export const solution = [
  'git clone https://github.com/you/website',
  'cd website',
  'git remote -v',
  'git log --oneline',
  w => w.writeFile('index.html', '<h1>我的主页 · 手记</h1>\n'),
  'git add index.html',
  'git commit -m "page: 换个标题"',
  'git push',
  'git switch -c dark-mode',
  w => w.writeFile('index.html', '<h1>我的主页 · 手记（深色版）</h1>\n'),
  'git add index.html',
  'git commit -m "page: 加一个深色版"',
  'git push -u origin dark-mode',
];
