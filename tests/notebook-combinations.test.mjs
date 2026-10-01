import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createNotebookProcessor } from '../src/markdown/processor.mjs';

const processor = await createNotebookProcessor();
const parse = async source => new JSDOM((await processor.render(source)).code);

test('candidate photos preserve linked media, rich captions and intervening prose', async () => {
  const dom = await parse(':::photos{cols=2 #gallery tilt=2}\n[![First](/a.svg)](/original/)\n**Caption** :mark[highlight] :stamp[checked]{green} :note[details]\n\nA paragraph with [a link](/notes/).\n\n![Second](/b.svg)\n:::');
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('figure.photo').length, 2);
    assert.equal(doc.querySelector('#gallery .photo > a').getAttribute('href'), '/original/');
    assert.equal(doc.querySelector('figcaption strong').textContent, 'Caption');
    assert.equal(doc.querySelector('figcaption .mark').textContent, 'highlight');
    assert.equal(doc.querySelector('figcaption .stamp').textContent, 'checked');
    assert.ok(doc.querySelector('figcaption .note-wrap'));
    assert.equal(doc.querySelector('.photos-text a').getAttribute('href'), '/notes/');
    assert.match(doc.querySelector('#gallery').getAttribute('style'), /--tilt:2deg/);
  } finally { dom.window.close(); }
});

test('candidate note links are outside the trigger label and repeated references are independent', async () => {
  const dom = await parse('Note :note[[link](/target/) :mark[key]] and footnote[^a], then again[^a].\n\n[^a]: **same content** [link](/source/)');
  try {
    const doc = dom.window.document;
    const wraps = [...doc.querySelectorAll('.note-wrap')];
    assert.equal(wraps.length, 3);
    assert.equal(doc.querySelectorAll('label a').length, 0);
    assert.equal(new Set(wraps.map(w => w.querySelector('input').id)).size, 3);
    for (const wrap of wraps) {
      const input = wrap.querySelector('input');
      assert.equal(wrap.querySelector('label').htmlFor, input.id);
      assert.equal(doc.getElementById(input.getAttribute('aria-controls')), wrap.querySelector('.note'));
    }
    wraps[0].querySelector('label').click();
    assert.equal(wraps[0].querySelector('input').checked, true);
    assert.equal(wraps[1].querySelector('input').checked, false);
    wraps[0].querySelector('a').addEventListener('click', event => event.preventDefault());
    wraps[0].querySelector('a').click();
    assert.equal(wraps[0].querySelector('input').checked, true);
    assert.equal(wraps[1].querySelector('.note strong').textContent, 'same content');
    assert.equal(wraps[2].querySelector('.note strong').textContent, 'same content');
  } finally { dom.window.close(); }
});

test('the real showcase renders nested blocks and source view without raw directives or dropped content', async () => {
  const source = await readFile(new URL('../src/content/projects/syntax-combinations/index.md', import.meta.url), 'utf8');
  const body = source.replace(/^---[\s\S]*?---\s*/, '').split(/\n:{3,}fold\[查看整页 Markdown\]/)[0];
  const dom = await parse(body);
  try {
    const doc = dom.window.document;
    assert.ok(doc.querySelector('.layout-cols > .sticky .note-wrap'));
    assert.ok(doc.querySelector('details .photos figcaption .mark'));
    assert.ok(doc.querySelector('.sticky .photos'));
    assert.ok(doc.querySelector('.sticky details .sticky'));
    assert.ok(doc.querySelector('details .layout-cols .sticky details .note-block'));
    const full = await parse(source.replace(/^---[\s\S]*?---\s*/, ''));
    assert.equal(full.window.document.querySelectorAll('h2').length,6,'source fold must not render a second set of headings');
    assert.equal(full.window.document.querySelectorAll('.photo').length,3,'source fold must contain code, not duplicate figures');
    assert.ok(full.window.document.querySelector('details pre[data-language="md"]'));
    full.window.close();
    assert.equal(doc.querySelectorAll('.photo').length, 3);
    assert.ok(doc.getElementById('photos-in-fold'));
    assert.ok(doc.getElementById('inline-markers'));
    assert.ok(!doc.body.textContent.includes(':::'));
    const fullSource = await parse('````````md\n' + body + '\n````````');
    assert.equal(fullSource.window.document.querySelectorAll('pre').length, 1);
    assert.equal(fullSource.window.document.querySelector('code').textContent.trim(), body.trim());
    fullSource.window.close();
  } finally { dom.window.close(); }
});

test('formal rendering respects project Pages base paths', async () => {
 const based=await createNotebookProcessor({base:'/theme/'});
 const {code}=await based.render(':::photos\n[![Image](/a.svg)](/original/)\n:::');
 assert.ok(code.includes('src="/theme/a.svg"'));assert.ok(code.includes('href="/theme/original/"'));
});
