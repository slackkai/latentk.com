/** 第 3 课：看懂 ls -l，以及那些点开头的文件。 */
const NOTES = `# 阅读清单

- 终端入门
- 权限
- 管道和重定向
- 正则
`;

export const config = {
  title: '第 3 课 · 把目录看清楚',
  next: '第 4 课',
  intro: 'ls 默认很客气，只给你名字。这一课让它把话说全。',
  setup(world) {
    world.ensure('~/笔记');
    world.put('~/笔记/阅读.md', NOTES);
    world.put('~/笔记/.秘密', '其实没有秘密，只是名字以点开头。\n');
    world.put('~/笔记/很长的日志.txt', Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 行：什么都没发生。`).join('\n') + '\n');
    world.cwd = ['笔记'];
  },
  tasks: [
    { text: '普通的 <code>ls</code> 只给名字。', hint: 'ls', check: c => c.ran('ls', a => !a.includes('-')) },
    { text: '加上长格式：<code>ls -l</code>。每一行开头那一串 <code>-</code> 和字母，就是权限。', hint: 'ls -l', check: c => c.ran('ls', a => a.includes('l')) },
    { text: '目录里还藏着一个点开头的文件。<code>ls -a</code>', hint: 'ls -a', check: c => c.ran('ls', a => a.includes('a')) },
    { text: '四十行的日志不必全看。只要头：<code>head -n 3 很长的日志.txt</code>', hint: 'head -n 3 很长的日志.txt', check: c => c.ran('head') },
    { text: '只要尾：<code>tail -n 2 很长的日志.txt</code>', hint: 'tail -n 2 很长的日志.txt', check: c => c.ran('tail') },
    { text: '这份阅读清单有多少行？<code>wc -l 阅读.md</code>', hint: 'wc -l 阅读.md', check: c => c.ran('wc') },
  ],
  done: '记住三个开关：<code>-l</code> 看详情，<code>-a</code> 看隐藏，<code>head</code> / <code>tail</code> 只看一头一尾。',
  chips: ['ls -la', 'cat .秘密'],
};

export const solution = ['ls', 'ls -l', 'ls -a', 'head -n 3 很长的日志.txt', 'tail -n 2 很长的日志.txt', 'wc -l 阅读.md'];