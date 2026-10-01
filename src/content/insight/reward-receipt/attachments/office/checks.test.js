// Run: node --test src/content/insight/reward-receipt/attachments/office/checks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { bestTrip, makeWorld, receipt, randomOdds, solve, stepOf, priceOf } from './model.js';
import { lessons, evaluate } from './lessons.js';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('every original price list misses its stated goal; each repair achieves it',()=>{
  for(const [key,c] of Object.entries(lessons)) {
    const level=Number(key);
    assert.equal(evaluate(level,c.prices).pass,false,`initial ${level}`);
    const repaired=evaluate(level,{...c.prices,...c.fix});
    assert.equal(repaired.pass,true,`repaired ${level}`);
    assert.ok(repaired.actual.total>=repaired.expected.total-1e-8);
  }
});
test('unpriced waiting ties immediate delivery, but a small cost removes it',()=>{
  const a=evaluate(1,lessons[1].prices);
  assert.equal(a.trip.length,30);assert.equal(a.actual.route[0].n,17);
  near(a.actual.total,10);near(a.expected.total,10);
  const b=evaluate(1,{deliver:10,step:-.1});assert.equal(b.trip.length,13);near(b.actual.total,8.7);
});
test('early termination wins only above the stated cost threshold',()=>{
  const world=makeWorld();
  assert.equal(bestTrip(world,{deliver:10,step:-.999}).end,'deliver');
  assert.equal(bestTrip(world,{deliver:10,step:-1.001}).end,'fall');
  const a=evaluate(2,lessons[2].prices);assert.equal(a.trip.length,3);near(a.actual.total,-6);near(a.expected.total,-16);
  const b=evaluate(2,{...lessons[2].prices,fall:-20});near(b.actual.total,-16);
});
test('approach-only reward buys eight round trips; symmetric shaping stops them',()=>{
  const a=evaluate(3,lessons[3].prices),b=evaluate(3,{...lessons[3].prices,away:-1});
  assert.equal(a.trip.length,29);assert.equal(a.actual.lines.find(l=>l.term==='closer').count,21);
  assert.equal(a.actual.route.find(p=>p.kind==='pace').n,8);near(a.actual.total,28.1);near(a.expected.total,21.7);
  assert.equal(b.trip.length,13);near(b.actual.total,21.7);
});
test('distance differences telescope on all office transitions',()=>{
  const world=makeWorld();
  for(const [from,moves] of world.moves.entries())for(const [,to] of moves){
    const events=stepOf(world,from,0,to).events;
    near(priceOf({closer:1,away:-1},events),world.dist[from]-world.dist[to]);
  }
});
test('side effect costs select the 13, 15, and 17 step routes',()=>{
  const base=lessons[4].prices;
  for(const [p,n,flags] of [[base,13,1],[{...base,vase:-1},15,2],[{...base,vase:-1,cat:-1},17,0]]){
    const a=evaluate(4,p);assert.equal(a.trip.length,n);assert.equal(a.trip.flags,flags);
  }
});
test('random policy outcome probabilities match the article and sum to one',()=>{
  const odds=randomOdds(makeWorld());near(odds.deliver,.001194380688122299,1e-15);
  near(odds.deliver+odds.fall+odds.timeout,1);
});
test('dynamic programming agrees with exhaustive search on a short horizon',()=>{
  const w=makeWorld(),prices={step:-.2,fall:-1,closer:.7,away:-.3},h=6;
  function brute(cell,flags,left){
    if(!left)return 0;
    return Math.max(...w.moves[cell].map(([,to])=>{const s=stepOf(w,cell,flags,to);return priceOf(prices,s.events)+(s.end?0:brute(to,s.flags,left-1));}));
  }
  const plan=solve(w,prices,h);near(plan.value[plan.key(0,w.dock,0)],brute(w.dock,0,h));
  const trip=bestTrip(w,prices,h);near(receipt(trip,prices).total,brute(w.dock,0,h));
  assert.deepEqual(trip,bestTrip(w,prices,h));
});
