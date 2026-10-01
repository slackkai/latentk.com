import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('embedded article observers are replaced on reload and released across client navigation', async () => {
  const source = await readFile(new URL('../src/scripts/prose.ts', import.meta.url), 'utf8');
  const result = await build({stdin:{contents:source,loader:'ts',resolveDir:new URL('../src/scripts/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')},bundle:true,write:false,format:'iife'});
  const code=result.outputFiles[0].text;
  const dom = new JSDOM('<!doctype html><iframe class="embed-page"></iframe>', { runScripts: 'outside-only', url: 'https://example.org/insight/git/' });
  const { window } = dom;
  const active = new Set();
  window.ResizeObserver = class {
    observe() { active.add(this); }
    disconnect() { active.delete(this); }
  };
  try {
    window.eval(code);
    const frame = window.document.querySelector('iframe');
    frame.dispatchEvent(new window.Event('load'));
    assert.equal(active.size, 1);
    frame.dispatchEvent(new window.Event('load'));
    assert.equal(active.size, 1, 'an iframe reload must replace its observer');
    window.document.dispatchEvent(new window.Event('astro:before-swap'));
    assert.equal(active.size, 0, 'navigation must release the old document');
    assert.equal(frame.dataset.bound, undefined);
    window.document.dispatchEvent(new window.Event('astro:page-load'));
    frame.dispatchEvent(new window.Event('load'));
    assert.equal(active.size, 1, 'the next page must bind again');
    window.document.dispatchEvent(new window.Event('astro:before-swap'));
    assert.equal(active.size, 0);
  } finally {
    window.close();
  }
});
