/** 第 6 课：把小命令接成一句。沙盒不跑真正的管道，用 && 和重定向把同样的想法走一遍。 */
export const config = {
  title: '第 6 课 · 一条命令只做一件事',
  next: '第 7 课',
  intro: 'Unix 的手艺是把小工具接起来，而不是找一个大而全的命令。',
  setup(world) {
    world.put('~/来信/一.txt', '主题: 会议\n下周三见。\n');
    world.put('~/来信/二.txt', '主题: 账单\n电费 42。\n');
    world.put('~/来信/三.txt', '主题: 会议\n改到周四。\n');
  },
  tasks: [
    { text: '先确认有三封信：<code>ls 来信</code>', hint: 'ls 来信', check: c => c.ran('ls') },
    { text: '数一数：<code>ls 来信 > 清单.txt</code>，把名单存下来，而不是只看一眼。', hint: 'ls 来信 > 清单.txt', check: c => c.here.children['清单.txt']?.content.includes('一.txt') },
    { text: '两步接成一句，前一步成功才做后一步：<code>wc -l 清单.txt && cat 清单.txt</code>', hint: 'wc -l 清单.txt && cat 清单.txt', check: c => c.ran('wc') && c.ran('cat') },
    { text: '在第二封里找账单：<code>grep 账单 来信/二.txt</code>', hint: 'grep 账单 来信/二.txt', check: c => c.ran('grep') },
    { text: '命令自己也不用背。<code>man grep</code> 会告诉你它还能怎么用。', hint: 'man grep', check: c => c.ran('man') },
  ],
  done: '每个命令做一件小事：<code>ls</code> 列名字，<code>wc</code> 计数，<code>grep</code> 挑行。<code>&gt;</code> 把结果留下，<code>&amp;&amp;</code> 把两步串起来。真终端里还有一根竖线 <code>|</code>，把前一个的输出直接喂给后一个。',
  chips: ['man ls', 'cat 清单.txt'],
};

export const solution = ['ls 来信', 'ls 来信 > 清单.txt', 'wc -l 清单.txt && cat 清单.txt', 'grep 账单 来信/二.txt', 'man grep'];