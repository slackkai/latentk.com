import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** 只从仓库测试目录和文章附件发现测试，不依赖 shell 的通配符展开。 */
export async function testFiles(root) {
  const files = [];
  async function visit(dir, content = false) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file, content);
      else if (entry.isFile() && /\.test\.(?:mjs|js)$/.test(entry.name)) {
        if (!content || path.relative(root, file).split(path.sep).includes('attachments')) files.push(file);
      }
    }
  }
  await visit(path.join(root, 'tests'));
  await visit(path.join(root, 'src/content'), true);
  return files.sort();
}
