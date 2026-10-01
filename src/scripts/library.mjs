/** Lightweight catalog filtering; only the current page's cards enter the DOM. */
export function mountLibrary(root, view) {
  const controller = new view.AbortController();
  const { signal } = controller;
  const grid = root.querySelector('#lib-grid');
  const template = root.querySelector('#lib-card-template');
  const input = root.querySelector('#lib-search');
  const empty = root.querySelector('#lib-empty');
  const pagination = root.querySelector('[data-library-pagination]');
  const size = Number(root.dataset.pageSize);
  const labels = JSON.parse(root.dataset.labels);
  let catalog, loading, revision=0, current=1, type='all', sort='date', query='', pickTimer;
  const read = async () => {
    if (catalog) return catalog;
    loading ??= view.fetch(root.dataset.catalog,{signal}).then(response=>{if(!response.ok)throw Error('catalog');return response.json();});
    try { catalog = await loading; return catalog; } catch(error) { loading=undefined; throw error; }
  };
  function card(entry) {
    const wrapper = view.document.createElement('div');
    const article = template.content.firstElementChild.cloneNode(true);
    article.classList.remove('reveal');
    article.style.setProperty('--r','0deg');
    const optional = (selector,value) => { const el=article.querySelector(selector); if(value)el.textContent=value; else el?.remove(); };
    const title = article.querySelector('.lib-title a'); title.textContent=entry.title; title.href=entry.href;
    article.querySelector('.lib-title').removeAttribute('data-astro-transition-scope');
    article.querySelector('.lib-type').textContent=(labels.typeEmoji[entry.type] || '')+' '+(labels.types[entry.type] || entry.type);
    optional('.lib-author',entry.author); optional('.lib-summary',entry.summary); optional('.lib-status',labels.status[entry.status]);
    const cover=article.querySelector('.lib-cover'); if(entry.cover){cover.src=entry.cover;}else cover.remove();
    const rating=article.querySelector('.lib-rating'); if(entry.rating){rating.textContent='★'.repeat(entry.rating)+'☆'.repeat(5-entry.rating);rating.setAttribute('aria-label',`${entry.rating} / 5`);}else rating.remove();
    const tags=article.querySelector('.tags'), tag=tags.firstElementChild;
    tags.replaceChildren(...entry.tags.map(({label,href})=>{const li=tag.cloneNode(true),a=li.querySelector('a');a.textContent='#'+label;a.href=href;return li;}));
    const link=article.querySelector('.lib-foot > a');if(entry.url)link.href=entry.url;else link.remove();
    wrapper.append(article); return wrapper;
  }
  async function apply() {
    const version=++revision;
    try {
      const all = await read(); if(signal.aborted || version!==revision)return;
      const selected=all.filter(item=>(type==='all'||item.type===type)&&(!query||item.search.includes(query)));
      selected.sort((a,b)=>sort==='status'?a.order-b.order:sort==='rating'?b.rating-a.rating:b.date-a.date);
      const pages=Math.max(1,Math.ceil(selected.length/size));current=Math.max(1,Math.min(current,pages));
      grid.replaceChildren(...selected.slice((current-1)*size,current*size).map(card));
      empty.hidden=selected.length>0;
      const random=root.querySelector('#lib-random');if(random)random.disabled=selected.length===0;
      const status=pagination.querySelector('[data-page-status]');status.textContent=`${current} / ${pages}`;
      for(const direction of ['prev','next']){const a=pagination.querySelector(`[data-page-${direction}]`);a.hidden=direction==='prev'?current===1:current===pages;a.href='#lib-grid';}
      pagination.hidden=pages===1;
    } catch(error) { if(!signal.aborted){empty.textContent=root.dataset.error;empty.hidden=false;} }
  }
  for(const selector of ['button[data-type]','button[data-sort]']) root.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{
    root.querySelectorAll(selector).forEach(other=>{other.classList.toggle('is-on',other===button);other.setAttribute('aria-pressed',String(other===button));});
    if(selector==='button[data-type]')type=button.dataset.type;else sort=button.dataset.sort;
    current=1;apply();
  },{signal}));
  input?.addEventListener('input',()=>{query=input.value.trim().toLocaleLowerCase();current=1;apply();},{signal});
  pagination.addEventListener('click',event=>{
    const link=event.target.closest('[data-page-prev],[data-page-next]');if(!link||!catalog)return;
    event.preventDefault();current+=link.hasAttribute('data-page-prev')?-1:1;apply();
  },{signal});
  root.querySelector('#lib-random')?.addEventListener('click',async()=>{
    try {
      const all=await read();if(signal.aborted)return;
      const selected=all.filter(item=>(type==='all'||item.type===type)&&(!query||item.search.includes(query)));
      selected.sort((a,b)=>sort==='status'?a.order-b.order:sort==='rating'?b.rating-a.rating:b.date-a.date);
      if(!selected.length)return;
      const index=Math.floor(Math.random()*selected.length),chosen=selected[index];current=Math.floor(index/size)+1;
      await apply();if(signal.aborted)return;
      const paper=[...grid.querySelectorAll('.lib-card')].find(card=>card.querySelector('.lib-title a').getAttribute('href')===chosen.href);
      if(!paper)return;
      grid.querySelectorAll('[data-picked]').forEach(card=>card.removeAttribute('data-picked'));
      view.clearTimeout(pickTimer);paper.setAttribute('data-picked','');
      paper.scrollIntoView({behavior:view.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
      pickTimer=view.setTimeout(()=>paper.removeAttribute('data-picked'),2500);
    } catch(error) { if(!signal.aborted){empty.textContent=root.dataset.error;empty.hidden=false;} }
  },{signal});
  return ()=>{controller.abort();view.clearTimeout(pickTimer);};
}
