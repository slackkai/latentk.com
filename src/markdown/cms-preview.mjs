/**
 * Browser entry for the CMS preview (bundled by scripts/prepare-cms.mjs into
 * public/admin/vendor/notebook-markdown.js). It runs the same remark/rehype pipeline as
 * astro.config.mjs, so math, footnote margin notes, quote sources and every directive preview
 * like the published page. Relative URLs are left alone: public/admin/previews.js resolves them
 * through the CMS so unsaved uploads show too. The result is sanitised because the preview
 * frame shares the admin origin (and its GitHub token).
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeNotes from './rehype-notes.mjs';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import DOMPurify from 'dompurify';
import remarkNotebook from './remark-notebook.mjs';
import remarkDirectives from './remark-directives.mjs';
import { el, text, walk } from './directives.mjs';
import { t } from '../i18n';
import { config } from '../config';
import { localizeCms } from '../i18n/cms.mjs';
export const localizeEditor = value => localizeCms(value,config.lang);
export const previewLabels = {sections:Object.fromEntries(Object.entries(config.sections).map(([key,value])=>[key,value.label])),labels:{...t.projects.status,...t.library.types,...t.library.status,...t.academic.kinds},ui:{untitled:t.home.untitled,updated:t.common.updated,draft:config.lang==='zh'?'草稿':'Draft',commentsOff:config.lang==='zh'?'评论关闭':'Comments off',reviewed:config.lang==='zh'?'资源核验':'Reviewed',empty:config.lang==='zh'?'正文尚未填写，在左侧开始写作即可实时预览。':'Start writing on the left to preview your content.',links:config.lang==='zh'?'相关链接':'Related links',done:t.library.status.done}};
import { mountNotes } from '../scripts/notes.mjs';
export function enhance(root) { return root ? mountNotes(root, root.ownerDocument.defaultView, {read:t.md.readNote,expand:t.md.note}) : () => {}; }

export async function highlight(root) {
  if (!root?.querySelector('pre > code')) return;
  const code = await import('./cms-code.mjs');
  await code.highlight(root);
}

/** ::embed{snippet=…} reads a file at build time; the preview shows where it will appear. */
function remarkSnippetPlaceholder() {
  return tree => walk(tree, node => {
    if (node.type !== 'leafDirective' || node.name !== 'embed' || !node.attributes?.snippet) return;
    Object.assign(node, el('div', { className: ['cms-snippet'] }, [text(`HTML 片段 ${node.attributes.snippet} · 发布后显示`)]));
  });
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSmartypants)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkSnippetPlaceholder)
  .use(remarkNotebook, { labels: t.md })
  .use(remarkDirectives, { labels: t.md, warn: () => {} })
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypeNotes)
  .use(rehypeRaw)
  .use(rehypeStringify);

const PURIFY = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'loading', 'playsinline', 'autoplay', 'muted', 'loop'],
  FORBID_ATTR: ['srcdoc'],
  RETURN_DOM_FRAGMENT: true,
};

/** Markdown body → sanitised HTML string. */
export function render(markdown) {
  try {
    const fragment = DOMPurify.sanitize(String(processor.processSync(String(markdown ?? ''))), PURIFY);
    // Embedded documents must never execute on the admin origin. A relative page needs
    // a published URL; getAsset cannot reconstruct a folder containing HTML/JS assets.
    for (const frame of fragment.querySelectorAll('iframe')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'cms-snippet';
      placeholder.textContent = `嵌入页面 ${frame.getAttribute('src') ?? ''} · 发布后显示`;
      frame.replaceWith(placeholder);
    }
    for (const link of fragment.querySelectorAll('a[target="_blank"]')) link.setAttribute('rel', 'noopener noreferrer');
    const wrapper = document.createElement('div');
    wrapper.append(fragment);
    return wrapper.innerHTML;
  } catch (error) {
    const pre = document.createElement('pre');
    pre.className = 'cms-render-error';
    pre.textContent = `预览渲染失败：${error?.message ?? error}`;
    return pre.outerHTML;
  }
}
