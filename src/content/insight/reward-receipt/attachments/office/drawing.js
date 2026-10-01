import { MAP, W, H, money, TERMS } from './model.js';

export function drawMap(svg, world, trip, reference, step) {
  const size=48,ox=22,oy=24;
  const at=id=>({x:ox+world.cells[id].x*size+size/2,y:oy+world.cells[id].y*size+size/2});
  let html='';
  MAP.forEach((row,y)=>[...row].forEach((ch,x)=>{
    const id=world.at(x,y),special=ch==='V'?world.vase>=0:ch==='C'?world.cat>=0:'DBS'.includes(ch);
    const fill=ch==='#'?'var(--pencil-12)':special?'var(--postit)':'var(--paper-2)';
    html+=`<rect x="${ox+x*size}" y="${oy+y*size}" width="${size-2}" height="${size-2}" rx="5" fill="${fill}" stroke="var(--pencil-25)" stroke-width="1"/>`;
    if(special)html+=`<text x="${at(id).x}" y="${at(id).y+5}" text-anchor="middle">${{D:'起',B:'桌',S:'险',V:'瓶',C:'猫'}[ch]}</text>`;
  }));
  const points=t=>[world.dock,...t.steps.map(s=>s.to)].map(id=>{const p=at(id);return `${p.x},${p.y}`;}).join(' ');
  html+=`<polyline points="${points(reference)}" fill="none" stroke="var(--pencil-60)" stroke-width="2" stroke-dasharray="3 6"/>
    <polyline points="${points(trip)}" fill="none" stroke="var(--pen)" stroke-width="3" stroke-dasharray="8 5" opacity=".7"/>`;
  const id=step===0?world.dock:trip.steps[step-1].to,p=at(id);
  html+=`<g transform="translate(${p.x} ${p.y})" stroke="var(--pencil)" stroke-width="2.5"><rect x="-12" y="-10" width="24" height="20" rx="7" fill="var(--postit-3)"/><path d="M0-10v-5M-8 10v4M8 10v4"/><circle cx="-4" cy="-1" r="1.4"/><circle cx="4" cy="-1" r="1.4"/></g>`;
  svg.setAttribute('viewBox',`0 0 ${W*size+44} ${H*size+48}`);
  svg.innerHTML=html;
  svg.setAttribute('aria-label',`办公室地图，第 ${step} 步，机器人在第 ${world.cells[id].x+1} 列、第 ${world.cells[id].y+1} 行。蓝虚线是最优计划，灰点线是参考路线。`);
}
export function ticket(receipt, title) {
  const route=receipt.route.map(p=>`${{wait:'等',walk:'走',pace:'来回'}[p.kind]} ×${p.n}`).join(' → ');
  const unlisted=receipt.unlisted.filter(x=>['fall','vase','cat'].includes(x.term));
  return `<h2>${title}</h2><p class="ticket-route">${route}</p><table><thead><tr><th>项目</th><th>次 × 单价</th><th>小计</th></tr></thead><tbody>
    ${receipt.lines.map(l=>`<tr><td>${TERMS[l.term].short}</td><td>${l.count} × ${money(l.price)}</td><td>${money(l.subtotal)}</td></tr>`).join('')}</tbody></table>
    <p class="sum"><span>合计</span><strong>${money(receipt.total)}</strong></p>
    <small>${receipt.length} 步 · ${{deliver:'送到',fall:'坠落结束',timeout:'电量用完'}[receipt.end]}</small>
    ${unlisted.length?`<p class="unlisted">发生但未计价：${unlisted.map(x=>TERMS[x.term].short).join('、')}</p>`:''}`;
}
