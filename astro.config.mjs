// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkAttachments from './src/markdown/remark-attachments.mjs';
import remarkNotebook from './src/markdown/remark-notebook.mjs';
import remarkDirectives from './src/markdown/remark-directives.mjs';
import rehypeKatex from 'rehype-katex';
import rehypeNotes from './src/markdown/rehype-notes.mjs';
import rehypeBase from './src/utils/rehype-base.mjs';
import attachments from './src/integrations/attachments.mjs';
import sections from './src/integrations/sections.mjs';
import { config, isEnabled } from './src/config';
import { t } from './src/i18n';
import { unified } from '@astrojs/markdown-remark';

const base = process.env.BASE_PATH || '/';

// https://astro.build/config
export default defineConfig({
  // GitHub Actions supplies the actual Pages origin and base path.
  site: process.env.SITE_URL || config.site.url,
  base,
  trailingSlash: 'always',
  compressHTML: true,
  // giscus requests the preview's public CSS/fonts from its own iframe origin.
  vite: { preview: { cors: { origin: 'https://giscus.app' } } },
  integrations: [attachments(), sections({disabled:[...Object.keys(config.sections).filter(key=>!isEnabled(key)), ...(!config.features.guestbook ? ['guestbook'] : []), ...(!config.features.cms ? ['admin'] : [])]}), mdx(), sitemap({ filter: (url) => {
    const section = new URL(url).pathname.slice(base.replace(/\/$/, '').length).split('/')[1];
    return section !== 'admin' && section !== '404' &&
      !(section === 'guestbook' && !config.features.guestbook) &&
      !(Object.hasOwn(config.sections, section) && !isEnabled(section));
  } })],
  markdown: {
    processor: unified({
      // Attachments next to the file, notebook flavoured native Markdown, then the :note[] / :::postit … directives (docs/SYNTAX.md).
      remarkPlugins: [remarkMath, remarkDirective, remarkAttachments, [remarkNotebook, { labels: t.md }], [remarkDirectives, { labels: t.md }]],
      rehypePlugins: [rehypeKatex, rehypeNotes, [rehypeBase, { base }]],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
