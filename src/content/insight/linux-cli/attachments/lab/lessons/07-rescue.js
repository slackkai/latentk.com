/** 第 7 课：手滑之后怎么办。 */
export const config = {
  title: '第 7 课 · 手滑了',
  next: '接下来',
  intro: '这一课的文件夹已经乱了。你的工作是看清楚，再动手，而不是反过来。',
  setup(world) {
    world.ensure('~/项目');
    world.put('~/项目/说明.md', '# 项目\n\n还在写。\n');
    world.put('~/项目/笔记.md', '# 笔记\n\n重要。\n');
    world.put('~/项目/说明.md.bak', '# 项目\n\n旧版本，可以扔。\n');
    world.put('~/项目/数据.csv', '名字,分数\n小明,90\n');
    world.ensure('~/项目/临时');
    world.put('~/项目/临时/缓存.tmp', '垃圾\n');
    world.cwd = ['项目'];
  },
  tasks: [
    { text: '别急着删。先看清全貌：<code>tree</code>', hint: 'tree', check: c => c.ran('tree') },
    { text: '找出所有备份：<code>find . -name "*.bak"</code>', hint: 'find . -name "*.bak"', check: c => c.ran('find') },
    { text: '先阅读旧备份，读完再做决定：<code>cat 说明.md.bak</code>。这一步不会删除。', hint: 'cat 说明.md.bak', check: c => c.ran('cat', a => a === '说明.md.bak') },
    { text: '确认内容可以丢弃后，再单独执行：<code>rm 说明.md.bak</code>', hint: 'rm 说明.md.bak', check: c => !c.here.children['说明.md.bak'] && c.ran('rm') },
    { text: '删除临时目录前，先检查里面的内容：<code>cat 临时/缓存.tmp</code>', hint: 'cat 临时/缓存.tmp', check: c => c.ran('cat', a => a === '临时/缓存.tmp') },
    { text: '确认只含可丢弃的缓存后，递归删除：<code>rm -r 临时</code>', hint: 'rm -r 临时', check: c => !c.here.children['临时'] && c.ran('rm') },
    { text: '数据不该跟笔记混着。给它一个家：<code>mkdir 数据 && mv 数据.csv 数据/</code>', hint: 'mkdir 数据 && mv 数据.csv 数据/', check: c => c.here.children['数据']?.children['数据.csv'] },
    { text: '最后再看一次：<code>tree</code>', hint: 'tree', check: c => c.ran('tree') && c.here.children['数据'] },
  ],
  done: '出事时的顺序永远是：先 <code>ls</code> / <code>tree</code> / <code>cat</code> 看清，再 <code>rm</code>。终端没有回收站。',
  chips: ['tree', 'ls -l'],
};

export const solution = [
  'tree', 'find . -name "*.bak"', 'cat 说明.md.bak', 'rm 说明.md.bak',
  'cat 临时/缓存.tmp', 'rm -r 临时', 'mkdir 数据 && mv 数据.csv 数据/', 'tree',
];