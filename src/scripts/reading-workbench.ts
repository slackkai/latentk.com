import { readingPath, readingStore, notifyReadingChange, refreshBookmarkButtons } from './reading';

let cleanup: (() => void) | undefined;
function initWorkbench() {
  cleanup?.();
  const article = document.getElementById('reader-article');
  const body = document.getElementById('reader-content');
  const workbench = document.getElementById('reading-workbench');
  if (!article || !body || !workbench) return;
  const path = readingPath(article.dataset.readerPath);
  if (!path) return;
  const controller = new AbortController(), { signal } = controller;
  const size = document.getElementById('reader-size') as HTMLSelectElement;
  const width = document.getElementById('reader-width') as HTMLSelectElement;
  const focus = document.getElementById('reader-focus') as HTMLButtonElement;
  const resume = document.getElementById('reading-resume')!;
  const resumeLabel = document.getElementById('reading-resume-label')!;
  const announcement = document.getElementById('reader-announcement')!;
  const headings = [...body.querySelectorAll<HTMLElement>('h2[id],h3[id],h4[id]')];
  const previous = readingStore.read().positions[path];
  let engaged = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let layoutFrame = 0;

  function lineOffset() {
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 64;
    return Math.min(window.innerHeight * .5, headerHeight + workbench!.getBoundingClientRect().height + 30);
  }
  function updateOffset() { article!.style.setProperty('--reader-scroll-offset', `${lineOffset()}px`); }
  function syncPreferences() {
    const preferences = readingStore.read().preferences;
    article!.dataset.readerSize = preferences.size; article!.dataset.readerWidth = preferences.width;
    article!.classList.toggle('reader-focus', preferences.focus);
    size.value = preferences.size; width.value = preferences.width;
    focus.setAttribute('aria-pressed',String(preferences.focus)); focus.textContent=preferences.focus?'退出专注':'专注阅读';
    updateOffset();
  }
  function snapshot() {
    const top = body!.getBoundingClientRect().top + scrollY;
    const bottom = top + body!.offsetHeight;
    const cursor = scrollY + lineOffset();
    let heading: HTMLElement | undefined;
    let next: HTMLElement | undefined;
    for (let i=0;i<headings.length;i++) {
      if (headings[i].getBoundingClientRect().top+scrollY <= cursor) { heading=headings[i]; next=headings[i+1]; }
      else break;
    }
    const start = heading ? heading.getBoundingClientRect().top+scrollY : top;
    const end = next ? next.getBoundingClientRect().top+scrollY : bottom;
    return {
      progress: bottom <= scrollY+innerHeight-24 ? 1 : Math.max(0,Math.min(1,(cursor-top)/Math.max(1,bottom-top))),
      heading: heading?.id ?? '',
      fraction: Math.max(0,Math.min(1,(cursor-start)/Math.max(1,end-start))),
    };
  }
  function save() {
    if (!engaged || !body!.isConnected) return;
    const result = readingStore.savePosition(path!,snapshot());
    if (!result.persisted) refreshBookmarkButtons();
  }
  function restore(position: {heading:string;fraction:number;progress:number}) {
    const index = headings.findIndex(h=>h.id===position.heading);
    const top = body!.getBoundingClientRect().top+scrollY;
    let target = top + position.progress*body!.offsetHeight;
    if (index >= 0) {
      const start=headings[index].getBoundingClientRect().top+scrollY;
      const end=headings[index+1] ? headings[index+1].getBoundingClientRect().top+scrollY : top+body!.offsetHeight;
      target=start+position.fraction*(end-start);
    }
    window.scrollTo({top:Math.max(0,target-lineOffset()),behavior:'instant'});
  }
  function changePreferences(change: Parameters<typeof readingStore.setPreferences>[0]) {
    const position=snapshot();
    const reading=body!.getBoundingClientRect().top < lineOffset();
    readingStore.setPreferences(change); syncPreferences(); notifyReadingChange();
    cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{if(reading)restore(position);});
  }
  syncPreferences();
  if (previous && previous.progress>.03 && previous.progress<.98 && !location.hash) {
    const heading=headings.find(h=>h.id===previous.heading);
    resumeLabel.textContent=heading ? `上次读到：${heading.textContent}` : `上次读到正文约 ${Math.round(previous.progress*100)}%`;
    resume.hidden=false; updateOffset();
  }
  document.getElementById('reader-continue')!.addEventListener('click',()=>{
    if(!previous)return;
    resume.hidden=true;updateOffset();restore(previous);engaged=true;
    announcement.textContent='已回到上次阅读位置。';
    save();
  },{signal});
  document.getElementById('reader-start')!.addEventListener('click',()=>{
    resume.hidden=true;updateOffset();engaged=false;
    readingStore.savePosition(path,{progress:0,heading:'',fraction:0});
    window.scrollTo({top:0,behavior:'instant'});announcement.textContent='已清除这篇文章的阅读位置。';
  },{signal});
  size.addEventListener('change',()=>changePreferences({size:size.value==='large'?'large':'standard'}),{signal});
  width.addEventListener('change',()=>changePreferences({width:width.value==='narrow'?'narrow':'normal'}),{signal});
  focus.addEventListener('click',()=>changePreferences({focus:!article.classList.contains('reader-focus')}),{signal});
  window.addEventListener('scroll',()=>{
    // Opening an article at its top must not overwrite an earlier reading position.
    if(body.getBoundingClientRect().top < lineOffset()-30)engaged=true;
    if(!engaged)return;
    if(saveTimer===undefined) saveTimer=setTimeout(()=>{saveTimer=undefined;save();},800);
  },{passive:true,signal});
  window.addEventListener('resize',updateOffset,{signal});
  window.addEventListener('pagehide',save,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();},{signal});
  document.addEventListener('reading:change',syncPreferences,{signal});
  const resizeObserver=new ResizeObserver(updateOffset); resizeObserver.observe(workbench);
  cleanup=()=>{save();clearTimeout(saveTimer);cancelAnimationFrame(layoutFrame);resizeObserver.disconnect();controller.abort();};
  document.addEventListener('astro:before-swap',cleanup,{once:true,signal});
}
initWorkbench();
document.addEventListener('astro:page-load',initWorkbench);
