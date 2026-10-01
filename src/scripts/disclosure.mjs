/** Mouse, Enter and Space share a native summary click. Closing waits for the motion. */
export function animateDisclosure(details,view,onChange=()=>{}) {
  const summary=details.querySelector(':scope > summary'),content=summary?.nextElementSibling;if(!summary||!content)return()=>{};
  const controller=new view.AbortController(),{signal}=controller,reduced=view.matchMedia('(prefers-reduced-motion: reduce)');
  let desired=details.open,motion,fade,revision=0;
  const cancel=()=>{motion?.cancel();fade?.cancel();motion=fade=undefined;};
  const clean=()=>{content.style.removeProperty('overflow');details.classList.remove('is-disclosing');content.inert=!details.open;};
  const finish=()=>{cancel();details.open=desired;clean();onChange();};
  summary.addEventListener('click',event=>{
    event.preventDefault();desired=!desired;const version=++revision,from=details.open?content.getBoundingClientRect().height:0;
    const fromMargin=details.open?view.getComputedStyle(content).marginTop:'0px';
    const fromOpacity=details.open?(parseFloat(view.getComputedStyle(content).opacity)||0):0;cancel();
    if(reduced.matches||typeof content.animate!=='function'){finish();return;}
    details.open=true;onChange();const to=desired?content.getBoundingClientRect().height:0;
    const toMargin=desired?view.getComputedStyle(content).marginTop:'0px';
    content.inert=!desired;content.style.overflow='hidden';details.classList.add('is-disclosing');
    // Keep the summary and its ink/focus decorations outside the clipping region.
    motion=content.animate([{height:from+'px',marginTop:fromMargin},{height:to+'px',marginTop:toMargin}],{duration:230,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    fade=content.animate([{opacity:fromOpacity},{opacity:desired?1:0}],{duration:180,easing:'ease-out',fill:'forwards'});
    motion.finished.then(()=>{if(version===revision&&!signal.aborted)finish();}).catch(()=>{});
  },{signal});
  details.addEventListener('toggle',()=>{if(!motion){desired=details.open;clean();}},{signal});
  reduced.addEventListener('change',()=>{if(reduced.matches&&motion){++revision;finish();}},{signal});
  view.addEventListener('resize',()=>{if(motion){++revision;finish();}},{signal});
  return()=>{++revision;controller.abort();cancel();clean();};
}
