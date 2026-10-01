import {initLab,lineChart,saveText} from '../../../../uploads/reading-labs/lab.js';
import {defaults,presets,simulate,challengePassed} from './model.js';
initLab();
const root=document.querySelector('main'),$=s=>root.querySelector(s);
let config={...defaults},run,pinned=null,cursor=0,timer=null,challenge=false;
root.innerHTML=`<header class="lab-head"><div><span class="eyebrow">工作台 / 每一拍都能拆开看</span><h1>把小车送到 1 米处，别来回找位置</h1></div><button id="reset">重置工作台</button></header><p>每拍 0.1 秒；控制器根据误差给速度，速度限制在 ±1.5 m/s。只是一维离散教学模型，不连接硬件。</p><div class="controls"><button data-preset="calm">① 消息及时</button><button data-preset="late">② 消息晚六拍</button><button data-preset="hard">③ 再用力一点？</button><button data-preset="open">④ 拔掉反馈线</button></div><div class="controls"><label>用力程度 K：<output id="gain-value"></output><input id="gain" type="range" min="0.5" max="14" step="0.5" value="4"></label><label>消息延迟：<output id="delay-value"></output><input id="delay" type="range" min="0" max="12" step="1" value="0"></label><label>测量噪声幅度：<output id="noise-value"></output><input id="noise" type="range" min="0" max="0.1" step="0.01" value="0"></label></div><div class="controls"><label style="display:flex;align-items:center"><input id="feedback" type="checkbox" checked>接通反馈线</label><button id="pin">钉住当前曲线，再改一个条件</button><button id="clear-pin" hidden>取下对照</button></div><p id="pin-label" class="muted"></p><div id="chart"></div><section class="panel"><h2>暂停在一拍里面</h2><div class="controls"><button id="play">逐拍播放</button><button id="step">再走一拍</button><button id="rewind">回到第 0 拍</button></div><div id="track"></div><div id="mechanism"></div><p id="explain" class="feedback" role="status"></p><small>移动指针查看数值；拖动滑块或按方向键逐拍查看。</small></section><section class="panel"><h2>留一个自己的答案</h2><p>固定延迟 6 拍、噪声幅度 0.02 m，只调 K：在这 12 秒里，超调小于 25 cm，末 20 个采样点的均方根误差小于 5 cm，且 8 秒内进入 ±5 cm 并保持到观测结束。</p><div class="controls"><button id="challenge">锁定题目，开始调参</button><button id="report">保存配置与轨迹 CSV</button></div><p id="score" class="feedback" role="status"></p><details><summary>卡住时的一点线索</summary><p>消息迟到时，你还在替过去的误差使劲。先钉住振荡曲线，再把 K 往小调。不是越小越好：小车也可能慢得来不及完成任务。</p></details><small>通过只表示本模型、固定噪声序列与有限观测窗满足条件，不保证真实控制系统稳定。</small></section>`;
function stop(){clearInterval(timer);timer=null;$('#play').textContent='逐拍播放';}
function sync(){
  for(const key of ['gain','delay','noise'])$('#'+key).value=config[key];
  $('#feedback').checked=config.feedback;
  $('#delay').disabled=challenge;$('#noise').disabled=challenge;$('#feedback').disabled=challenge;
  $('#gain-value').textContent=`${config.gain.toFixed(1)} /s`;$('#delay-value').textContent=`${config.delay} 拍（${(config.delay*.1).toFixed(1)} s）`;$('#noise-value').textContent=`±${config.noise.toFixed(2)} m`;
  $('#clear-pin').hidden=!pinned;
  $('#pin-label').textContent=pinned?`钉住的对照：K=${pinned.config.gain}，延迟 ${pinned.config.delay} 拍，噪声 ±${pinned.config.noise} m，反馈${pinned.config.feedback?'开':'关'}。`:'可以先钉住一条曲线，之后只改一个条件。';
}
function draw(){
  stop();run=simulate(config);cursor=0;sync();
  const rows=run.rows.map((r,i)=>({x:r.x,current:r.position,...(pinned?{pinned:pinned.rows[i].position}:{})}));
  lineChart($('#chart'),{rows,series:[{key:'current',name:'当前'},...(pinned?[{key:'pinned',name:'钉住'}]:[])],title:'位置随时间变化 · 目标为 1 m',unit:'m',xLabel:'秒',reference:{value:1,label:'目标 1 m'}});
  $('#score').textContent=`${challenge?(challengePassed(run)?'✓ 这组参数过关。':'还没过关，再试一个 K。'):'当前表现：'} 超调 ${(run.overshoot*100).toFixed(1)} cm；末 20 点 RMS ${(run.rms*100).toFixed(1)} cm；${run.settled===null?'在观测窗内尚未持续停在目标带内':`${run.settled.toFixed(1)} s 起保持在目标 ±5 cm 内（截至 12 s）`}。`;
  renderStep();
}
function renderStep(){
  const r=run.rows[cursor],values=run.rows.map(r=>r.position),lo=Math.min(0,...values)-.1,hi=Math.max(1,...values)+.1;
  const x=p=>20+(p-lo)/(hi-lo)*360;
  $('#track').innerHTML=`<svg viewBox="0 0 400 70" class="mini-map" role="img" aria-label="第 ${cursor} 拍，小车位置 ${r.position.toFixed(3)} 米"><line class="axis" x1="20" x2="380" y1="35" y2="35"/><line class="axis" x1="${x(1)}" x2="${x(1)}" y1="10" y2="55"/><text x="${x(1)}" y="12" text-anchor="middle">目标 1 m</text><circle class="expected" cx="${x(r.position)}" cy="35" r="8"/><text x="20" y="65">${lo.toFixed(1)} m</text><text x="380" y="65" text-anchor="end">${hi.toFixed(1)} m</text></svg>`;
  $('#mechanism').innerHTML=`<p><strong>第 ${cursor} 拍 · ${r.x.toFixed(1)} s</strong>：现在实际在 ${r.position.toFixed(3)} m。</p><div class="table-wrap"><table><thead><tr><th>消息</th><th>误差</th><th>速度命令</th><th>下一拍位置</th></tr></thead><tbody><tr><td>${config.feedback?`来自第 ${r.source} 拍<br>${r.observation.toFixed(3)} m`:'反馈断开<br>始终按起点 0 m 计算'}</td><td>${r.error.toFixed(3)} m</td><td>${r.command.toFixed(3)} m/s</td><td>${r.next.toFixed(3)} m</td></tr></tbody></table></div>`;
  $('#explain').textContent=!config.feedback?'反馈线断开，小车已经到哪里不再影响命令。到达目标也不会自动收手。':Math.abs(r.raw)>1.5?`K × 误差 = ${r.raw.toFixed(3)} m/s，超过执行器限制，所以实际只给 ${r.command.toFixed(3)} m/s。继续加大 K，不会无限加速。`:config.delay>0?`眼前位置与控制器收到的消息并不相同：它依据第 ${r.source} 拍的测量发出命令。留意小车已经越线时，旧消息会不会还让它往前走。`:'消息及时。靠近目标后误差变小，速度命令也跟着收小。';
  const slider=$('#chart input');slider.value=cursor;slider.dispatchEvent(new Event('input'));
}
for(const key of ['gain','delay','noise'])$('#'+key).addEventListener('input',()=>{config[key]=Number($('#'+key).value);draw();});
$('#feedback').addEventListener('change',()=>{config.feedback=$('#feedback').checked;draw();});
root.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{challenge=false;config={...presets[b.dataset.preset]};draw();}));
$('#pin').addEventListener('click',()=>{pinned=run;draw();});
$('#clear-pin').addEventListener('click',()=>{pinned=null;draw();});
$('#reset').addEventListener('click',()=>{challenge=false;pinned=null;config={...defaults};draw();});
$('#challenge').addEventListener('click',()=>{challenge=true;config={gain:4,delay:6,noise:.02,feedback:true};draw();});
$('#play').addEventListener('click',()=>{if(timer){stop();return;}if(cursor===120)cursor=0;$('#play').textContent='暂停';timer=setInterval(()=>{cursor++;renderStep();if(cursor===120)stop();},140);});
$('#step').addEventListener('click',()=>{stop();cursor=Math.min(120,cursor+1);renderStep();});
$('#rewind').addEventListener('click',()=>{stop();cursor=0;renderStep();});
// Only a human slider event should drive the mechanism; renderStep dispatches an untrusted event to sync the plot.
$('#chart').addEventListener('input',event=>{if(event.isTrusted){stop();cursor=Number(event.target.value);renderStep();}});
$('#report').addEventListener('click',()=>saveText('feedback-trace.csv','gain,delay,noise,feedback,time_s,position_m,measurement_m,command_m_s\n'+run.rows.map(r=>`${config.gain},${config.delay},${config.noise},${config.feedback},${r.x},${r.position},${r.observation},${r.command}`).join('\n')+'\n','text/csv;charset=utf-8'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();}).observe(root);
draw();
