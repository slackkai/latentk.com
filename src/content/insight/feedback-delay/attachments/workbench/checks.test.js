// Run from the repository: node --test src/content/insight/feedback-delay/attachments/workbench/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, presets, challengePassed } from './model.js';
import { counts, weighted, mixed, wilson, sample } from '../../../../academic/success-rate-is-not-evidence/attachments/workbench/model.js';
import { translation, faults, points, correct, observed, inverse, near, evidence, candidates, regression } from '../../../debugging-coordinate-frames/attachments/workbench/model.js';

test('the original mixtures reproduce 83% and 43%, while common weights preserve ordering',()=>{
  for(const [policy,k] of [['A',83],['B',43]])assert.equal(counts.filter(r=>r.policy===policy).reduce((sum,r)=>sum+r.successes,0),k);
  assert.ok(Math.abs(mixed(.9,.2).A-.83)<1e-12);
  assert.ok(Math.abs(mixed(.9,.2).B-.43)<1e-12);
  assert.deepEqual(weighted(.5),{A:.55,B:.625});
  for(let w=0;w<=100;w++)assert.ok(weighted(w/100).B>weighted(w/100).A);
  assert.throws(()=>weighted(-1));
});
test('Wilson intervals match the article and remain finite at the boundaries',()=>{
  const [lo,hi]=wilson(2,10);
  assert.ok(Math.abs(lo-.05668)<.0001);assert.ok(Math.abs(hi-.50984)<.0001);
  for(const k of [0,10]){const ci=wilson(k,10);assert.ok(ci[0]>=0&&ci[1]<=1&&ci[0]<ci[1]);}
  assert.throws(()=>wilson(1,0));
});
test('extending a repeated experiment preserves all earlier outcomes and includes losses',()=>{
  const short=sample(20,7),long=sample(500,7);
  assert.deepEqual(long.trials.slice(0,20),short.trials);
  assert.deepEqual(sample(20,7),short);
  assert.notDeepEqual(sample(20,8).trials,short.trials);
  assert.ok(long.trials.some(r=>!r.A&&!r.B));
  assert.ok(Array.from({length:50},(_,i)=>sample(20,i+1)).some(r=>r.a>r.b));
  assert.equal(short.a,short.trials.reduce((s,r)=>s+r.A,0));
});
test('each mystery has a consistent inverse but fails at least one external fixture',()=>{
  for(const f of faults){
    assert.ok(near(inverse(observed(points.target,f),f),points.target));
    assert.ok(regression(f).some(r=>!r.pass));
    assert.deepEqual(candidates([evidence('x',f)]),[f]);
  }
  assert.deepEqual(candidates([evidence('origin','transpose')]),['transpose','scale']);
  assert.equal(candidates([evidence('roundtrip','transpose')]).length,3);
  assert.ok(regression('none').every(r=>r.pass));
  assert.ok(near(correct(points.target),[.2,-.1,1.5]));
});
test('external fixtures still detect an error if the shared transform implementation drifts',()=>{
  const original=translation[0];
  try { translation[0]+=.01; assert.ok(regression('none').every(r=>!r.pass)); }
  finally { translation[0]=original; }
});
test('control updates obey the documented units,delay and actuator limits',()=>{
  const run=simulate(presets.late);
  assert.ok(Math.abs(run.rows[1].position-.15)<1e-12);
  assert.equal(run.rows[0].raw,4);
  assert.equal(run.rows[0].command,1.5);
});
test('control recurrence and seeded noise are reproducible',()=>{
  const a=simulate({gain:4,delay:6,noise:.02}),b=simulate({gain:1,delay:6,noise:.02});
  for(const [i,r] of a.rows.entries()){
    assert.equal(r.source,Math.max(0,i-6));assert.ok(Math.abs(r.command)<=1.5);
    if(i<120)assert.ok(Math.abs(a.rows[i+1].position-r.next)<1e-12);
    const noiseA=r.observation-a.rows[r.source].position;
    const noiseB=b.rows[i].observation-b.rows[b.rows[i].source].position;
    assert.ok(Math.abs(noiseA-noiseB)<1e-12);
  }
  assert.deepEqual(simulate(a.config),a);
});
test('the experiment exhibits the claimed behaviors and has a solvable challenge',()=>{
  assert.ok(simulate(presets.calm).rms<.001);
  assert.ok(simulate(presets.late).rms>.3);
  assert.ok(simulate(presets.open).rows.at(-1).position>10);
  assert.ok(challengePassed(simulate({gain:1,delay:6,noise:.02})));
  assert.equal(challengePassed(simulate({gain:4,delay:6,noise:.02})),false);
  assert.throws(()=>simulate({gain:99}));
});
