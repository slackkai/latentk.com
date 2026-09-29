import { initLab, esc, saveText } from '../../../../uploads/reading-labs/lab.js';
import { faults,labels,evidence,candidates,regression,near } from './model.js';
initLab();
const root=document.querySelector('main'), $=s=>root.querySelector(s);
const names={transpose:'旋转方向写反了',translation:'平移量多了 10 cm',scale:'毫米没有换成米'};
let fault=faults[0], records=[], hypothesis=null, repaired=false, active=null;
const vector=a=>`(${a.map(v=>v.toFixed(3)).join(', ')})`;
root.innerHTML=`<header class="lab-head"><div><span class="eyebrow">案卷 / 一次抓偏，三种解释</span><h1>先查哪条线索，由你决定</h1></div><button id="reset">重新开卷</button></header><p>夹具给出的坐标对应是独立参照。测试不会让任何真实机械臂运动；所有案卷都是人为构造。</p><div class="controls"><label>案卷<select id="case"><option value="transpose">一 · 开场那次抓偏</option><option value="translation">二 · 换一个故障重查</option><option value="scale">三 · 再换一个故障</option></select></label></div><section class="panel"><h2>已知约定</h2><p>列向量、米；C 原点在 B 中为 (0.4, −0.2, 0.5)。C 的 +x 应朝 B 的 +y，C 的 +y 应朝 B 的 −x，z 不变。</p><p id="opening"></p></section><section class="panel"><h2>选择检查，不必按顺序</h2><div class="controls" id="probes">${Object.entries(labels).map(([key,label])=>`<button data-probe="${key}">${esc(label)}</button>`).join('')}</div><div id="current" hidden><p id="probe-title"></p><div class="legend"><span><i class="key"></i>○ 夹具预期</span><span><i class="key second"></i>× 程序输出</span></div><div id="map"></div><output class="readout" id="map-readout" aria-live="polite"></output><p id="probe-comment" class="feedback" role="status"></p></div><details><summary>需要一点查案提示？</summary><p>原点只会留下平移量；非零的轴向点才会让旋转露面。往返检查可能让两处配套错误互相抵消。</p></details></section><section class="panel"><h2>你的证据夹</h2><p id="empty">还没有主动检查。上面的目标点只是报警现场，先挑一个能区分解释的测试。</p><div class="table-wrap"><table id="record-table" hidden><thead><tr><th>检查</th><th>预期 / m</th><th>实际 / m</th><th>相符？</th></tr></thead><tbody id="records"></tbody></table></div><p id="remaining" class="muted"></p></section><section class="panel"><h2>提出解释，再试一个最小修复</h2><div class="controls">${faults.map(f=>`<button data-hyp="${f}" aria-pressed="false">${names[f]}</button>`).join('')}</div><button id="repair" disabled>按这个解释修复并回归</button><p id="diagnosis" class="feedback" role="status">先选一个解释。猜错不会扣分，证据不足时也可以继续检查。</p><div id="closed" hidden><h3>还没查过的点，也要过关</h3><ul id="regression"></ul><button id="report">保存这份诊断记录</button><p>这只结清了数值变换这一环，不代表相机标定、规划与真机抓取都已验证。可以换一个案卷，看同样的方法是否还管用。</p></div></section>`;
function opening(){const r=evidence('target',fault);$('#opening').textContent=`报警现场：同一个 C 点 ${vector(r.input)}，夹具预期 B=${vector(r.expected)}，程序却给出 ${vector(r.actual)}。`;}
function renderRecord(r){
  $('#current').hidden=false;$('#probe-title').textContent=`${labels[r.key]} · 结果在 ${r.space} 坐标系中比较（XY 投影）`;
  const values=[0,...r.expected.slice(0,2),...r.actual.slice(0,2)];
  let lo=Math.min(...values),hi=Math.max(...values);const pad=Math.max((hi-lo)*.2,.12);lo-=pad;hi+=pad;
  const x=v=>75+(v-lo)/(hi-lo)*190, y=v=>225-(v-lo)/(hi-lo)*190;
  const e=r.expected,a=r.actual;
  $('#map').innerHTML=`<svg class="mini-map" viewBox="0 0 360 260" role="img" aria-label="预期与实际位置；完整三维坐标在下方"><line class="axis" x1="75" x2="265" y1="${y(0)}" y2="${y(0)}"/><line class="axis" x1="${x(0)}" x2="${x(0)}" y1="30" y2="225"/><text x="275" y="249">x / m</text><text x="8" y="20">y / m</text><text x="75" y="249">${lo.toFixed(2)}</text><text x="300" y="20" text-anchor="end">范围至 ${hi.toFixed(2)} m</text><g tabindex="0" data-point="expected" aria-label="预期 ${vector(e)}"><circle cx="${x(e[0])}" cy="${y(e[1])}" r="15" fill="transparent"/><circle class="expected" cx="${x(e[0])}" cy="${y(e[1])}" r="7"/></g><g tabindex="0" data-point="actual" aria-label="实际 ${vector(a)}"><circle cx="${x(a[0])}" cy="${y(a[1])}" r="15" fill="transparent"/><path class="actual" d="M${x(a[0])-6},${y(a[1])-6} l12,12 m-12,0 l12,-12"/></g></svg>`;
  const describe=kind=>{$('#map-readout').textContent=kind?`${kind==='expected'?'夹具预期':'程序输出'}：${vector(r[kind])} m`:`预期 ${vector(e)}；实际 ${vector(a)} m。投影只画 x/y，z 以这里的完整数字为准。`;};
  describe();
  $('#map').querySelectorAll('[data-point]').forEach(el=>{el.addEventListener('pointerenter',()=>describe(el.dataset.point));el.addEventListener('focus',()=>describe(el.dataset.point));el.addEventListener('pointerleave',()=>describe());el.addEventListener('blur',()=>describe());});
  $('#probe-comment').textContent=r.key==='roundtrip'?'往返成功，只能说明这一对函数能把东西送回来。它们可能配套地弄错方向、偏移或尺度；还需要外部夹具。':near(e,a)?'这一点相符。但只测对一个点，还不能保证整个变换正确。':'这一点不相符。先对照几种解释：哪一种能同时解释已收集的所有结果？';
}
function update(){
  $('#empty').hidden=records.length>0;$('#record-table').hidden=!records.length;
  $('#records').innerHTML=records.map(r=>`<tr><td>${labels[r.key]}</td><td>${vector(r.expected)}</td><td>${vector(r.actual)}</td><td>${near(r.expected,r.actual)?'相符':'不符'}</td></tr>`).join('');
  const left=candidates(records);
  $('#remaining').textContent=records.length?`与现有记录仍相容的解释：${left.map(f=>names[f]).join('、')}。这只是在本例列出的三种假设中筛选，不证明没有第四种原因。`:'';
  root.querySelectorAll('[data-probe]').forEach(b=>b.setAttribute('aria-pressed',String(records.some(r=>r.key===b.dataset.probe))));
}
function reset(){records=[];hypothesis=null;repaired=false;active=null;$('#current').hidden=true;$('#closed').hidden=true;$('#repair').disabled=true;$('#diagnosis').textContent='先选一个解释。猜错不会扣分，证据不足时也可以继续检查。';root.querySelectorAll('[data-hyp]').forEach(b=>b.setAttribute('aria-pressed','false'));opening();update();}
root.addEventListener('click',event=>{
  const probe=event.target.closest('[data-probe]');
  if(probe){active=evidence(probe.dataset.probe,repaired?'none':fault);if(!repaired&&!records.some(r=>r.key===active.key))records.push(active);renderRecord(active);update();}
  const choice=event.target.closest('[data-hyp]');
  if(choice&&!repaired){hypothesis=choice.dataset.hyp;root.querySelectorAll('[data-hyp]').forEach(b=>b.setAttribute('aria-pressed',String(b===choice)));$('#repair').disabled=false;}
});
$('#repair').addEventListener('click',()=>{
  if(hypothesis!==fault){$('#diagnosis').textContent='这项修复解释不了实际故障。没有改动现场；回到证据夹，找一个能区分它与其他原因的测试。';return;}
  if(candidates(records).length!==1){$('#diagnosis').textContent='你选中了本例的原因，但证据还不足以排除其他解释。再检查一个非零轴向点，把猜中变成可复查的判断。';return;}
  repaired=true;$('#repair').disabled=true;$('#closed').hidden=false;
  $('#diagnosis').textContent=`修复：${names[fault]}。已经改正这一环，并对原点、三个基向量和目标点重新计算。下面的原始证据仍保留，不会被改后结果覆盖。`;
  $('#regression').innerHTML=regression('none').map(r=>`<li>✓ ${labels[r.key]}：与独立夹具相符</li>`).join('');
});
$('#reset').addEventListener('click',reset);
$('#case').addEventListener('change',()=>{fault=$('#case').value;reset();});
$('#report').addEventListener('click',()=>saveText('coordinate-case.txt',`教学构造，无真机连接\n约定：列向量、米，C 到 B\n诊断：${names[fault]}\n原始证据：\n${records.map(r=>`${labels[r.key]}：预期${vector(r.expected)}；实际${vector(r.actual)}`).join('\n')}\n修复后：五个独立数值夹具均通过\n未覆盖：真实标定、时间同步、规划与控制。\n`));
reset();
