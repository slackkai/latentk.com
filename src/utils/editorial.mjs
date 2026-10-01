/** Pure editorial rules shared by listings and article pages. */
export function readingStats(body) {
  if (!body) return { words: 0, minutes: 0 };
  const text = body
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ' ')
    .replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\{[^}\n]*\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) ?? []).length;
  const latin = (text.replace(/[一-鿿㐀-䶿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return { words: cjk + latin, minutes: Math.max(1, Math.ceil(cjk / 400 + latin / 200)) };
}

/** Recommend shared topics rather than unrelated posts from the same section. */
export function relatedTo(current, pool, limit = 3) {
  const tags = new Set(current.data.tags);
  return pool
    .filter(e => !(e.collection === current.collection && e.id === current.id) && !e.data.draft)
    .map(e => ({ e, shared: [...new Set(e.data.tags)].filter(tag => tags.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared ||
      Number(b.e.collection === current.collection) - Number(a.e.collection === current.collection) ||
      b.e.data.date.valueOf() - a.e.data.date.valueOf() || a.e.id.localeCompare(b.e.id))
    .slice(0, Math.max(0, limit))
    .map(({ e }) => e);
}
