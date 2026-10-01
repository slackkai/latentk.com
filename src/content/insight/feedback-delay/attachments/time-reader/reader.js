import { initLab } from '../../../../uploads/reading-labs/lab.js';
import { simulate } from '../workbench/model.js';

initLab();
const root = document.querySelector('.time-reader');
const $ = selector => root.querySelector(selector);
let settings = { gain: 4, delay: 6, noise: 0, feedback: true };
let run = simulate(settings), step = 7;

function draw() {
  const row = run.rows[step];
  const width = Math.max(260, Math.round($('#track').clientWidth));
  const low = Math.min(0, ...run.rows.map(r => r.position)) - .15;
  const high = Math.max(1, ...run.rows.map(r => r.position)) + .2;
  const left = 72, right = width - 18;
  const x = value => left + (value - low) / (high - low) * (right - left);
  const direction = row.command >= 0 ? 1 : -1;
  const head = x(row.next), tail = x(row.position);
  const labelX = value => Math.max(left + 25, Math.min(right - 25, x(value)));
  $('#track').innerHTML = `<svg viewBox="0 0 ${width} 248" role="img" aria-label="第 ${step} 拍，实际位置 ${row.position.toFixed(3)} 米，收到第 ${row.source} 拍的位置 ${row.observation.toFixed(3)} 米，速度命令 ${row.command.toFixed(3)} 米每秒"><line class="target" x1="${x(1)}" x2="${x(1)}" y1="25" y2="211"/><text x="${labelX(1)}" y="18" text-anchor="middle">目标 1 m</text><text x="0" y="57">收到的</text><text x="0" y="76">消息</text><text x="0" y="90">${(row.source*.1).toFixed(1)} s</text><line class="rail" x1="${left}" x2="${right}" y1="70" y2="70"/><circle class="measured" cx="${x(row.observation)}" cy="70" r="8"/><text x="${labelX(row.observation)}" y="113" text-anchor="middle">${row.observation.toFixed(3)} m</text><text x="0" y="151">实际</text><text x="0" y="170">位置</text><text x="0" y="185">${row.x.toFixed(1)} s</text><line class="rail" x1="${left}" x2="${right}" y1="164" y2="164"/><circle class="actual" cx="${tail}" cy="164" r="8"/><path class="motion" d="M${tail} 164 H${head} M${head-direction*6} 158 L${head} 164 L${head-direction*6} 170"/><text x="${labelX(row.position)}" y="207" text-anchor="middle">${row.position.toFixed(3)} m</text><text x="${left}" y="240">${low.toFixed(1)} m</text><text x="${right}" y="240" text-anchor="end">${high.toFixed(1)} m</text></svg>`;
  $('#step').value = step;
  $('#step-value').textContent = step;
  $('#gain-value').textContent = `${settings.gain.toFixed(1)} /s`;
  $('#delay-value').textContent = `${settings.delay} 拍`;
  $('#previous').disabled = step === 0;
  $('#next').disabled = step === 119;
  root.querySelectorAll('[data-delay]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.delay) === settings.delay)));
  const sign = row.command > 0 ? '+' : '';
  $('#observation').textContent = row.position > 1 && row.command > 0
    ? `车已经越过目标 ${((row.position-1)*100).toFixed(1)} cm，旧消息却仍说没到。于是命令还是 ${sign}${row.command.toFixed(3)} m/s，继续往前。`
    : `实际位置 ${row.position.toFixed(3)} m；控制器依据第 ${row.source} 拍的 ${row.observation.toFixed(3)} m 作决定，发出 ${sign}${row.command.toFixed(3)} m/s 的命令。${settings.delay===0?'本模型无噪声，此时两份位置同步。':'空心点与实心点之间，是消息迟到后留下的差距。'}`;
  $('#ledger').innerHTML = `<div><dt>误差</dt><dd>1 − ${row.observation.toFixed(3)} = ${row.error.toFixed(3)} m</dd></div><div><dt>请求</dt><dd>${settings.gain} × ${row.error.toFixed(3)} = ${row.raw.toFixed(3)} m/s</dd></div><div><dt>限幅后</dt><dd>${row.command.toFixed(3)} m/s</dd></div><div><dt>下一拍</dt><dd>${row.position.toFixed(3)} + 0.1 × ${row.command.toFixed(3)} = ${row.next.toFixed(3)} m</dd></div>`;
}

$('#step').addEventListener('input', event => { step = Number(event.target.value); draw(); });
$('#previous').addEventListener('click', () => { step = Math.max(0, step-1); draw(); });
$('#next').addEventListener('click', () => { step = Math.min(119, step+1); draw(); });
for (const key of ['gain', 'delay']) {
  $('#'+key).addEventListener('input', event => {
    settings[key] = Number(event.target.value);
    run = simulate(settings);
    draw();
  });
}
root.querySelectorAll('[data-delay]').forEach(button => button.addEventListener('click', () => {
  settings.delay = Number(button.dataset.delay);
  $('#delay').value = settings.delay;
  run = simulate(settings);
  draw();
}));
const observer = new ResizeObserver(draw);
observer.observe($('#track'));
window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
draw();
