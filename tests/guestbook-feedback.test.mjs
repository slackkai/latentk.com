import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { JSDOM } from 'jsdom';

test('invalid letters stay local and service failures preserve fields without exposing API details', async () => {
  const source = await readFile(new URL('../src/pages/guestbook.astro', import.meta.url), 'utf8');
  const code = (await transform(source.match(/<script>([\s\S]*?)<\/script>/)[1], { loader: 'ts' })).code;
  const dom = new JSDOM(`<form id="letter" data-key="fixture" data-site="Fixture" data-failed="没有寄出，请稍后重试或直接发邮件。"><input name="name" required><input name="email" type="email"><textarea name="message" required></textarea><p id="letter-status" hidden></p><button id="letter-send">寄出</button><div id="letter-sent" hidden></div></form>`, { runScripts: 'outside-only' });
  const view = dom.window, form = view.document.querySelector('form'), status = view.document.querySelector('#letter-status');
  let calls = 0;
  view.fetch = async () => { calls++; return { ok: false, status: 429, json: async () => ({ message: 'HTTP 429: internal access_key quota exceeded' }) }; };
  try {
    view.eval(code);
    form.dispatchEvent(new view.Event('submit', { cancelable: true }));
    assert.equal(calls, 0, 'required-field validation prevents submission');
    form.elements.name.value = 'Reader'; form.elements.message.value = 'Hello'; form.elements.email.value = 'invalid';
    form.dispatchEvent(new view.Event('submit', { cancelable: true }));
    assert.equal(calls, 0, 'email validation prevents submission');
    form.elements.email.value = 'reader@example.org';
    form.dispatchEvent(new view.Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(calls, 1); assert.equal(status.hidden, false);
    assert.equal(status.textContent, form.dataset.failed);
    assert.equal(form.elements.message.value, 'Hello');
    assert.equal(view.document.querySelector('#letter-send').disabled, false, 'reader can retry');
  } finally { view.close(); }
});
