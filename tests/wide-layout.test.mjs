import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('wide blocks clear margin-note floats before occupying the right margin', async () => {
  const css = await readFile(new URL('../src/styles/markdown.css', import.meta.url), 'utf8');
  const desktop = css.match(/@media\s*\(min-width:\s*1200px\)\s*\{\s*\.layout-wide\s*\{([^}]+)\}/);
  assert.ok(desktop, 'desktop wide-layout rule exists');
  assert.match(desktop[1], /clear:\s*right\s*;/, 'preceding margin notes finish before a wide block starts');
  assert.match(desktop[1], /left:\s*0\s*;/, 'wide blocks do not shift into the left-hand table of contents');
});
