/** 第 6 课：区分输出重定向、数据管道与按退出码连接命令。 */
export const config = {
  title: '第 6 课 · 让文本流过小工具',
  next: '第 7 课',
  intro: '三封来信，两封谈会议。先预测筛选结果，再看中间文本，最后才计数。',
  setup(world) {
    world.put('~/来信/一.txt', '主题: 会议\n下周三见。\n');
    world.put('~/来信/二.txt', '主题: 账单\n电费 42。\n');
    world.put('~/来信/三.txt', '主题: 会议\n改到周四。\n');
  },
  tasks: [
    { text: '先读三封来信：<code>cat 来信/一.txt 来信/二.txt 来信/三.txt</code>', hint: 'cat 来信/一.txt 来信/二.txt 来信/三.txt', check: c => c.ran('cat', a => a.includes('三.txt')) },
    { text: '把文本送给 grep。预期只剩两行：<code>cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议"</code>', hint: 'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议"', check: c => c.ran('cat') && c.ran('grep', a => a === '会议') },
    { text: '把相同筛选结果保存到文件：<code>cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" > 会议.txt</code>', hint: 'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" > 会议.txt', check: c => c.here.children['会议.txt']?.content === '主题: 会议\n主题: 会议\n' },
    { text: '检查文件，再把文件内容交给 wc：<code>cat 会议.txt | wc -l</code>。应得到 2。', hint: 'cat 会议.txt | wc -l', check: c => c.ran('cat', a => a === '会议.txt') && c.ran('wc', a => a === '-l') },
    { text: '不落盘也能计数：<code>cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" | wc -l</code>', hint: 'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" | wc -l', check: c => c.ran('cat') && c.ran('grep') && c.ran('wc') },
    { text: '试试没有匹配：<code>grep "不存在" 会议.txt && echo "找到"</code>。右边不应执行；然后输入 <code>echo "检查完成"</code> 结束。', hint: 'grep "不存在" 会议.txt && echo "找到"', check: c => c.world.events.some(e => e.sh === 'grep' && e.status === 1) && c.ran('echo', a => a === '检查完成') },
  ],
  done: '<code>|</code> 传文本，<code>&gt;</code> 存文本，<code>&amp;&amp;</code> 检查是否成功再继续。结果有疑问时，从左到右逐段检查，不要只看最后一个数字。',
  chips: ['cat 会议.txt', 'echo "检查完成"', 'man grep'],
};

export const solution = [
  'cat 来信/一.txt 来信/二.txt 来信/三.txt',
  'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议"',
  'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" > 会议.txt',
  'cat 会议.txt | wc -l',
  'cat 来信/一.txt 来信/二.txt 来信/三.txt | grep "会议" | wc -l',
  'grep "不存在" 会议.txt && echo "找到"',
  'echo "检查完成"',
];
