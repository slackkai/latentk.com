import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkNotebook from './remark-notebook.mjs';
import remarkDirectives from './remark-directives.mjs';
import rehypeBase from '../utils/rehype-base.mjs';
import rehypeNotes from './rehype-notes.mjs';

/**
 * Server-side article tooling uses the same notebook renderers as Astro and CMS.
 * @param {{base?: string, labels?: import('../i18n/zh').UI['md']}} [options]
 */
export async function createNotebookProcessor({ base = '/', labels } = {}) {
  return createMarkdownProcessor({
    remarkPlugins: [remarkMath, remarkDirective,
      [remarkNotebook, { labels }], [remarkDirectives, { labels }]],
    rehypePlugins: [rehypeKatex, rehypeNotes, [rehypeBase, { base }]],
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: true },
  });
}
