import test from 'node:test';
import assert from 'node:assert/strict';
import { readingStats, relatedTo } from '../src/utils/editorial.mjs';
import { contentSchemas } from '../src/utils/content-schemas.mjs';

test('reading estimates ignore URL destinations, frontmatter, fenced examples and display math', () => {
  const body = '---\ntitle: hidden metadata\n---\n中文 [two words](https://example.org/a-long-path)\n\n```js\nlet notCounted = 1;\n```\n\n$$ignored math$$\n';
  assert.deepEqual(readingStats(body), { words: 4, minutes: 1 });
  assert.equal(readingStats('字'.repeat(401)).minutes, 2);
  assert.deepEqual(readingStats(undefined), { words: 0, minutes: 0 });
});

test('recommendations need a real shared topic and never expose a draft', () => {
  const entry = (id, tags, extra = {}) => ({ collection: 'insight', id, data: { tags, date: new Date('2026-09-30'), ...extra } });
  const current = entry('current', ['git', 'tools']);
  const unrelated = entry('unrelated', ['cooking']);
  const duplicate = entry('duplicates', ['git', 'git', 'git']);
  const shared = { ...entry('shared', ['git', 'tools']), collection: 'academic' };
  const draft = entry('draft', ['git', 'tools'], { draft: true });
  const pool = [current, unrelated, duplicate, shared, draft];
  assert.deepEqual(relatedTo(current, pool).map(e => e.id), ['shared', 'duplicates']);
  assert.deepEqual(relatedTo(current, pool, 0), []);
  assert.deepEqual(relatedTo(entry('empty', []), pool), []);
});

test('resource review dates can be cleared while invalid populated dates fail', () => {
  const base = { title: 'Tutorial', date: '2026-09-30' };
  assert.equal(contentSchemas.library.parse({ ...base, reviewed: '' }).reviewed, undefined);
  assert.equal(contentSchemas.library.safeParse({ ...base, reviewed: 'invalid' }).success, false);
});
