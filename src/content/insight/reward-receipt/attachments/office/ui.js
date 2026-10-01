import { bestTrip, receipt, money, TERMS, priceOf } from './model.js';
import { setup, passed } from './lessons.js';
import { drawMap, ticket } from './drawing.js';
import { borrowFonts } from './frame.js';

export function mount(level) {
  borrowFonts();
  const {world,reference,config}=setup(level),root=document.querySelector('main');
  let prices={...config.prices},trip,step=0,timer=null;
  root.innerHTML=`<header><span class="tag">价目表实验</span><h1>${config.title}</h1></header><p>${config.intro}</p>
    <div class="office"><section class="paper"><svg class="chart" role="img"></svg><div class="legend"><span>蓝虚线：它的计划</span><span class="dash">灰点线：你想要的路线</span></div>
    <small>起＝充电桩，桌＝老板桌，险＝楼梯。</small></section>
    <section class="paper"><h2>你来定价</h2><p>送到 <strong>+10</strong> · 最多 30 步</p>
    <div class="knobs">${config.knobs.map(([key,label,min,max,delta])=>`<label>${label} <output id="${key}-value"></output><input data-term="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${delta}" value="${-(prices[key]??0)}"></label>`).join('')}</div>
    ${level===3?'<p><small>每步 −0.1 · 靠近 +1 · 坠落 −30</small></p>':''}
    ${level===4?'<p><small>每步 −0.1 · 坠落 −30</small></p>':''}
    <details><summary>卡住了？翻开一角</summary><p>${config.hint}</p><button id="repair">试试这张价目表</button></details></section></div>
    <div class="controls"><button id="play">开工，看它走</button><button id="next">走一步</button><button id="reset">恢复原价</button>
    <label>翻到第 <output id="time">0</output> 步<input id="timeline" aria-label="查看运行的第几步" type="range" min="0" max="30" step="1" value="0"></label></div>
    <p class="step-detail" aria-live="polite"></p>
    <div class="tickets"><section class="paper ticket actual"></section><section class="paper ticket expected"></section></div>
    <div class="result" role="status"></div><p class="goal">目标：${config.goal}</p>`;
  const svg=root.querySelector('svg'),timeline=root.querySelector('#timeline'),play=root.querySelector('#play');
  function stop(){clearTimeout(timer);timer=null;play.textContent='开工，看它走';}
  function draw(){
    drawMap(svg,world,trip,reference,step);timeline.value=step;root.querySelector('#time').textContent=step;
    const s=trip.steps[step-1];
    root.querySelector('.step-detail').textContent=s?`第 ${step} 步：${s.action==='wait'?'原地等':'移动一格'}；${s.events.filter(e=>e in prices).map(e=>`${TERMS[e].short} ${money(prices[e])}`).join('，')}。本步 ${money(priceOf(prices,s.events))}。`:'还在充电桩。';
  }
  function reprice(){
    stop();trip=bestTrip(world,prices);step=0;timeline.max=trip.length;
    for(const input of root.querySelectorAll('[data-term]')){
      input.value=-(prices[input.dataset.term]??0);
      root.querySelector(`#${input.dataset.term}-value`).textContent=money(prices[input.dataset.term]??0);
    }
    const a=receipt(trip,prices),b=receipt(reference,prices),delta=a.total-b.total;
    root.querySelector('.actual').innerHTML=ticket(a,'机器人挑的小票');
    root.querySelector('.expected').innerHTML=ticket(b,'你原本想要的小票');
    const pass=passed(level,trip);
    root.querySelector('.result').innerHTML=`${pass?'<span class="stamp">这单办妥</span> ':''}${Math.abs(delta)<1e-8?'两张小票同分。':`它选的走法比参考路线多 ${money(delta)} 分。`} ${pass?'':trip.end==='fall'?'它不是忘了送咖啡，而是在提前结束扣分。':level===4?'没有计价的损失，不会自动出现在优化目标里。':level===3?'多出来的靠近次数，是来回赚出来的。':'早到晚到同价，它没有理由为你赶时间。'}`;
    draw();
  }
  for(const input of root.querySelectorAll('[data-term]'))input.addEventListener('input',()=>{prices[input.dataset.term]=-Number(input.value);reprice();});
  root.querySelector('#reset').addEventListener('click',()=>{prices={...config.prices};reprice();});
  root.querySelector('#repair').addEventListener('click',()=>{prices={...prices,...config.fix};reprice();});
  root.querySelector('#next').addEventListener('click',()=>{stop();step=Math.min(step+1,trip.length);draw();});
  timeline.addEventListener('input',()=>{stop();step=Number(timeline.value);draw();});
  function tick(){step++;draw();if(step>=trip.length){stop();return;}timer=setTimeout(tick,280);}
  play.addEventListener('click',()=>{
    if(timer){stop();return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){step=trip.length;draw();return;}
    if(step>=trip.length)step=0;
    play.textContent='暂停';timer=setTimeout(tick,100);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  reprice();
}
