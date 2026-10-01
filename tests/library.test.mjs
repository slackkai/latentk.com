import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountLibrary } from '../src/scripts/library.mjs';

test('a 1000-entry library filters the complete collection while rendering only one page',async()=>{
  const dom=new JSDOM(`<body><section data-page-size="24" data-catalog="/catalog" data-labels='{"types":{"book":"Book"},"typeEmoji":{},"status":{}}'><button data-type="all"></button><button data-sort="date"></button><input id="lib-search"><div id="lib-grid"></div><p id="lib-empty" hidden></p><nav data-library-pagination><a data-page-prev></a><span data-page-status></span><a data-page-next></a></nav><template id="lib-card-template"><article class="lib-card reveal"><img class="lib-cover"><span class="lib-type"></span><h3 class="lib-title"><a></a></h3><p class="lib-author"></p><p class="lib-summary"></p><span class="lib-status"></span><p class="lib-rating"></p><div class="lib-foot"><ul class="tags"><li><a></a></li></ul><a></a></div></article></template></section>`,{url:'https://example.com'});
  const view=dom.window;
  let fetches=0;
  view.fetch=async()=>{fetches++;return{ok:true,json:async()=>Array.from({length:1000},(_,i)=>({title:'Resource '+i,search:'resource '+i,href:'/library/'+i,type:'book',date:i,rating:0,order:0,tags:[]}))};};
  const root=view.document.querySelector('section'),dispose=mountLibrary(root,view);
  try{
    const input=root.querySelector('input');input.value='resource';input.dispatchEvent(new view.Event('input'));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(root.querySelectorAll('#lib-grid .lib-card').length,24);
    assert.equal(root.querySelector('[data-page-status]').textContent,'1 / 42');
    input.value='resource 999';input.dispatchEvent(new view.Event('input'));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(root.querySelectorAll('#lib-grid .lib-card').length,1);
    assert.equal(root.querySelector('.lib-title').textContent,'Resource 999');
    assert.equal(fetches,1,'catalog should be loaded once');
    assert.equal(root.querySelector('.lib-card.reveal'),null,'new results must be visible without another page transition');
    input.value='no match';input.dispatchEvent(new view.Event('input'));
    await new Promise(resolve=>setTimeout(resolve,0));assert.equal(root.querySelector('#lib-empty').hidden,false);
  }finally{dispose();dom.window.close();}
});
