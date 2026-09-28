/** 第 4 课：在一堆文件里找东西。 */
export const config = {
  title: '第 4 课 · 大海捞针',
  next: '第 5 课',
  intro: '三份笔记散在各处。不要用眼睛扫，用命令捞。',
  setup(world) {
    world.put('~/菜谱/红烧肉.md', '# 红烧肉\n\n糖色是关键。\n不要放番茄酱。\n');
    world.put('~/菜谱/番茄蛋.md', '# 番茄炒蛋\n\n先炒蛋，再下番茄。\n');
    world.put('~/日记/三月.md', '# 三月\n\n今天学会了在终端里找文件。\n番茄上市了。\n');
    world.put('~/日记/四月.md', '# 四月\n\n试了红烧，糖放多了。\n');
    world.ensure('~/菜谱/草稿');
  },
  tasks: [
    { text: '先看全貌：<code>tree</code>', hint: 'tree', check: c => c.ran('tree') },
    { text: '找出所有笔记：<code>find . -name "*.md"</code>', hint: 'find . -name "*.md"', check: c => c.ran('find') },
    { text: '哪几份提到了番茄？先猜一份：<code>grep 番茄 菜谱/番茄蛋.md</code>', hint: 'grep 番茄 菜谱/番茄蛋.md', check: c => c.ran('grep') },
    { text: '带上行号更好找：<code>grep -n 番茄 日记/三月.md</code>', hint: 'grep -n 番茄 日记/三月.md', check: c => c.ran('grep', a => a.includes('-n')) },
    { text: '只在菜谱目录里找草稿：<code>find 菜谱 -name "*"</code>', hint: 'find 菜谱 -name "*"', check: c => c.ran('find', a => a.startsWith('菜谱')) },
  ],
  done: '<code>find</code> 按名字找文件，<code>grep</code> 按内容找行。一个管「哪份文件」，一个管「哪一行」。',
  chips: ['tree', 'grep 糖 菜谱/红烧肉.md'],
};

export const solution = ['tree', 'find . -name "*.md"', 'grep 番茄 菜谱/番茄蛋.md', 'grep -n 番茄 日记/三月.md', 'find 菜谱 -name "*"'];