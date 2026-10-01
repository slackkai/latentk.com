import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { animateDisclosure } from '../src/scripts/disclosure.mjs';

test('directory waits for closing motion, reverses rapid toggles and clears animation state',async()=>{
  const dom=new JSDOM('<details open><summary>Contents</summary><ul><li>Chapter</li></ul></details>');const view=dom.window,details=view.document.querySelector('details'),summary=details.querySelector('summary');
  const reduced=new view.EventTarget();reduced.matches=false;view.matchMedia=()=>reduced;const animations=[];
  view.HTMLElement.prototype.animate=function(){assert.equal(this,details.querySelector('ul'),'only the list is animated; the summary stays outside clipping');let resolve;const finished=new Promise(done=>resolve=done);const animation={finished,resolve,cancel(){}};animations.push(animation);return animation;};
  const dispose=animateDisclosure(details,view);
  try{
    summary.click();assert.equal(details.open,true,'keep content renderable during collapse');assert.equal(details.querySelector('ul').inert,true);
    assert.equal(details.style.overflow,'');assert.equal(details.querySelector('ul').style.overflow,'hidden');
    summary.click();assert.equal(details.open,true);assert.equal(details.querySelector('ul').inert,false);
    animations[0].resolve();await Promise.resolve();assert.equal(details.open,true,'stale completion must not close a newly opened directory');
    animations[2].resolve();await Promise.resolve();assert.equal(details.classList.contains('is-disclosing'),false);
    summary.click();animations[4].resolve();await Promise.resolve();assert.equal(details.open,false);assert.equal(details.style.overflow,'');
    reduced.matches=true;summary.click();assert.equal(details.open,true);assert.equal(details.classList.contains('is-disclosing'),false);
  }finally{dispose();dom.window.close();}
});
