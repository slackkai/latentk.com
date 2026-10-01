/** the trigger label excludes note content, so links never toggle notes. */
export function notePrefix(path = '') {
  if (!path) return 'note';
  let hash = 2166136261;
  for (const char of String(path)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 'note-' + (hash >>> 0).toString(36);
}
export default function rehypeNotes() {
  return (tree, file) => {
    const prefix = notePrefix(file?.path);
    let index = 0;
    const visit = node => {
      if (node.type === 'element' && node.tagName === 'label' && node.properties?.className?.includes('note-wrap')) {
        const [input, reference, content] = node.children;
        const id = `${prefix}-${++index}`;
        node.tagName = 'span';
        input.properties.id = id;
        input.properties.ariaLabel = `${input.properties.ariaLabel} ${index}`;
        input.properties.ariaControls = `${id}-body`;
        reference.tagName = 'label';
        reference.properties.htmlFor = [id];
        reference.children = [{ type: 'text', value: String(index) }];
        content.properties.id = `${id}-body`;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
