import { DIMS, SCALES, spreadCurve, scoreShape, weigh } from './model.js';

export function mount(root) {
  const samples = spreadCurve(1000, 70), shape = scoreShape(41);
  let mode = 'none';
  const names = { none: '不缩放', sqrt: '除以 √d', linear: '除以 d' };
  root.innerHTML = `<header><span class="tag">三 · 选一把尺子</span><h1>哪种缩放能让宽度留在原地？</h1></header>
    <div class="controls" role="group" aria-label="缩放方法">${Object.entries(names).map(([key, name]) => `<button data-mode="${key}" aria-pressed="${key === mode}">${name}</button>`).join('')}</div>
    <section class="paper"><svg class="chart" viewBox="0 0 600 270" role="img"></svg>
    <div class="legend"><span>独立抽样测得的标准差</span><span class="dash">假设下的理论值</span></div><small>两轴都是对数刻度；每个维度各取 1000 对向量，切换方法时不换样本。</small></section>
    <div class="controls"><label>看看这个维度：<output></output><input type="range" min="0" max="7" step="1" value="7" aria-label="选择维度，从4到512"></label></div>
    <div class="metrics"><div class="metric"><small>这一维度测得的标准差</small><b id="spread"></b></div><div class="metric"><small>同形分数中赢家的份额</small><b id="winner"></b></div></div>
    <div class="result" role="status"></div><small>份额示意沿用上一张实验纸的固定分数形状，只乘理论尺度；不是把直方图样本当作一行注意力。</small>`;
  const input = root.querySelector('input'), svg = root.querySelector('svg');
  const x = i => 55 + i * 72, y = s => 226 - (Math.log2(s) + 5) / 10 * 200;
  function render() {
    const i = Number(input.value), d = DIMS[i], theory = Math.sqrt(d) * SCALES[mode](d);
    const curve = samples.map((p, j) => `${x(j)},${y(p[mode])}`).join(' ');
    const expected = DIMS.map((n, j) => `${x(j)},${y(Math.sqrt(n) * SCALES[mode](n))}`).join(' ');
    svg.innerHTML = [1 / 16, 1 / 4, 1, 4, 16].map(v => `<path class="grid" d="M55 ${y(v)}H559"/><text x="45" y="${y(v) + 5}" text-anchor="end">${v}</text>`).join('') +
      DIMS.map((n, j) => `<text x="${x(j)}" y="252" text-anchor="middle">${n}</text>`).join('') +
      `<text x="55" y="17">标准差</text><polyline class="theory" points="${expected}"/><polyline class="curve" points="${curve}"/>
      <path class="axis" d="M${x(i)} 24V228"/><circle cx="${x(i)}" cy="${y(samples[i][mode])}" r="5" fill="var(--paper-2)" stroke="var(--marker)" stroke-width="3"/>`;
    svg.setAttribute('aria-label', `${names[mode]}：维度 ${d}，测得标准差 ${samples[i][mode].toFixed(3)}，理论值 ${theory.toFixed(3)}`);
    root.querySelector('output').textContent = `d = ${d}`;
    root.querySelector('#spread').textContent = samples[i][mode].toFixed(3);
    root.querySelector('#winner').textContent = `${(weigh(shape, theory).share * 100).toFixed(1)}%`;
    root.querySelector('.result').textContent = mode === 'sqrt' ? '除以 √d：原本按 √d 增长的宽度被抵消，留下大致水平的一条线。实验有抽样误差，不会每一点都恰好等于 1。' : mode === 'linear' ? '除以 d：宽度反而按 1/√d 缩小。同一形状的分数被挤在一起，softmax 越来越接近每个位置 1/8。' : '不缩放：维度越大，分数越分散。沿着线往右走，同形分数的赢家越来越接近独占。';
    for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  for (const button of root.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { mode = button.dataset.mode; render(); });
  input.addEventListener('input', render);
  render();
}
