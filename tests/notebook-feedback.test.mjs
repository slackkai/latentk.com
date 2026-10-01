import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createNotebookProcessor } from '../src/markdown/processor.mjs';
import { mountNotes } from '../src/scripts/notes.mjs';
import { bindReadingBoundary } from '../src/scripts/reading-boundary.mjs';

const processor = await createNotebookProcessor();
async function fixture() {
  const { code } = await processor.render('One :note[First [link](/target/)]. Two :note[Second].');
  const dom = new JSDOM(`<html lang="zh-CN"><body><article class="combination-page"><nav id="toc"></nav><div data-combination-reading>${code}<details id="source"><summary>Source</summary><pre>Long source</pre></details></div></article></body></html>`);
  const view = dom.window;
  const wide = new view.EventTarget();
  wide.matches = true;
  view.matchMedia = () => wide;
  const frames = new Map();
  let sequence = 0;
  view.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence; };
  view.cancelAnimationFrame = id => frames.delete(id);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const timers = new Map();
  view.setTimeout = (fn, duration) => { timers.set(++sequence, { fn, duration }); return sequence; };
  view.clearTimeout = id => timers.delete(id);
  const expire = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ fn }) => fn()); };
  let observer;
  view.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.connected = true; observer = this; }
    observe(target) { this.target = target; }
    disconnect() { this.connected = false; }
  };
  const root = view.document.querySelector('article');
  const toc = root.querySelector('#toc');
  const reading = root.querySelector('[data-combination-reading]');
  let end = 300;
  reading.getBoundingClientRect = () => ({ bottom: end });
  toc.getBoundingClientRect = () => ({ bottom: 500 + (parseFloat(toc.style.getPropertyValue('--toc-shift')) || 0), height: 400 });
  const disposeNotes = mountNotes(root, view);
  const boundary = bindReadingBoundary(toc,reading,view);
  const dispose = () => { disposeNotes(); boundary.dispose(); };
  return { dom, view, root, toc, reading, wide, flush, dispose, frames, timers, expire, get observer() { return observer; }, setEnd(value) { end = value; } };
}

test('desktop clicks point to the paper temporarily, restart on repeat and never add status text', async () => {
  const f = await fixture();
  try {
    const inputs = [...f.root.querySelectorAll('input')];
    const notes = [...f.root.querySelectorAll('.note')];
    assert.equal(inputs[0].getAttribute('aria-label'), '查看注释 1');
    inputs[0].click();
    assert.ok(notes[0].hasAttribute('data-note-active'));
    assert.equal(notes[0].querySelector('.note-state, .note-caption'), null);
    assert.equal(notes[0].textContent, 'First link');
    assert.equal([...f.timers.values()][0].duration, 3000);
    const firstTimer = [...f.timers.keys()][0];
    inputs[0].click();
    assert.ok(!f.timers.has(firstTimer));
    assert.equal(f.timers.size, 1);
    assert.ok(notes[0].hasAttribute('data-note-active'));
    notes[0].querySelector('a').addEventListener('click', e => e.preventDefault());
    notes[0].querySelector('a').click();
    assert.ok(notes[0].hasAttribute('data-note-active'));
    inputs[1].click();
    assert.equal(inputs[0].checked, false);
    assert.ok(!notes[0].hasAttribute('data-note-active'));
    assert.ok(notes[1].hasAttribute('data-note-active'));
    f.expire();
    assert.ok(!notes[1].hasAttribute('data-note-active'));
    assert.equal(f.root.querySelector('.note-ref[data-note-active]'), null);
    inputs[1].click();
    assert.ok(notes[1].hasAttribute('data-note-active'));
    f.dispose();
    assert.equal(f.timers.size, 0);
  } finally { f.dispose(); f.dom.window.close(); }
});

test('narrow notes expand independently and labels follow the viewport language and behavior', async () => {
  const f = await fixture();
  try {
    f.wide.matches = false;
    f.wide.dispatchEvent(new f.view.Event('change'));
    f.flush();
    const inputs = [...f.root.querySelectorAll('input')];
    assert.equal(inputs[0].getAttribute('aria-label'), '展开注释 1');
    inputs[0].click(); inputs[1].click();
    assert.ok(inputs.every(input => input.checked));
    f.expire();
    assert.ok(inputs.every(input => input.checked), 'expiring decoration must not collapse mobile notes');
    assert.equal(f.root.querySelector('[data-note-active]'), null);
    inputs[1].click();
    assert.equal(inputs[1].checked, false);
    assert.equal(f.toc.style.getPropertyValue('--toc-shift'), '');
    f.wide.matches = true;
    f.wide.dispatchEvent(new f.view.Event('change'));
    assert.ok(inputs.every(input => !input.checked));
    assert.equal(f.root.querySelector('.note-state, .note-caption'), null);
  } finally { f.dispose(); f.dom.window.close(); }
});

test('TOC restores immediately when appended source expands, then follows the actual content bottom', async () => {
  const f = await fixture();
  try {
    assert.equal(f.toc.style.getPropertyValue('--toc-opacity'), '0.500');
    assert.equal(f.observer.target, f.reading);
    f.setEnd(3300);
    f.root.querySelector('#source').dispatchEvent(new f.view.Event('toggle'));
    f.flush();
    assert.equal(f.toc.style.getPropertyValue('--toc-opacity'), '1.000');
    assert.equal(f.toc.style.getPropertyValue('--toc-shift'), '0.0px');
    assert.ok(!f.toc.classList.contains('is-past'));
    f.setEnd(100);
    f.observer.callback(); f.flush();
    assert.equal(f.toc.style.getPropertyValue('--toc-opacity'), '0.000');
    assert.equal(f.toc.style.getPropertyValue('--toc-shift'), '-400.0px');
    f.setEnd(-10);
    f.observer.callback(); f.flush();
    assert.ok(f.toc.classList.contains('is-past'));
    f.setEnd(2000);
    f.observer.callback();
    f.dispose();
    assert.equal(f.frames.size, 0);
    assert.equal(f.observer.connected, false);
  } finally { f.dispose(); f.dom.window.close(); }
});
