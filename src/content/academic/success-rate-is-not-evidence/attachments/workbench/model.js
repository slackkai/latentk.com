export const counts = [
  { policy:'A', scene:'无遮挡', successes:81, trials:90 },
  { policy:'A', scene:'有遮挡', successes:2, trials:10 },
  { policy:'B', scene:'无遮挡', successes:19, trials:20 },
  { policy:'B', scene:'有遮挡', successes:24, trials:80 },
];
export function weighted(easyShare) {
  if (!Number.isFinite(easyShare) || easyShare < 0 || easyShare > 1) throw new RangeError('weight must be between 0 and 1');
  return { A: easyShare * .9 + (1-easyShare) * .2, B: easyShare * .95 + (1-easyShare) * .3 };
}
export function mixed(aShare, bShare) { return { A:weighted(aShare).A, B:weighted(bShare).B }; }
export function wilson(k,n) {
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(k) || k < 0 || k > n) throw new RangeError('invalid counts');
  const z=1.959963984540054, p=k/n, d=1+z*z/n;
  const center=(p+z*z/(2*n))/d, radius=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [Math.max(0,center-radius),Math.min(1,center+radius)];
}
// Fixed PRNG: changing the sample size extends the same experiment, not a redraw.
export function sample(n, seed=1) {
  if (![20,100,500].includes(n)) throw new RangeError('unsupported sample size');
  let state=seed>>>0;
  const next=() => { state=(Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
  let a=0,b=0;
  const rows=[],trials=[];
  for(let i=1;i<=n;i++) {
    const A=next()<.55, B=next()<.625;
    a+=Number(A); b+=Number(B);
    rows.push({x:i,A:100*a/i,B:100*b/i});
    trials.push({trial:i,A:Number(A),B:Number(B)});
  }
  return {rows,trials,a,b,n,seed,intervalA:wilson(a,n),intervalB:wilson(b,n)};
}
