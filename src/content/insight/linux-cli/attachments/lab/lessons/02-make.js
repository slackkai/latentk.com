/** 第 2 课：建、写、改名、删。 */
export const config = {
  title: '第 2 课 · 建一个属于你的角落',
  next: '第 3 课',
  intro: '家目录是空的。这一课结束时，你应该有一个小小的项目文件夹。',
  tasks: [
    { text: '建一个项目目录：<code>mkdir 项目</code>', hint: 'mkdir 项目', check: c => c.world.tree.children['项目']?.kind === 'dir' },
    { text: '进去：<code>cd 项目</code>', hint: 'cd 项目', check: c => c.cwd === '~/项目' },
    { text: '写第一行：<code>echo "# 我的项目" > 说明.md</code>。一个 &gt; 是覆盖写。', hint: 'echo "# 我的项目" > 说明.md', check: c => c.here.children['说明.md']?.content.includes('我的项目') },
    { text: '再补一行，这次用两个 &gt;，追加而不是覆盖：<code>echo "从终端建的。" >> 说明.md</code>', hint: 'echo "从终端建的。" >> 说明.md', check: c => (c.here.children['说明.md']?.content.match(/\n/g) ?? []).length >= 2 },
    { text: '读回来确认：<code>cat 说明.md</code>', hint: 'cat 说明.md', check: c => c.ran('cat') },
    { text: '复制一份备份：<code>cp 说明.md 说明.bak</code>', hint: 'cp 说明.md 说明.bak', check: c => c.here.children['说明.bak'] },
    { text: '备份这个名字不好。改掉：<code>mv 说明.bak 备份.md</code>', hint: 'mv 说明.bak 备份.md', check: c => c.here.children['备份.md'] && !c.here.children['说明.bak'] },
    { text: '其实不需要备份。删掉：<code>rm 备份.md</code>', hint: 'rm 备份.md', check: c => !c.here.children['备份.md'] && c.ran('rm') },
  ],
  done: '写文件的关键只有一个符号：<code>&gt;</code> 覆盖，<code>&gt;&gt;</code> 追加。<code>mv</code> 既能搬家也能改名。',
  chips: ['ls', 'cat 说明.md', 'edit 说明.md'],
};

export const solution = [
  'mkdir 项目', 'cd 项目',
  'echo "# 我的项目" > 说明.md',
  'echo "从终端建的。" >> 说明.md',
  'cat 说明.md', 'cp 说明.md 说明.bak', 'mv 说明.bak 备份.md', 'rm 备份.md',
];