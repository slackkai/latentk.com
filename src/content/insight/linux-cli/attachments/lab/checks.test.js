// Run: node --test src/content/insight/linux-cli/attachments/lab/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './fs.js';
import { runLine } from './shell.js';
import { lessons } from './lessons/index.js';

for (const { id, config, solution } of lessons) {
  test(`CLI lesson ${id}: the solution completes every task`, () => {
    const world = new World();
    config.setup?.(world);
    world.events.length = 0;
    let index = 0, since = 0;
    const check = () => {
      const events = world.events.slice(since);
      return {
        world, here: world.here(), cwd: world.where(),
        ran: (name, predicate) => events.some(e => e.sh === name && e.status === 0 && (!predicate || predicate(e.args.join(' ')))),
        wrote: () => events.some(e => e.write),
      };
    };
    for (const line of solution) {
      runLine(world, line);
      while (index < config.tasks.length && config.tasks[index].check(check())) {
        index++;
        since = world.events.length;
      }
    }
    assert.equal(index, config.tasks.length, `Stuck at task ${index + 1}`);
  });
}

test('pipelines pass only stdout and return the last command status', () => {
  const world = new World();
  world.put('~/mail', 'meeting\nbill\nmeeting\n');
  const result = runLine(world, 'cat missing mail | grep meeting | wc -l');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '2');
  assert.match(result.plain(), /No such file/);
  assert.doesNotMatch(result.stdout, /No such file/);
  assert.equal(runLine(world, 'cat mail | grep absent').status, 1);
});

test('conditional execution skips an entire pipeline, not only its first stage', () => {
  const world = new World();
  world.put('~/mail', 'meeting\n');
  runLine(world, 'grep absent mail && echo wrong | cat > skipped');
  assert.equal(world.resolve('skipped').node, null);
  runLine(world, 'grep absent mail || echo recovered | cat > found');
  assert.equal(world.at('found').node.content, 'recovered\n');
});

test('redirection opens before reading; errors remain on stderr', () => {
  const world = new World();
  world.put('~/original', 'keep me\n');
  assert.equal(runLine(world, 'cat original > original').status, 0);
  assert.equal(world.at('original').node.content, '');
  const result = runLine(world, 'cat missing > errors');
  assert.notEqual(result.status, 0);
  assert.match(result.plain(), /No such file/);
  assert.equal(world.at('errors').node.content, '');
  world.put('~/locked', 'keep\n', 'r--r--r--');
  const failed = runLine(world, 'echo replaced > locked && echo wrong');
  assert.notEqual(failed.status, 0);
  assert.equal(world.at('locked').node.content, 'keep\n');
  assert.doesNotMatch(failed.stdout, /wrong/);
});

test('empty and unterminated streams preserve newline counts', () => {
  const world = new World();
  runLine(world, 'echo -n first > text');
  assert.equal(world.at('text').node.content, 'first');
  assert.equal(runLine(world, 'cat text | wc -l').stdout.trim(), '0');
  runLine(world, 'echo second >> text');
  assert.equal(world.at('text').node.content, 'firstsecond\n');
  assert.equal(runLine(world, 'cat text | grep absent | wc -l').stdout.trim(), '0');
  assert.equal(runLine(world, 'cat text | head -n 0').stdout, '');
  assert.equal(runLine(world, 'cat text | tail -n 0').stdout, '');
});

test('quoted metacharacters are text and malformed pipelines are rejected', () => {
  const world = new World();
  assert.equal(runLine(world, 'echo "a | b" | cat').stdout, 'a | b\n');
  for (const line of ['echo a |', '| cat', 'echo a && | cat']) {
    assert.equal(runLine(world, line).status, 2, line);
  }
});

test('copying into an existing directory preserves the source and exact bytes', () => {
  const world = new World();
  world.put('~/meeting notes', 'without final newline');
  world.ensure('~/backup');
  assert.equal(runLine(world, 'cp "meeting notes" backup').status, 0);
  assert.equal(world.at('backup/meeting notes').node.content, 'without final newline');
  assert.equal(world.at('meeting notes').node.content, 'without final newline');
});

test('ls produces one name per line when redirected and chmod respects explicit identity', () => {
  const world = new World();
  world.put('~/a', 'a\n');
  world.put('~/b', 'b\n');
  assert.equal(runLine(world, 'ls | wc -l').stdout.trim(), '2');
  runLine(world, 'chmod u+x a');
  assert.equal(world.at('a').node.mode, 'rwxr--r--');
  runLine(world, 'chmod +x b');
  assert.equal(world.at('b').node.mode, 'rwxr-xr-x');
});
