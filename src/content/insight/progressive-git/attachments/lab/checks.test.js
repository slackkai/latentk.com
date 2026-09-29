// Run: node --test src/content/insight/progressive-git/attachments/lab/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, statusOf, headId, headBranch, treeOf, ancestors } from './git.js';
import { subject } from './core.js';
import { lessons } from './lessons/index.js';

function setup(world, commands) {
  for (const command of commands) {
    if (typeof command === 'function') command(world);
    else assert.equal(world.run(command).status, 0, `Setup: ${command}`);
  }
}

for (const { id, config, solution } of lessons) {
  test(`Git lesson ${id}: the solution completes every task`, () => {
    const world = new World();
    config.setup?.(world, setup);
    if (config.cwd !== undefined) world.cwd = config.cwd;
    world.events.length = 0;
    const actions = new Set();
    let index = 0, since = 0;
    const context = () => {
      const repo = world.repo, dir = world.dir;
      const events = world.events.slice(since);
      return {
        world, repo, dir, files: dir.files,
        head: repo ? treeOf(repo, headId(repo)) : {}, index: repo?.index ?? {},
        status: repo ? statusOf(dir) : null,
        branch: repo ? headBranch(repo) : null, tip: repo ? headId(repo) : null,
        commits: repo && headId(repo) ? ancestors(repo, [headId(repo)]).size : 0,
        message: repo && headId(repo) ? subject(repo.objects.get(headId(repo)).message) : '',
        ref: name => repo?.refs.get(`refs/heads/${name}`) ?? null,
        ran: (name, predicate) => events.some(e => e.git === name && e.status === 0 && (!predicate || predicate(e.args.join(' ')))),
        sh: (name, predicate) => events.some(e => e.sh === name && (!predicate || predicate(e.args.join(' ')))),
        tried: (name, predicate) => events.some(e => e.git === name && (!predicate || predicate(e.args.join(' ')))),
        failed: name => events.some(e => e.git === name && e.status !== 0),
        wrote: name => events.some(e => e.write === name),
        acted: name => actions.has(name),
        remote: url => world.remoteRepo(url ?? config.remote),
      };
    };
    for (const step of solution) {
      if (typeof step === 'function') step(world);
      else if (step.action) {
        config.actions.find(action => action.id === step.action).run(world);
        actions.add(step.action);
      } else {
        const command = typeof step === 'string' ? step : step.cmd;
        const result = world.run(command);
        assert.equal(result.status !== 0, !!step.fails, `${command}: ${result.plain()}`);
      }
      while (index < config.tasks.length && config.tasks[index].check(context())) {
        index++;
        since = world.events.length;
      }
    }
    assert.equal(index, config.tasks.length, `Stuck at task ${index + 1}`);
    if (id === '01-first-repo') {
      assert.equal(world.dir.files['hello.txt'], 'hello git\nhello again\nnot yet\n');
      assert.equal(treeOf(world.repo, headId(world.repo))['hello.txt'], 'hello git\nhello again\n');
      assert.equal(statusOf(world.dir).unstaged.length, 1);
    }
    if (id === '06-undo') {
      assert.equal(headBranch(world.repo), 'main');
      const rescued = world.repo.refs.get('refs/heads/rescue');
      assert.notEqual(rescued, headId(world.repo));
      assert.match(world.repo.objects.get(rescued).message, /^Revert/);
      assert.equal(world.dir.files['notes.txt'], '待办：给文章配张图\n');
    }
  });
}

test('restore uses the index, while restore --staged preserves working content', () => {
  const world = new World();
  setup(world, ['mkdir test', 'cd test', 'git init', 'echo A > note', 'git add note', 'git commit -m initial', 'echo B > note', 'git add note', 'echo C > note']);
  assert.equal(world.run('git restore note').status, 0);
  assert.equal(world.dir.files.note, 'B\n');
  assert.equal(world.run('git restore --staged note').status, 0);
  assert.equal(world.repo.index.note, 'A\n');
  assert.equal(world.dir.files.note, 'B\n');
});
