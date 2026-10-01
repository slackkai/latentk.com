import { getPosts, entryHref } from '../../utils/content';
import { withBase } from '../../utils/url';
import { tagSlug } from '../../utils/base-path.mjs';
export async function GET() {
  const items = await getPosts('library');
  return new Response(JSON.stringify(items.map(entry=>({
    title:entry.data.title,href:entryHref(entry),type:entry.data.type,author:entry.data.author,
    summary:entry.data.summary,url:entry.data.url,cover:entry.data.cover ? withBase(entry.data.cover) : undefined,
    rating:entry.data.rating || 0,status:entry.data.status,order:({reading:0,todo:1,done:2} as Record<string,number>)[entry.data.status || ''] ?? 3,
    date:entry.data.date.valueOf(),tags:entry.data.tags.map(label=>({label,href:withBase('/tags/'+tagSlug(label)+'/')})),
    search:[entry.data.title,entry.data.author,entry.data.summary,...entry.data.tags].filter(Boolean).join(' ').toLocaleLowerCase(),
  }))),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
