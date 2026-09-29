import { initLab, esc, percent, lineChart, saveText } from '../../../../uploads/reading-labs/lab.js';
import { counts, mixed, sample } from './model.js';
initLab();
const root=document.querySelector('main');
const sampling=root.dataset.mode==='sampling';
let vote=null, aShare=.9, bShare=.2, locked=false, seed=7, n=20, result;
const $=s=>root.querySelector(s);

function compare() {
  root.innerHTML=`<header class="lab-head"><div><span class="eyebrow">01 / 打开成绩单</span><h1>如果只能选一个，你会选谁？</h1></div><button data-reset>重新判断</button></header><p>两种策略各做了 100 次。先作一个暂时的判断，再拆开看。这里没有联网投票，也不记录身份。</p><div class="grid"><button class="choice" data-vote="A"><small>策略 A · 83 / 100</small><strong>83% · 我选 A</strong></button><button class="choice" data-vote="B"><small>策略 B · 43 / 100</small><strong>43% · 我选 B</strong></button></div><div class="controls"><button data-vote="wait">还缺信息，我先不选</button></div><p class="feedback" id="choice-feedback" role="status" hidden></p><section id="opened" hidden><div class="table-wrap"><table><caption>原始教学计数：它们做的题，比例不同</caption><thead><tr><th>策略</th><th>场景</th><th>成功 / 次数</th><th>成功率</th></tr></thead><tbody>${counts.map(r=>`<tr><td>${r.policy}</td><td>${r.scene}</td><td>${r.successes} / ${r.trials}</td><td>${percent(r.successes/r.trials)}</td></tr>`).join('')}</tbody></table></div><section class="panel"><h2>试着换一张试卷</h2><p>下面固定两类题的成功率，只改变题目比例。滑动后的百分数是重配权重的估计，不是新增实测。</p><div class="controls"><label>A 的无遮挡任务：<output id="wa">90%</output><input id="a" type="range" min="0" max="100" value="90"></label><label>B 的无遮挡任务：<output id="wb">20%</output><input id="b" type="range" min="0" max="100" value="20"></label></div><div class="controls"><button id="same">让它们做同一张试卷</button><label style="display:flex;align-items:center"><input id="lock" type="checkbox">锁定相同任务比例</label><label style="display:flex;align-items:center"><input id="texture" type="checkbox">纹理辅助</label></div><div class="legend"><span><i class="bar-key"></i>策略 A</span><span><i class="bar-key second"></i>策略 B</span></div><div id="bars" class="chart"></div><p id="verdict" class="feedback" role="status"></p><p class="muted">试试看：锁定同一比例后，你还能让 A 的点估计超过 B 吗？</p></section><button id="report">保存这次判断的依据</button></section><small>全部是构造数据。这里比较点估计，不据此宣称统计显著或可以部署。</small>`;
  root.querySelectorAll('[data-vote]').forEach(button=>button.addEventListener('click',()=>{
    vote=button.dataset.vote;
    root.querySelectorAll('[data-vote]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('#opened').hidden=false; $('#choice-feedback').hidden=false;
    $('#choice-feedback').textContent=vote==='wait'?'你留下了一个好问题：它们做的是同一张试卷吗？现在打开分组记录。':`你暂时选了 ${vote}。先保留这个判断：打开分组记录后，你愿意改票吗？`;
    update();
  }));
  $('#a').addEventListener('input',()=>{aShare=Number($('#a').value)/100;if(locked)bShare=aShare;update();});
  $('#b').addEventListener('input',()=>{bShare=Number($('#b').value)/100;update();});
  $('#same').addEventListener('click',()=>{locked=true;aShare=bShare=.5;update();});
  $('#lock').addEventListener('change',()=>{locked=$('#lock').checked;if(locked)bShare=aShare;update();});
  $('#texture').addEventListener('change',()=>$('#bars').classList.toggle('texture',$('#texture').checked));
  $('#report').addEventListener('click',()=>{const r=mixed(aShare,bShare);saveText('comparison-notes.txt',`教学构造；初始选择：${vote}\nA 无遮挡权重 ${percent(aShare)}；B ${percent(bShare)}\n重配点估计 A ${percent(r.A)}；B ${percent(r.B)}\n原始计数 A:81/90,2/10；B:19/20,24/80\n相同试卷：${locked || aShare===bShare}\n没有进行显著性检验，不能从此直接推断部署表现。\n`);});
  $('[data-reset]').addEventListener('click',()=>{vote=null;aShare=.9;bShare=.2;locked=false;compare();});
}
function update() {
  const rates=mixed(aShare,bShare);
  $('#a').value=aShare*100;$('#b').value=bShare*100;$('#b').disabled=locked;$('#lock').checked=locked;
  $('#wa').textContent=`${Math.round(aShare*100)}%`;$('#wb').textContent=`${Math.round(bShare*100)}%`;
  $('#bars').innerHTML=Object.entries(rates).map(([name,rate],i)=>`<div class="bar-row" tabindex="0" aria-label="策略 ${name} 重配成功率 ${percent(rate)}"><b>${name}</b><span class="bar-track"><span class="bar ${i?'second':''}" style="width:${100*rate}%"></span></span><span>${percent(rate)}</span><span class="bar-hint">${name}：${percent(rate)}，尺度 0–100%</span></div>`).join('')+'<small>共同尺度：0% → 100%；文字数值也是图表的无障碍读法。</small>';
  const equal=Math.abs(aShare-bShare)<1e-9;
  $('#verdict').textContent=equal?`同一张试卷：B 比 A 高 ${(100*(rates.B-rates.A)).toFixed(1)} 个百分点。改变共同权重会改变差距，但这里不会改变点估计的顺序。`:`目前试卷仍不同。${rates.A>rates.B?'A':'B'} 的混合成绩更高，但这还不能给策略排座次。`;
}
function repeat() {
  root.innerHTML=`<header class="lab-head"><div><span class="eyebrow">02 / 重做一次，不改能力</span><h1>能力没变，成绩会不会变？</h1></div><button data-reset>回到第一轮</button></header><p>换一个假想世界：假定 A 每次独立成功的概率是 55%，B 是 62.5%。这两个数现在是模拟器的设定，不是上面数据已经证明的真值。</p><div class="controls"><label>每种策略各试几次<select id="size"><option value="20">20 次</option><option value="100">100 次</option><option value="500">500 次</option></select></label><button id="again">换一轮运气</button><button id="csv">保存逐次记录 CSV</button></div><p class="muted" id="seed"></p><div id="curve"></div><p id="sampling-feedback" class="feedback" role="status"></p><div class="table-wrap"><table><caption>本轮成绩及 95% Wilson 区间</caption><thead><tr><th>策略</th><th>成功 / 次数</th><th>区间</th></tr></thead><tbody id="intervals"></tbody></table></div><details><summary>看看最近十次，失败有没有被藏起来？</summary><div id="last-trials" class="table-wrap"></div></details><small>两路独立伯努利抽样，不是配对真机试验；固定种子可复现。扩大样本量延长同一轮序列，不保证每次都更接近真值。区间不是差值检验。</small>`;
  $('#size').value=n;
  $('#size').addEventListener('change',()=>{n=Number($('#size').value);drawSample();});
  $('#again').addEventListener('click',()=>{seed++;drawSample();});
  $('[data-reset]').addEventListener('click',()=>{seed=7;n=20;$('#size').value=n;drawSample();});
  $('#csv').addEventListener('click',()=>saveText(`teaching-sample-${seed}-${n}.csv`,'seed,trial,A,B\n'+result.trials.map(t=>`${seed},${t.trial},${t.A},${t.B}`).join('\n')+'\n','text/csv;charset=utf-8'));
  drawSample();
}
function drawSample() {
  result=sample(n,seed);
  $('#seed').textContent=`本轮种子 ${seed}；A、B 各 ${n} 次。图上每一点是截至当时的累计成功率。`;
  lineChart($('#curve'),{rows:result.rows,series:[{key:'A',name:'A'},{key:'B',name:'B'}],title:'同一种能力，可以走出不同的成绩曲线',unit:'%',domain:[0,100],xLabel:'次',format:v=>v.toFixed(0)});
  $('#intervals').innerHTML=[['A',result.a,result.intervalA],['B',result.b,result.intervalB]].map(([name,k,ci])=>`<tr><td>${name}</td><td>${k} / ${n}（${percent(k/n)}）</td><td>${ci.map(percent).join('–')}</td></tr>`).join('');
  $('#sampling-feedback').textContent=result.a>=result.b?'这一轮 A 没有落后，但模拟器里 B 的成功概率仍更高。一次观测排序，不等于能力排序。':'这一轮 B 领先。试着换一轮，或把同一轮延长到 100 次：领先幅度会不会保持不变？';
  $('#last-trials').innerHTML=`<table><thead><tr><th>次序</th><th>A</th><th>B</th></tr></thead><tbody>${result.trials.slice(-10).map(t=>`<tr><td>${t.trial}</td><td>${t.A?'成功':'失败'}</td><td>${t.B?'成功':'失败'}</td></tr>`).join('')}</tbody></table>`;
}
if(sampling)repeat();else compare();
