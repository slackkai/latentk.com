import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountImages } from '../src/scripts/images.mjs';
test('image viewing respects links, works from the keyboard and restores focus and attributes',()=>{
  const dom=new JSDOM('<body><main><div class="prose"><img src="/image.svg" alt="Diagram"><a href="/original"><img src="/linked.svg"></a></div></main>');
  const view=dom.window;
  view.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  view.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new view.Event('close'));};
  const images=[...view.document.images],dispose=mountImages(view.document.querySelector('main'),view);
  try{
    assert.equal(images[0].tabIndex,0);assert.equal(images[1].getAttribute('role'),null);
    images[0].dispatchEvent(new view.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    const dialog=view.document.querySelector('dialog');assert.equal(dialog.open,true);
    assert.equal(dialog.querySelector('img').getAttribute('src'),'/image.svg');
    dialog.querySelector('.image-viewer-close').click();assert.equal(view.document.activeElement,images[0]);
    dispose();assert.equal(view.document.querySelector('dialog'),null);assert.equal(images[0].getAttribute('tabindex'),null);
  }finally{dispose();dom.window.close();}
});

test('image controls clamp zoom, pan a large image and restore its initial view',()=>{
  const dom=new JSDOM('<body><main><div class="prose"><img src="/diagram.svg" alt="Diagram"></div></main>');const view=dom.window;
  view.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  const dispose=mountImages(view.document.querySelector('main'),view);
  try{
    view.document.querySelector('main img').click();const dialog=view.document.querySelector('dialog'),stage=dialog.querySelector('.image-viewer-stage'),image=stage.querySelector('img');
    Object.defineProperties(stage,{clientWidth:{value:400},clientHeight:{value:300}});Object.defineProperties(image,{clientWidth:{value:400},clientHeight:{value:300}});
    const key=key=>dialog.dispatchEvent(new view.KeyboardEvent('keydown',{key,bubbles:true}));
    for(let i=0;i<30;i++)key('+');assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'800%');
    key('ArrowLeft');assert.ok(image.style.transform.includes('translate(40px'));
    const pointer=(type,x,y,id=1)=>{const event=new view.Event(type,{bubbles:true});Object.assign(event,{pointerId:id,button:0,clientX:x,clientY:y});stage.dispatchEvent(event);};
    pointer('pointerdown',100,100);pointer('pointermove',180,140);pointer('pointerup',180,140);assert.ok(image.style.transform.includes('translate(120px, 40px)'));
    key('0');assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'100%');assert.equal(image.style.transform,'translate(0px, 0px) scale(1)');
    const wheel=new view.WheelEvent('wheel',{deltaY:-10,ctrlKey:true,cancelable:true});stage.dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented,true);assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'120%','small trackpad pinch has a useful response');
    key('0');stage.dispatchEvent(new view.WheelEvent('wheel',{deltaY:-1,deltaMode:1}));assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'110%','line wheel deltas are normalized');key('0');
    for(let i=0;i<30;i++)key('-');assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'50%');
    key('0');pointer('pointerdown',100,100,1);pointer('pointerdown',200,100,2);pointer('pointermove',300,100,2);
    assert.equal(dialog.querySelector('.image-viewer-scale').textContent,'200%');
    pointer('pointercancel',100,100,1);pointer('pointercancel',300,100,2);assert.ok(!stage.classList.contains('is-dragging'));
  }finally{dispose();dom.window.close();}
});
