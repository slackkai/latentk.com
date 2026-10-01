import type { CollectionEntry } from 'astro:content';
import { getPosts, getAllTagged, getSeries, readingStats, gitLastModified, relatedTo, entryHref } from './content';
import { config } from '../config';

type ArticleCollection = 'academic' | 'insight' | 'library';

/** One route contract for long-form collections; project documents keep their own hierarchy. */
export async function getArticlePaths<C extends ArticleCollection>(collection: C) {
  const posts = await getPosts(collection);
  return posts.map((post, index) => ({
    params: { id: post.id },
    props: { post, prev: posts[index + 1], next: posts[index - 1] },
  }));
}

export async function articleContext(post: CollectionEntry<ArticleCollection>) {
  const [modified, pool, seriesEntries] = await Promise.all([
    config.features.postMeta ? gitLastModified(post.filePath) : null,
    config.features.relatedPosts ? getAllTagged() : [],
    'series' in post.data && post.data.series ? getSeries(post.data.series.name) : [],
  ]);
  const series = 'series' in post.data && post.data.series
    ? { name: post.data.series.name, entries: seriesEntries, current: post } : undefined;
  return {
    meta: { ...readingStats(post.body), modified },
    related: relatedTo(post, pool),
    series,
  };
}

export function articleNeighbor(post?: CollectionEntry<ArticleCollection>) {
  return post && { href: entryHref(post), title: post.data.title };
}
