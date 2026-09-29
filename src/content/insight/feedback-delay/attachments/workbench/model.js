export const defaults={gain:4,delay:0,noise:0,feedback:true};
export const presets={calm:{...defaults},late:{...defaults,delay:6},hard:{...defaults,gain:10,delay:6},open:{...defaults,feedback:false}};
export function simulate({gain=4,delay=0,noise=0,feedback=true}={}) {
  if(!Number.isFinite(gain)||gain<.5||gain>14||!Number.isInteger(delay)||delay<0||delay>12||!Number.isFinite(noise)||noise<0||noise>.1)throw new RangeError('invalid controller settings');
  const dt=.1,target=1, positions=[0],rows=[];
  let state=23;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<=120;i++) {
    const source=Math.max(0,i-delay), observation=positions[source]+noise*(2*random()-1);
    const error=target-(feedback?observation:0), raw=gain*error,command=Math.max(-1.5,Math.min(1.5,raw));
    rows.push({x:Number((i*dt).toFixed(1)),step:i,position:positions[i],source,observation,error,command,raw,next:positions[i]+dt*command});
    positions.push(positions[i]+dt*command);
  }
  const rms=Math.sqrt(rows.slice(-20).reduce((sum,r)=>sum+(r.position-target)**2,0)/20);
  const overshoot=Math.max(0,...rows.map(r=>r.position-target));
  const settled=rows.findIndex((r,i)=>rows.slice(i).every(p=>Math.abs(p.position-target)<=.05));
  return {rows,rms,overshoot,settled:settled<0?null:rows[settled].x,config:{gain,delay,noise,feedback}};
}
export function challengePassed(run){return run.config.feedback&&run.config.delay===6&&run.config.noise===.02&&run.rms<.05&&run.overshoot<.25&&run.settled!==null&&run.settled<=8;}
