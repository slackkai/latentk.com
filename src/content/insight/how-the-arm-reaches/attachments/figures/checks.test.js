// Run: node --test src/content/insight/how-the-arm-reaches/attachments/figures/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forward, solveTwoLink, twoLinkPose, dist, ccdStep, ccdSolve, pinnedThreeLink, shoulderRange, toAbsolute, toRelative } from './arm.js';
const base={x:80,y:252}, lens=[82,86,50];
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('both two-link branches hit each reachable target',()=>{
  for(const target of [{x:120,y:30},{x:-90,y:50},{x:0,y:-60},{x:165,y:0},{x:35,y:0}]) {
    const sols=solveTwoLink({x:0,y:0},100,65,target);
    assert.equal(sols.length,2);
    for(const s of sols)near(dist(forward({x:0,y:0},[100,65],s.angles).at(-1),target),0);
  }
});
test('unreachable and equal-length center poses are finite and closest',()=>{
  const b={x:0,y:0};
  for(const [target,distance] of [[{x:200,y:0},35],[{x:10,y:0},25]]) {
    const pose=twoLinkPose(b,100,65,target);
    assert.equal(pose.count,0);assert.ok(pose.angles.every(Number.isFinite));
    near(dist(forward(b,[100,65],pose.angles).at(-1),target),distance);
  }
  const center=twoLinkPose(b,50,50,b);
  assert.equal(center.count,Infinity);near(dist(forward(b,[50,50],center.angles).at(-1),b),0);
});
test('relative and absolute angles represent the same arm',()=>{
  const rel=[-.4,.8,-.3];toRelative(toAbsolute(rel)).forEach((v,i)=>near(v,rel[i]));
});
test('redundant shoulder interval keeps the tip pinned',()=>{
  const b={x:130,y:260}, lengths=[80,80,60], target={x:250,y:130};
  const [lo,hi]=shoulderRange(b,lengths,target)[0];
  for(let i=1;i<50;i++) {
    const angles=pinnedThreeLink(b,lengths,lo+(hi-lo)*i/50,target);
    assert.ok(angles);near(dist(forward(b,lengths,angles).at(-1),target),0);
  }
});
test('CCD decreases error and converges on example targets',()=>{
  for(const target of [{x:250,y:130},{x:100,y:100},{x:10,y:200}]) {
    const angles=[-Math.PI/2,-Math.PI/4,0];
    let last=dist(forward(base,lens,angles).at(-1),target);
    for(let n=0;n<3000;n++) {
      ccdStep(base,lens,angles,2-n%3,target,.6);
      const error=dist(forward(base,lens,angles).at(-1),target);
      assert.ok(error<=last+1e-7);last=error;
    }
    assert.ok(last<.05,`error ${last}`);
  }
});
test('helper matches the actual homepage solve loop numerically',()=>{
  const hero=readFileSync(new URL('../../../../../components/Hero.astro',import.meta.url),'utf8');
  const code=hero.slice(hero.indexOf('function solve(t:'),hero.indexOf('    function draw()',hero.indexOf('function solve(t:'))).replace('t: { x: number; y: number }','t');
  assert.ok(code.includes('iters = 6, gain = 0.6'));
  const target={x:220,y:90}, actual=[-Math.PI/2,-Math.PI/4,0], expected=actual.slice();
  const original=new Function('forward','ang',`${code};return solve;`)(a=>forward(base,lens,a),expected);
  original(target);ccdSolve(base,lens,actual,target);
  actual.forEach((v,i)=>near(v,expected[i],1e-12));
});
