import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { fitEmbed,mountEmbed } from '../src/scripts/embeds.mjs';

test('viewport fitting caps long content, full content restores height and fixed embeds stay fixed',()=>{
  const dom=new JSDOM('<body><figure class="media-frame"><iframe></iframe></figure></body>');const view=dom.window,frame=view.document.querySelector('iframe');
  try{
    Object.defineProperty(frame.contentDocument.body,'scrollHeight',{value:1600});fitEmbed(frame,view);assert.equal(frame.style.height,'656px');assert.equal(frame.contentDocument.documentElement.style.overflow,'auto');
    frame.dataset.embedMode='content';fitEmbed(frame,view);assert.equal(frame.style.height,'1602px');
    frame.dataset.embedMode='fixed';frame.style.height='320px';fitEmbed(frame,view);assert.equal(frame.style.height,'320px');
  }finally{dom.window.close();}
});
test('fullscreen fallback retains the exact iframe, restores inert state and keyboard exit',async()=>{
  const dom=new JSDOM('<body><header><button>Outside</button></header><main><figure class="media-frame"><iframe title="Lesson"></iframe></figure></main></body>');const view=dom.window,figure=view.document.querySelector('figure'),frame=figure.querySelector('iframe');
  figure.requestFullscreen=async()=>{throw Error('unsupported');};let visible=false;figure.showPopover=()=>{visible=true;};figure.hidePopover=()=>{visible=false;};
  const dispose=mountEmbed(frame,view);
  try{
    view.scrollTo=()=>{};
    const buttons=figure.querySelectorAll('button');buttons[0].click();assert.equal(frame.dataset.embedMode,'screen');
    assert.equal(buttons[0].textContent,'');assert.ok(buttons[0].getAttribute('aria-label'));assert.ok(buttons[1].querySelector('svg'));
    buttons[1].click();await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(visible,true);assert.equal(figure.querySelector('iframe'),frame);assert.ok(view.document.querySelector('header').inert);assert.equal(frame.dataset.embedExpanded,'true');
    view.document.dispatchEvent(new view.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(visible,false);assert.equal(frame.dataset.embedExpanded,'false');assert.ok(!view.document.querySelector('header').inert);
    dispose();assert.equal(figure.querySelector('.embed-tools'),null);
  }finally{dispose();dom.window.close();}
});

test('screen fitting aligns the frame below navigation and reserves caption space without reloading',()=>{
  const dom=new JSDOM('<body><header class="site-header"></header><figure class="media-frame" style="padding:10px;border:2px solid"><iframe data-fixed="true" style="height:320px"></iframe><figcaption style="margin-top:8px">Lesson</figcaption></figure></body>');
  const view=dom.window,frame=view.document.querySelector('iframe'),figure=frame.parentElement;let scroll;
  Object.defineProperty(view.document.querySelector('header'),'offsetHeight',{value:64});
  figure.getBoundingClientRect=()=>({top:900});figure.querySelector('figcaption').getBoundingClientRect=()=>({height:24});
  view.scrollTo=options=>{scroll=options;};frame.addEventListener('embed:resize',()=>fitEmbed(frame,view));
  const dispose=mountEmbed(frame,view);
  try{
    figure.querySelector('button').click();assert.equal(scroll.top,830);assert.equal(frame.style.height,'636px');
    assert.equal(figure.querySelector('iframe'),frame);assert.equal(figure.querySelector('button').getAttribute('aria-pressed'),'true');
    figure.querySelector('button').click();assert.equal(frame.dataset.embedMode,'fixed');assert.equal(frame.style.height,'320px');
    view.document.querySelector('header').dataset.autoHide='true';
    let aligned=false;view.document.addEventListener('embed:align',()=>{aligned=true;});
    figure.querySelector('button').click();assert.equal(scroll.top,894);assert.equal(frame.style.height,'700px');assert.equal(aligned,true);
  }finally{dispose();view.close();}
});
