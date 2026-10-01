/** Fit in place; fullscreen/popover never moves or reloads the iframe. */
export function fitEmbed(frame,view) {
  const mode=frame.dataset.embedMode || (frame.dataset.fixed?'fixed':'viewport');
  if(frame.dataset.embedExpanded==='true')return;
  if(mode==='fixed')return;
  let cap=Math.max(220,Math.floor((view.visualViewport?.height || view.innerHeight)-112));
  if(mode==='screen'){
    const figure=frame.closest('.media-frame'),header=view.document.querySelector('.site-header');
    const style=figure?view.getComputedStyle(figure):null,caption=figure?.querySelector('figcaption');
    const captionHeight=caption?caption.getBoundingClientRect().height+(parseFloat(view.getComputedStyle(caption).marginTop)||0):0;
    const inset=(parseFloat(style?.paddingTop)||0)+(parseFloat(style?.paddingBottom)||0)+(parseFloat(style?.borderTopWidth)||0)+(parseFloat(style?.borderBottomWidth)||0);
    const headerHeight=header?.dataset.autoHide==='true'?0:(header?.offsetHeight || 0);
    cap=Math.max(160,Math.floor((view.visualViewport?.height || view.innerHeight)-headerHeight-12-inset-captionHeight));
  }
  const doc=frame.contentDocument;
  if(!doc?.documentElement){frame.style.height=cap+'px';return;}
  const body=doc.body,content=body?Math.max(body.scrollHeight,body.getBoundingClientRect().height):doc.documentElement.scrollHeight;
  const height=mode==='screen'?cap:mode==='content'?Math.ceil(content)+2:Math.min(Math.ceil(content)+2,cap);
  doc.documentElement.style.overflow=content+2>height?'auto':'hidden';
  if(height>0&&frame.style.height!==height+'px')frame.style.height=height+'px';
}
export function mountEmbed(frame,view) {
  const figure=frame.closest('.media-frame');if(!figure)return()=>{};
  const controller=new view.AbortController(),{signal}=controller;
  const ui=JSON.parse(view.document.body.dataset.viewerLabels || '{}');
  const toolbar=view.document.createElement('div');toolbar.className='embed-tools';
  const icons={fit:'M4 8V4h16v4 M4 16v4h16v-4 M12 7v10 M9 10l3-3 3 3 M9 14l3 3 3-3',full:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',exit:'M3 8h5V3 M21 8h-5V3 M8 21v-5H3 M16 21v-5h5'};
  const label=(button,text,icon)=>{
    button.title=text;button.setAttribute('aria-label',text);
    button.querySelector('path').setAttribute('d',icons[icon]);
  };
  const button=(text,icon,action)=>{
    const b=view.document.createElement('button');b.type='button';b.className='hand-btn small';
    const svg=view.document.createElementNS('http://www.w3.org/2000/svg','svg'),path=view.document.createElementNS(svg.namespaceURI,'path');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.append(path);b.append(svg);label(b,text,icon);
    b.addEventListener('click',action,{signal});toolbar.append(b);return b;
  };
  let expanded=false,kind,oldOverflow,oldRootOverflow,previousFocus,inert=[];
  const initialMode=frame.dataset.fixed?'fixed':'viewport',initialHeight=frame.style.height;
  const requestFit=()=>frame.dispatchEvent(new view.Event('embed:resize'));
  const align=()=>{
    const header=view.document.querySelector('.site-header');
    const headerHeight=header?.dataset.autoHide==='true'?0:(header?.offsetHeight || 0);
    const top=figure.getBoundingClientRect().top+view.scrollY-headerHeight-6;
    view.scrollTo({top:Math.max(0,top),behavior:'instant'});
    view.document.dispatchEvent(new view.Event('embed:align'));
  };
  const fitButton=button(ui.fitViewport || 'Fit to screen','fit',()=>{
    const fitted=frame.dataset.embedMode!=='screen';
    frame.dataset.embedMode=fitted?'screen':initialMode;
    fitButton.setAttribute('aria-pressed',String(fitted));
    label(fitButton,fitted?(ui.restoreHeight || 'Restore height'):(ui.fitViewport || 'Fit to screen'),'fit');
    if(!fitted&&initialMode==='fixed')frame.style.height=initialHeight;
    requestFit();
    if(fitted)align();
  });
  const setExpanded=value=>{
    expanded=value;figure.classList.toggle('embed-expanded',value);frame.dataset.embedExpanded=String(value);
    label(fullButton,value?(ui.exitFullscreen || 'Exit fullscreen'):(ui.fullscreen || 'Fullscreen'),value?'exit':'full');
    fullButton.setAttribute('aria-pressed',String(value));fitButton.disabled=value;
    if(value){
      previousFocus=view.document.activeElement;oldOverflow=view.document.body.style.overflow;view.document.body.style.overflow='hidden';
      oldRootOverflow=frame.contentDocument?.documentElement.style.overflow;
      if(frame.contentDocument)frame.contentDocument.documentElement.style.overflow='auto';
      for(let node=figure;node.parentElement;node=node.parentElement){for(const sibling of node.parentElement.children)if(sibling!==node){inert.push([sibling,sibling.inert]);sibling.inert=true;}if(node.parentElement===view.document.body)break;}
      figure.setAttribute('role','dialog');figure.setAttribute('aria-modal','true');figure.setAttribute('aria-label',figure.querySelector('figcaption')?.textContent || frame.title);fullButton.focus({preventScroll:true});
    }else{
      for(const[node,value]of inert)node.inert=value;inert=[];
      view.document.body.style.overflow=oldOverflow || '';figure.removeAttribute('role');figure.removeAttribute('aria-modal');figure.removeAttribute('aria-label');
      if(frame.contentDocument)frame.contentDocument.documentElement.style.overflow=oldRootOverflow || '';
      requestFit();previousFocus?.focus({preventScroll:true});
    }
  };
  const exit=async()=>{
    if(!expanded)return;
    if(kind==='native'&&view.document.fullscreenElement===figure)await view.document.exitFullscreen();
    else {if(kind==='popover')figure.hidePopover();figure.removeAttribute('popover');setExpanded(false);}
  };
  const fullButton=button(ui.fullscreen || 'Fullscreen','full',async()=>{
    if(expanded){await exit();return;}
    // A top-layer expansion works inside hosted browsers and preserves lesson state.
    if(typeof figure.showPopover==='function'){kind='popover';figure.setAttribute('popover','manual');figure.showPopover();setExpanded(true);return;}
    try {
      if(typeof figure.requestFullscreen!=='function')throw Error('unavailable');
      await figure.requestFullscreen();kind='native';setExpanded(true);
    }catch{
      view.open(frame.src,'_blank','noopener');
    }
  });
  figure.insertBefore(toolbar,frame);
  frame.dataset.embedMode=initialMode;
  fitButton.setAttribute('aria-pressed','false');fullButton.setAttribute('aria-pressed','false');
  frame.setAttribute('allowfullscreen','');
  view.document.addEventListener('fullscreenchange',()=>{if(kind==='native'&&expanded&&view.document.fullscreenElement!==figure)setExpanded(false);},{signal});
  const escape=event=>{if(event.key==='Escape'&&expanded&&kind==='popover'){event.preventDefault();exit();}};
  view.document.addEventListener('keydown',escape,{capture:true,signal});
  const bindFrameKeys=()=>{try{frame.contentDocument?.addEventListener('keydown',escape,{capture:true,signal});}catch{}};
  frame.addEventListener('load',bindFrameKeys,{signal});bindFrameKeys();
  view.addEventListener('resize',requestFit,{signal});view.visualViewport?.addEventListener('resize',requestFit,{signal});
  return()=>{if(expanded){if(kind==='popover')figure.hidePopover();else if(view.document.fullscreenElement===figure)view.document.exitFullscreen().catch(()=>{});setExpanded(false);}controller.abort();toolbar.remove();figure.removeAttribute('popover');delete frame.dataset.embedMode;delete frame.dataset.embedExpanded;};
}
