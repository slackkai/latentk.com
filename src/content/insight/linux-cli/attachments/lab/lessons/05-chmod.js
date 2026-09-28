/** 第 5 课：权限是九个字符，不是玄学。 */
export const config = {
  title: '第 5 课 · 九个字符的门锁',
  next: '第 6 课',
  intro: 'rwxr-xr-x 看起来像乱码。拆开就是三个人，每人三把钥匙。',
  setup(world) {
    world.put('~/日记.txt', '今天的日记。不给别人看。\n');
    world.put('~/工具.sh', '#!/bin/bash\necho 你好\n', 'rw-r--r--');
    world.put('~/公告.txt', '周三停电。\n', 'rw-r--r--');
  },
  tasks: [
    { text: '先看三份文件的权限：<code>ls -l</code>', hint: 'ls -l', check: c => c.ran('ls', a => a.includes('l')) },
    { text: '日记不想被别人读。改成只有自己能读写：<code>chmod 600 日记.txt</code>', hint: 'chmod 600 日记.txt', check: c => c.here.children['日记.txt']?.mode === 'rw-------' },
    { text: '再看一眼，确认只剩你的 <code>rw</code>：<code>ls -l 日记.txt</code>', hint: 'ls -l 日记.txt', check: c => c.ran('ls', a => a.includes('日记')) },
    { text: '脚本想跑起来，缺的是可执行这一位：<code>chmod +x 工具.sh</code>', hint: 'chmod +x 工具.sh', check: c => c.here.children['工具.sh']?.mode.includes('x') },
    { text: '公告谁都能读，但你自己也不想再改它：<code>chmod 444 公告.txt</code>', hint: 'chmod 444 公告.txt', check: c => c.here.children['公告.txt']?.mode === 'r--r--r--' },
    { text: '试试写它：<code>echo "又来了" >> 公告.txt</code>。这次应该被拒绝。', hint: 'echo "又来了" >> 公告.txt', check: c => c.world.events.some(e => e.status !== 0 && e.line.includes('公告')) },
  ],
  done: '三个数字各管一类人：你、同组、其他人。4 是读，2 是写，1 是执行，加起来就是那一位。644 = 自己读写、别人只读。',
  chips: ['ls -l', 'man chmod'],
};

export const solution = ['ls -l', 'chmod 600 日记.txt', 'ls -l 日记.txt', 'chmod +x 工具.sh', 'chmod 444 公告.txt', 'echo "又来了" >> 公告.txt'];