/** 第 1 课：你在哪，这里有什么。 */
export const config = {
  title: '第 1 课 · 你在哪，这里有什么',
  next: '第 2 课',
  intro: '这是浏览器里的一台小电脑，命令不会碰你的机器。\n点任务里的命令会填进终端；上面的卡片点一下，也会帮你填好 cd 或 cat。',
  setup(world) {
    world.put('~/桌面/待办.txt', '买咖啡\n回邮件\n');
    world.put('~/文档/简历.md', '# 简历\n\n会用终端的人。\n');
    world.put('~/文档/笔记/周一.md', '# 周一\n\n终端不是只能拿来装软件。\n');
    world.ensure('~/下载');
  },
  tasks: [
    { text: '先问自己站在哪：<code>pwd</code>', hint: 'pwd', check: c => c.ran('pwd') },
    { text: '看看这里有什么：<code>ls</code>', hint: 'ls', check: c => c.ran('ls') },
    { text: '走进文档：<code>cd 文档</code>', hint: 'cd 文档', check: c => c.cwd === '~/文档' },
    { text: '再看一次。目录变了，<code>ls</code> 看到的东西也变了。', hint: 'ls', check: c => c.cwd === '~/文档' && c.ran('ls') },
    { text: '读那份简历：<code>cat 简历.md</code>', hint: 'cat 简历.md', check: c => c.ran('cat') },
    { text: '笔记还在下一层。一次走两级：<code>cd ~/文档/笔记</code>', hint: 'cd ~/文档/笔记', check: c => c.cwd === '~/文档/笔记' },
    { text: '回到家：<code>cd</code> 什么都不跟，就是回家。', hint: 'cd', check: c => c.cwd === '~' },
    { text: '上一次在哪？<code>cd -</code>', hint: 'cd -', check: c => c.cwd === '~/文档/笔记' && c.ran('cd', a => a === '-') },
  ],
  done: '四个字就够出门了：<code>pwd</code> 问位置，<code>ls</code> 看周围，<code>cd</code> 走路，<code>cat</code> 读文件。',
  chips: ['pwd', 'ls', 'cd ..', 'cd ~'],
};

export const solution = ['pwd', 'ls', 'cd 文档', 'ls', 'cat 简历.md', 'cd ~/文档/笔记', 'cd', 'cd -'];