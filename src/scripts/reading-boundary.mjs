/** Headings select a section. The measured reading region determines the TOC's end. */
export function boundaryState({ end, bottom, height, previous = 0 }) {
  const naturalBottom = bottom - previous;
  const shift = Math.min(0, end - naturalBottom);
  return { shift, opacity: Math.max(0, 1 + shift / Math.max(1, height)), past: end <= 0 };
}
export function bindReadingBoundary(toc, reading, view) {
  const controller = new view.AbortController();
  const { signal } = controller;
  const wide = view.matchMedia('(min-width: 1200px)');
  let frame = 0;
  const update = () => {
    frame = 0;
    if(signal.aborted)return;
    if(!wide.matches){toc.style.removeProperty('--toc-shift');toc.style.removeProperty('--toc-opacity');toc.classList.remove('is-past');return;}
    const rect=toc.getBoundingClientRect();
    const state=boundaryState({end:reading.getBoundingClientRect().bottom,bottom:rect.bottom,height:rect.height,previous:parseFloat(toc.style.getPropertyValue('--toc-shift'))||0});
    toc.style.setProperty('--toc-shift',state.shift.toFixed(1)+'px');
    toc.style.setProperty('--toc-opacity',state.opacity.toFixed(3));
    toc.classList.toggle('is-past',state.past);
  };
  const schedule=()=>{if(!frame)frame=view.requestAnimationFrame(update);};
  const observer='ResizeObserver' in view?new view.ResizeObserver(schedule):undefined;
  observer?.observe(reading);
  reading.addEventListener('toggle',schedule,{capture:true,signal});
  reading.addEventListener('load',schedule,{capture:true,signal});
  wide.addEventListener('change',schedule,{signal});
  update();
  return {update,dispose(){controller.abort();observer?.disconnect();view.cancelAnimationFrame(frame);}};
}
