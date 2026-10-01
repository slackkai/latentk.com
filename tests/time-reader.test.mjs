import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';

test('time reader shows delayed and timely messages from the same stated controller', async () => {
  const directory = new URL('../src/content/insight/feedback-delay/attachments/time-reader/', import.meta.url);
  const html = await readFile(new URL('index.html', directory), 'utf8');
  const { outputFiles } = await build({
    entryPoints: ['src/content/insight/feedback-delay/attachments/time-reader/reader.js'],
    bundle: true, write: false, format: 'iife', platform: 'browser',
    // This import is relative to the published URL; its filesystem source is public/.
    plugins: [{ name: 'published-lab-url', setup(builder) {
      builder.onResolve({ filter: /uploads\/reading-labs\/lab\.js$/ }, () => ({
        path: fileURLToPath(new URL('../public/uploads/reading-labs/lab.js', import.meta.url)),
      }));
    } }],
  });
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const { window } = dom;
  window.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    window.eval(outputFiles[0].text);
    const doc = window.document;
    // Independent hand calculation: x_7=1.05, x_1=.15, u_7=+1.5, x_8=1.2.
    assert.match(doc.querySelector('#observation').textContent, /越过目标 5\.0 cm/);
    assert.match(doc.querySelector('#track svg').getAttribute('aria-label'), /实际位置 1\.050 米，收到第 1 拍的位置 0\.150 米/);
    assert.match(doc.querySelector('#ledger').textContent, /1\.200 m/);
    doc.querySelector('[data-delay="0"]').click();
    assert.match(doc.querySelector('#track svg').getAttribute('aria-label'), /实际位置 0\.910 米，收到第 7 拍的位置 0\.910 米/);
    assert.match(doc.querySelector('#ledger').textContent, /0\.946 m/);
    doc.querySelector('#next').click();
    assert.equal(doc.querySelector('#step-value').textContent, '8');
    const slider = doc.querySelector('#step');
    slider.value = '119';
    slider.dispatchEvent(new window.Event('input'));
    assert.equal(doc.querySelector('#next').disabled, true);
    assert.equal(doc.querySelector('#step-value').textContent, '119');
    slider.value = '0';
    slider.dispatchEvent(new window.Event('input'));
    assert.equal(doc.querySelector('#previous').disabled, true);
    assert.match(doc.querySelector('#ledger').textContent, /0\.150 m/);
  } finally { window.close(); }
});
