/** Pan and zoom plain Markdown images; linked images keep their destinations. */
export function mountImages(root,view) {
  if(root.ownerDocument.body.dataset.imageZoom==='false')return()=>{};
  const controller=new view.AbortController(),{signal}=controller;
  const ui=JSON.parse(root.ownerDocument.body.dataset.viewerLabels || '{}');
  const saved=[],pointers=new Map();
  let dialog,origin,stage,preview,percent,observer,gesture,scale=1,x=0,y=0;
  const label=root.ownerDocument.body.dataset.imageLabel || 'View larger image';
  const closeLabel=root.ownerDocument.body.dataset.imageClose || 'Close image';
  const limit=value=>Math.max(0.5,Math.min(8,value));
  function draw(){
    const maxX=Math.max(0,(preview.clientWidth*scale-stage.clientWidth)/2),maxY=Math.max(0,(preview.clientHeight*scale-stage.clientHeight)/2);
    x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));
    preview.style.transform=`translate(${x}px, ${y}px) scale(${scale})`;
    const value=Math.round(scale*100)+'%';if(percent.textContent!==value)percent.textContent=value;
  }
  function reset(){scale=1;x=0;y=0;pointers.clear();gesture=undefined;stage.classList.remove('is-dragging');draw();}
  function zoom(value,clientX,clientY){
    const rect=stage.getBoundingClientRect(),px=(clientX ?? rect.left+rect.width/2)-rect.left-rect.width/2,py=(clientY ?? rect.top+rect.height/2)-rect.top-rect.height/2;
    const next=limit(value),ratio=next/scale;x=px-(px-x)*ratio;y=py-(py-y)*ratio;scale=next;draw();
  }
  function rebase(){
    const points=[...pointers.values()];
    gesture=points.length===2?{distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y),cx:(points[0].x+points[1].x)/2,cy:(points[0].y+points[1].y)/2,scale,x,y}
      :points.length===1?{px:points[0].x,py:points[0].y,x,y}:undefined;
    stage.classList.toggle('is-dragging',points.length>0);
  }
  function create(){
    dialog=view.document.createElement('dialog');dialog.className='image-viewer';dialog.setAttribute('aria-label',label);
    const toolbar=view.document.createElement('div');toolbar.className='image-viewer-tools';
    const button=(text,title,action)=>{const b=view.document.createElement('button');b.type='button';b.className='hand-btn small';b.textContent=text;b.setAttribute('aria-label',title);b.title=title;b.addEventListener('click',action,{signal});toolbar.append(b);return b;};
    button('−',ui.zoomOut || 'Zoom out',()=>zoom(scale/1.25));
    percent=view.document.createElement('span');percent.className='image-viewer-scale';percent.setAttribute('role','status');percent.textContent='100%';toolbar.append(percent);
    button('+',ui.zoomIn || 'Zoom in',()=>zoom(scale*1.25));button(ui.reset || 'Reset',ui.reset || 'Reset',reset);
    const close=button('×',closeLabel,()=>dialog.close());close.classList.add('image-viewer-close');
    stage=view.document.createElement('div');stage.className='image-viewer-stage';stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-label',label);
    preview=view.document.createElement('img');preview.draggable=false;stage.append(preview);
    const caption=view.document.createElement('p');caption.className='image-viewer-caption';dialog.append(toolbar,stage,caption);view.document.body.append(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();},{signal});
    dialog.addEventListener('close',()=>{pointers.clear();rebase();origin?.focus({preventScroll:true});},{signal});preview.addEventListener('load',reset,{signal});
    stage.addEventListener('wheel',event=>{
      event.preventDefault();
      // Trackpad pinch arrives as small Ctrl+wheel pixel deltas; mouse wheels
      // may use line/page units. Cap each event to avoid sudden large jumps.
      const unit=event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1;
      const step=Math.max(-0.35,Math.min(0.35,-event.deltaY*unit*(event.ctrlKey?0.018:0.006)));
      zoom(scale*Math.exp(step),event.clientX,event.clientY);
    },{passive:false,signal});
    stage.addEventListener('dblclick',()=>{scale===1?zoom(2):reset();},{signal});
    stage.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();stage.focus({preventScroll:true});stage.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});rebase();},{signal});
    stage.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2){const [a,b]=[...pointers.values()],rect=stage.getBoundingClientRect();const next=limit(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance)),ratio=next/gesture.scale;
        x=(a.x+b.x)/2-rect.left-rect.width/2-(gesture.cx-rect.left-rect.width/2-gesture.x)*ratio;y=(a.y+b.y)/2-rect.top-rect.height/2-(gesture.cy-rect.top-rect.height/2-gesture.y)*ratio;scale=next;
      }else{x=gesture.x+event.clientX-gesture.px;y=gesture.y+event.clientY-gesture.py;}draw();
    },{signal});
    const release=event=>{pointers.delete(event.pointerId);rebase();};for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,release,{signal});
    dialog.addEventListener('keydown',event=>{
      if(['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();
      if(event.key==='+'||event.key==='=')zoom(scale*1.25);else if(event.key==='-')zoom(scale/1.25);else if(event.key==='0'||event.key==='Home')reset();
      else if(event.key.startsWith('Arrow')){x+=event.key==='ArrowLeft'?40:event.key==='ArrowRight'?-40:0;y+=event.key==='ArrowUp'?40:event.key==='ArrowDown'?-40:0;draw();}
    },{signal});
    observer='ResizeObserver' in view?new view.ResizeObserver(()=>{if(dialog.open)draw();}):undefined;observer?.observe(stage);
  }
  function open(image){
    if(!dialog)create();origin=image;preview.src=image.currentSrc || image.src;preview.alt=image.alt;
    dialog.querySelector('.image-viewer-caption').textContent=image.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
    dialog.showModal();reset();
  }
  root.querySelectorAll('.prose img').forEach(image=>{
    if(image.closest('a,button,[data-no-zoom]'))return;saved.push([image,image.getAttribute('role'),image.getAttribute('tabindex'),image.getAttribute('aria-label')]);
    image.setAttribute('role','button');image.tabIndex=0;image.setAttribute('aria-label',image.alt?`${label}: ${image.alt}`:label);image.classList.add('zoomable');
    image.addEventListener('click',()=>open(image),{signal});image.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(image);}},{signal});
  });
  return()=>{controller.abort();observer?.disconnect();dialog?.remove();saved.forEach(([image,role,tabIndex,aria])=>{image.classList.remove('zoomable');for(const[attr,value]of[['role',role],['tabindex',tabIndex],['aria-label',aria]]){if(value===null)image.removeAttribute(attr);else image.setAttribute(attr,value);}});};
}
