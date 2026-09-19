import { readingPath, readingStore, refreshBookmarkButtons } from './reading';

let cleanup: (() => void) | undefined;
function initLibrary() {
  cleanup?.();
  const root = document.getElementById('library-browser');
  if (!root) return;
  const grid = root.querySelector<HTMLElement>('#lib-grid')!;
  const workspace = root.querySelector<HTMLElement>('#library-workspace')!;
  const panel = root.querySelector<HTMLElement>('#library-preview')!;
  const content = root.querySelector<HTMLElement>('#library-preview-content')!;
  const input = root.querySelector<HTMLInputElement>('#lib-search')!;
  const status = root.querySelector<HTMLSelectElement>('#lib-status')!;
  const savedOnly = root.querySelector<HTMLInputElement>('#lib-saved-only')!;
  const count = root.querySelector<HTMLElement>('#lib-count')!;
  const empty = root.querySelector<HTMLElement>('#lib-empty')!;
  const random = root.querySelector<HTMLButtonElement>('#lib-random')!;
  const typeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-type]:is(button)')];
  const sortButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-sort]')];
  const items = [...grid.querySelectorAll<HTMLElement>('[data-library-item]')];
  const narrow = matchMedia('(max-width: 899px)');
  const controller = new AbortController(), { signal } = controller;
  let type = 'all';
  let selected: HTMLElement | null = null;

  function positionPanel() {
    if (!selected) return;
    if (narrow.matches) selected.after(panel);
    else workspace.append(panel);
  }
  function show(item: HTMLElement, userAction = false) {
    const button = item.querySelector<HTMLButtonElement>('[data-preview-template]')!;
    const template = document.getElementById(button.dataset.previewTemplate!) as HTMLTemplateElement | null;
    if (!template) return;
    selected = item;
    content.replaceChildren(template.content.cloneNode(true));
    items.forEach(el => {
      const active = el === selected;
      el.classList.toggle('is-previewing', active);
      el.querySelector('[data-preview-template]')?.setAttribute('aria-expanded', String(active));
    });
    panel.hidden = false; workspace.classList.add('has-preview'); positionPanel(); refreshBookmarkButtons();
    if (userAction && narrow.matches) {
      content.querySelector<HTMLElement>('h2')?.focus({ preventScroll:true });
      panel.scrollIntoView({ block:'nearest', behavior:'instant' });
    }
  }
  function close(focus = true) {
    if (focus) selected?.querySelector<HTMLButtonElement>('[data-preview-template]')?.focus({ preventScroll:true });
    items.forEach(item => { item.classList.remove('is-previewing'); item.querySelector('[data-preview-template]')?.setAttribute('aria-expanded','false'); });
    selected = null; panel.hidden = true; content.replaceChildren(); workspace.classList.remove('has-preview'); workspace.append(panel);
  }
  function apply() {
    const saved = new Set(readingStore.read().bookmarks.map(item => item.path));
    const query = input.value.trim().toLowerCase();
    const shown = items.filter(item => {
      const match = (type === 'all' || item.dataset.type === type) &&
        (status.value === 'all' || item.dataset.readingStatus === status.value) &&
        (!query || item.dataset.search!.includes(query)) &&
        (!savedOnly.checked || saved.has(readingPath(item.dataset.readingPath) ?? ''));
      item.hidden = !match;
      return match;
    });
    count.textContent = `${shown.length} / ${items.length} 项资料`;
    empty.hidden = shown.length > 0 || items.length === 0;
    random.disabled = shown.length === 0;
    if (selected?.hidden) shown.length ? show(shown[0]) : close(false);
  }
  function selectType(value: string) {
    type = value;
    typeButtons.forEach(button => { const active = button.dataset.type === type; button.classList.toggle('is-on',active); button.setAttribute('aria-pressed',String(active)); });
    apply();
  }
  typeButtons.forEach(button => button.addEventListener('click',()=>selectType(button.dataset.type!),{signal}));
  sortButtons.forEach(button => button.addEventListener('click',()=>{
    sortButtons.forEach(b => { b.classList.toggle('is-on',b===button); b.setAttribute('aria-pressed',String(b===button)); });
    const key = button.dataset.sort!;
    [...items].sort((a,b) => {
      const av=Number(a.dataset[key] ?? 0),bv=Number(b.dataset[key] ?? 0);
      return (key==='status' ? av-bv : bv-av) || Number(b.dataset.date)-Number(a.dataset.date);
    }).forEach(item=>grid.append(item));
    positionPanel();
  },{signal}));
  root.addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('[data-preview-template]');
    const item=button?.closest<HTMLElement>('[data-library-item]');
    if(item) show(item,true);
  },{signal});
  root.querySelector('#library-preview-close')!.addEventListener('click',()=>close(),{signal});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}},{signal});
  root.querySelector('#lib-clear')!.addEventListener('click',()=>{input.value='';status.value='all';savedOnly.checked=false;selectType('all');},{signal});
  input.addEventListener('input',apply,{signal}); status.addEventListener('change',apply,{signal}); savedOnly.addEventListener('change',apply,{signal});
  random.addEventListener('click',()=>{const visible=items.filter(item=>!item.hidden);if(visible.length) show(visible[Math.floor(Math.random()*visible.length)],true);},{signal});
  narrow.addEventListener('change',positionPanel,{signal});
  document.addEventListener('reading:change',apply,{signal});
  cleanup=()=>controller.abort();
  document.addEventListener('astro:before-swap',cleanup,{once:true,signal});
  apply();
}
initLibrary();
document.addEventListener('astro:page-load',initLibrary);
