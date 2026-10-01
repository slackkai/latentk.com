import { forward, toRad, dist, twoLinkPose, pinnedThreeLink, shoulderRange, ccdStep, ccdSolve, clamp, toRelative } from './arm.js';
import { canvas, pedestal, ArmView, svgEl, setAttrs, handle, moveTo, crosshair, ringPath } from './draw.js';
import { draggable, onTap } from './drag.js';
import { shell, readoutRows, button, slider, reducedMotion, num, deg } from './panel.js';

export function mount(mode) {
  const titles = { inverse:'图 2 · 两个肘，和一个圆环', redundant:'图 3 · 指尖不动，肩膀还可以动', ccd:'图 4 · 一次只劝一个关节', homepage:'图 5 · 首页的那组参数' };
  const hints = { inverse:'拖十字靶，或在纸上点一下。方向键也能挪靶子。', redundant:'拖动肩角滑块。指尖钉住，后两节自动配合。', ccd:'先点「只转一个关节」，看两条虚线怎么靠近。', homepage:'拖十字靶，比较不同转动比例下的误差。' };
  const ui = shell(titles[mode], hints[mode]), rows = readoutRows(ui.readout);
  const isTwo = mode === 'inverse', isPinned = mode === 'redundant';
  const base = isTwo ? { x:210, y:190 } : isPinned ? { x:130, y:260 } : { x:80, y:252 };
  const lens = isTwo ? [100,65] : isPinned ? [80,80,60] : [82,86,50];
  let target = isTwo ? { x:325,y:120 } : { x:250,y:130 };
  let angles = [-Math.PI/2,-Math.PI/4,0], bend = 1, next = 2, steps = 0, gain = .6, iters = 6;
  let running = false, timer = null, frames = 0;
  const svg = canvas(ui.stage, 420, 380, titles[mode]);
  if (!isTwo && !isPinned) svg.setAttribute('viewBox', '-150 10 540 480');
  const zone = svgEl('path', { class:'zone' }, svg);
  const ghost = new ArmView(svg, lens.length, { ghost:true });
  pedestal(svg, base);
  const arm = new ArmView(svg, lens.length), rayTip = svgEl('line', { class:'ray is-tip' }, svg), rayTarget = svgEl('line', { class:'ray is-target' }, svg);
  const active = svgEl('circle', { class:'active-ring', r:12 }, svg);
  const grip = crosshair(svg), drag = handle(svg, '移动目标，方向键每次五单位', 'button');
  const range = isPinned ? shoulderRange(base,lens,target)[0] : null;
  let shoulder = isPinned ? (range[0] + range[1]) / 2 : 0;
  let playback;
  function draw() {
    ghost.show(false); active.style.display = rayTip.style.display = rayTarget.style.display = 'none';
    let info = null;
    if (isTwo) {
      zone.setAttribute('d', ringPath(base,lens[0]+lens[1],Math.abs(lens[0]-lens[1])));
      info = twoLinkPose(base,...lens,target,bend,.001); angles = info.angles;
      if (info.other) { ghost.show(true); ghost.update(forward(base,lens,info.other),info.other); }
    } else if (isPinned) angles = pinnedThreeLink(base,lens,shoulder,target) ?? angles;
    const pts = forward(base,lens,angles), end = pts.at(-1), error = dist(end,target);
    arm.update(pts,angles); moveTo(grip,target); moveTo(drag,target);
    drag.setAttribute('aria-label', `目标 x ${num(target.x)}，y ${num(target.y)}；方向键移动`);
    if (mode === 'ccd') {
      const pivot = pts[next];
      for (const [line,p] of [[rayTip,end],[rayTarget,target]]) {
        setAttrs(line,{x1:pivot.x,y1:pivot.y,x2:p.x,y2:p.y}); line.style.display = '';
      }
      setAttrs(active,{cx:pivot.x,cy:pivot.y}); active.style.display = '';
    }
    if (isTwo) {
      rows([['解的个数',info.count === Infinity ? '无穷' : String(info.count)],['距离肩膀',num(dist(base,target))],['可达距离','35–165'],['指尖误差',num(error)]]);
      ui.note.textContent = info.count === 2 ? '实线与虚线的肘朝不同方向，却落在同一个目标上。只指定指尖位置，还没有指定手臂的姿势。' : info.count === 1 ? '贴着圆环边缘，两个解重合。边界姿态就像三角形被压成了一条线。' : info.kind === 'near' ? '不是越近越容易：两节长度不同，折到最紧也有 35 单位的空隙。现在画的是最近姿态。' : '目标太远。伸直也只有 165 单位；没有解时，画得再努力也不能改变杆长。';
    } else if (isPinned) {
      rows([['肩角',deg(shoulder)],['指尖误差',error.toFixed(8)],['连杆长度','80 / 80 / 60']]);
      ui.note.textContent = '肩膀转动，后两节配合，指尖仍停在目标上。';
    } else {
      rows([['已转关节次数',String(steps)],['指尖误差',error.toFixed(2)],['下一关节',mode === 'ccd' ? ['肩','肘','腕'][next] : '腕 → 肘 → 肩']]);
      ui.note.textContent = mode === 'ccd' ? '圈出的是下一次要转的关节。蓝线指向指尖，橙线指向目标；只转这一处，后面的连杆一起跟着走。' : '比较转动比例与指尖误差，再试一个更远的目标。';
    }
    return error;
  }
  function stop() { running=false; clearTimeout(timer); if (playback) playback.textContent='连着转一会儿'; }
  function advance() {
    if (mode === 'ccd') { ccdStep(base,lens,angles,next,target,1); next=(next+2)%3; steps++; }
    else { ccdSolve(base,lens,angles,target,iters,gain); steps+=iters*3; }
    return draw();
  }
  function animate() {
    if (!running) return;
    const error=advance(); frames++;
    if (error<.05 || frames>=120) { stop(); ui.say(`计算结束，误差 ${error.toFixed(2)}`); return; }
    timer=setTimeout(animate,mode==='ccd'?350:35);
  }
  if (isTwo) {
    button(ui.controls,'换另一只肘',()=>{bend*=-1;draw();ui.say('已切换解支');});
    button(ui.controls,'放到外圈',()=>{target={x:base.x+165,y:base.y};draw();});
    button(ui.controls,'放进内圈',()=>{target={x:base.x+10,y:base.y};draw();});
  } else if (isPinned) {
    drag.style.display='none';
    slider(ui.controls,{label:'肩角（可行范围）',min:range[0]+.001,max:range[1]-.001,step:.005,value:shoulder,format:deg,onInput:v=>{shoulder=v;draw();}});
  } else {
    button(ui.controls,mode==='ccd'?'只转一个关节':'算一帧',()=>{stop();advance();ui.say(`误差 ${draw().toFixed(2)}`);});
    playback=button(ui.controls,'连着转一会儿',()=>{
      if(running){stop();return;}
      if(reducedMotion()){for(let i=0;i<120;i++)if(advance()<.05)break;ui.say('已直接给出终态');return;}
      running=true;frames=0;playback.textContent='暂停';animate();
    });
    button(ui.controls,'回到初姿态',()=>{stop();angles=[-Math.PI/2,-Math.PI/4,0];steps=0;next=2;draw();},true);
    if(mode==='homepage') {
      slider(ui.controls,{label:'每次转过去的比例',min:.05,max:1,step:.05,value:gain,format:v=>v.toFixed(2),onInput:v=>{gain=v;}});
      slider(ui.controls,{label:'每帧从腕到肩扫几遍',min:1,max:10,step:1,value:iters,onInput:v=>{iters=v;}});
    }
  }
  function aim(p) {
    stop();target={x:clamp(p.x,isTwo?15:-120,isTwo?405:350),y:clamp(p.y,25,isTwo?355:465)};
    if(mode==='homepage') {ccdSolve(base,lens,angles,target,iters,gain);steps+=iters*3;}
    draw();
  }
  if(!isPinned) {
    draggable(svg,drag,{onMove:aim,onKey:(dx,dy,big)=>aim({x:target.x+dx*(big?20:5),y:target.y+dy*(big?20:5)}),onEnd:()=>ui.say(`目标已移动，误差 ${draw().toFixed(2)}`)});
    onTap(svg,aim);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  draw();
}
