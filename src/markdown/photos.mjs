/** retain linked images, rich captions and non-image content in photos. */
import { el, text } from './nodes.mjs';

const imageOf = node => node.type === 'image' ? node
  : node.type === 'link' && node.children?.length === 1 && node.children[0].type === 'image'
    ? node.children[0] : undefined;
const meaningful = nodes => nodes.some(node => node.type !== 'text' || node.value.trim());

export default function renderPhotos(node, attrs) {
    const children = [];
    let count = 0;
    for (const block of node.children) {
      if (block.type !== 'paragraph' || !block.children.some(imageOf)) {
        children.push(el('div', { className: ['photos-text'] }, [block]));
        continue;
      }
      let media;
      let caption = [];
      const flush = () => {
        if (!media) {
          if (meaningful(caption)) children.push(el('p', { className: ['photos-text'] }, caption));
        } else {
          const image = imageOf(media);
          const content = meaningful(caption) ? caption : [text(image.title || image.alt || '')];
          children.push(el('figure', { className: ['photo'] }, [media,
            ...(meaningful(content) ? [el('figcaption', {}, content)] : []),
          ]));
          count++;
        }
        caption = [];
      };
      for (const inline of block.children) {
        if (imageOf(inline)) { flush(); media = inline; }
        else caption.push(inline);
      }
      flush();
    }
    if (!count) return false;
    const value = Number.parseInt(attrs.cols, 10);
    const cols = Number.isFinite(value) ? Math.min(4, Math.max(1, value)) : count === 1 ? 1 : 2;
    const classes = ['photos', ...(count === 1 ? ['photos-single'] : []),
      ...('scatter' in attrs ? ['photos-scatter'] : [])];
    Object.assign(node, el('div', {
      className: classes, style: `--cols:${cols}`,
    }, children));
}
