/** 第 5 课：你克隆之后，别人也往 GitHub 推了东西。冲突的不是文件，是时间线。 */
const REMOTE = 'https://github.com/you/site';
const YOU = { name: 'you', email: 'you@example.com' };

export const config = {
  title: '第 5 课 · 别人也在推：fetch、pull 和被拒绝的 push',
  cwd: 'site',
  panels: ['remote'],
  remote: REMOTE,
  next: '第 6 课',
  intro: '你已经把仓库克隆到了 ~/site。\n先点下面那个「队友推送了一个提交」按钮，模拟世界上另一个人动了同一个仓库。',
  setup(world, script) {
    world.createRemote(REMOTE, {
      commits: [{ author: YOU, files: { 'index.html': '<h1>站点</h1>\n<p>欢迎光临。</p>\n<footer>© 2026 Kai</footer>\n' }, message: 'site: 初版' }],
    });
    script(world, [`git clone ${REMOTE}`, 'cd site']);
  },
  actions: [
    {
      id: 'teammate',
      label: '📨 队友推送了一个提交',
      title: '模拟另一个开发者向 GitHub 推送',
      when: c => c.world.cwd === 'site',
      once: true,
      run: world => {
        world.remoteCommit(REMOTE, {
          files: { 'index.html': old => old.replace('© 2026 Kai', '© 2026 Kai & Lin') },
          message: 'site: 加上共同作者',
        });
        return '队友把 footer 改好并推到了 GitHub。你的电脑还不知道——origin/main 还是克隆时记住的旧位置。';
      },
    },
  ],
  tasks: [
    {
      text: '点上面的「📨 队友推送了一个提交」按钮。',
      hint: null,
      check: c => c.acted('teammate'),
    },
    {
      text: '打听一下消息：<code>git fetch</code>。它只更新 origin/main 这个书签，不动你的文件和分支。',
      hint: 'git fetch',
      check: c => c.acted('teammate') && c.ran('fetch'),
    },
    {
      text: '<code>git status</code>：现在 Git 知道你的 main 落后 origin/main 一个提交了。',
      hint: 'git status',
      check: c => c.ran('status'),
    },
    {
      text: '你手头也有活：把标题改成 <code>&lt;h1&gt;我的站点&lt;/h1&gt;</code>，然后 add、commit，说明写 <code>site: 更名</code>。现在两边各多了一个提交。',
      hint: c => (c.files['index.html'] === c.head['index.html'] ? 'edit index.html' : c.files['index.html'] !== c.index['index.html'] ? 'git add index.html' : 'git commit -m "site: 更名"'),
      check: c => c.message.includes('更名'),
    },
    {
      text: '直接 <code>git push</code> 试试。会被拒绝：你的 main 还没接上 GitHub 上多出来的那段历史，硬推会盖掉别人的提交。',
      hint: 'git push',
      check: c => c.tried('push'),
    },
    {
      text: '把两条线接起来：<code>git pull --rebase</code>。它先 fetch，再把你还没分享的提交重放到队友的提交上面。内容还在，提交身份会变。',
      hint: 'git pull --rebase',
      check: c => c.repo.objects.get(c.tip)?.parents[0] === c.remote()?.refs.get('refs/heads/main'),
    },
    {
      text: '<code>cat index.html</code>：footer 里已经有队友加的 &amp; Lin，标题也还是你改的。',
      hint: 'cat index.html',
      check: c => c.sh('cat') && c.files['index.html'].includes('Lin') && c.files['index.html'].includes('我的站点'),
    },
    {
      text: '<code>git log --oneline --graph</code>：历史是一条直线，你的提交在最上面。',
      hint: 'git log --oneline --graph',
      check: c => c.ran('log', args => args.includes('--graph')),
    },
    {
      text: '再推一次：<code>git push</code>。这次成功了，两栏的 main 指向同一个提交。',
      hint: 'git push',
      check: c => c.remote()?.refs.get('refs/heads/main') === c.tip,
    },
  ],
  done: '这次被拒绝是因为历史分叉：先 fetch，看清两条线，再合并或变基，最后 push。认证失败和分支保护是另一类报错，读完再决定。',
  chips: ['git fetch', 'git status', 'git log --oneline --all', 'git remote -v'],
};

export const solution = [
  { action: 'teammate' },
  'git fetch',
  'git status',
  w => w.writeFile('index.html', '<h1>我的站点</h1>\n<p>欢迎光临。</p>\n<footer>© 2026 Kai</footer>\n'),
  'git add index.html',
  'git commit -m "site: 更名"',
  { cmd: 'git push', fails: true },
  'git pull --rebase',
  'cat index.html',
  'git log --oneline --graph',
  'git push',
];
