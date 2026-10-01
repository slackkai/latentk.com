import { sampleDots, sd, histogram } from './model.js';

export function mount(root) {
  root.innerHTML = `<header><span class="tag">一 · 先估一估</span><h1>维度变大，点积会长多快？</h1></header>
    <p>从 4 维换成 512 维，维度翻了 128 倍。点积的标准差呢？</p>
    <div class="controls"><label>我的估计：<output id="guess">16.0 倍</output>
    <input id="bet" aria-label="估计标准差放大几倍，对数刻度" type="range" min="0" max="7" step="0.05" value="4">
    <span class="ticks"><span>1 倍</span><span>√128 ≈ 11.3</span><span>128 倍</span></span></label>
    <button id="measure">不押注，直接测</button></div>
    <div class="paper"><svg class="chart" viewBox="0 0 600 250" role="img" aria-label="点积直方图：等待测量"></svg>
    <small>每组抽 2500 对独立标准正态向量；两张图共用横轴与纵轴，比较的是分布的宽度。</small></div>
    <div class="result" role="status">留下你的估计，再点「测一测」。</div>
    <div class="controls"><button id="resample" hidden>换一批向量</button><small id="seed"></small></div>`;
  const bet = root.querySelector('#bet'), button = root.querySelector('#measure');
  const chart = root.querySelector('svg'), result = root.querySelector('.result');
  let predicted = false, seed = 41;
  bet.addEventListener('input', () => {
    predicted = true;
    root.querySelector('#guess').textContent = `${(2 ** Number(bet.value)).toFixed(1)} 倍`;
    button.textContent = '留下这个猜测，测一测';
  });
  const axes = () => [-60, -30, 0, 30, 60].map(x => {
    const px = 45 + (x + 70) / 140 * 530;
    return `<path class="grid" d="M${px} 18V216"/><text x="${px}" y="239" text-anchor="middle">${x}</text>`;
  }).join('');
  chart.innerHTML = `${axes()}<text x="300" y="80" text-anchor="middle">d = 4</text><text x="300" y="173" text-anchor="middle">d = 512</text>`;
  function measure() {
    const a = sampleDots(4, 2500, seed), b = sampleDots(512, 2500, seed + 1);
    const ca = histogram(a, -70, 70, 56), cb = histogram(b, -70, 70, 56);
    const max = Math.max(...ca, ...cb), sa = sd(a), sb = sd(b), ratio = sb / sa;
    const bars = (counts, y, cls) => counts.map((n, i) => {
      const height = n / max * 66;
      return `<rect class="${cls}" x="${45 + i * 530 / 56}" y="${y - height}" width="${530 / 56 - .7}" height="${height}" rx="1"/>`;
    }).join('');
    chart.innerHTML = `${axes()}${bars(ca, 103, 'raw')}${bars(cb, 209, 'scaled')}
      <path class="axis" d="M45 104H575M45 210H575"/>
      <text x="50" y="27">4 维 · σ = ${sa.toFixed(2)}</text><text x="50" y="134">512 维 · σ = ${sb.toFixed(2)}</text>`;
    chart.setAttribute('aria-label', `点积标准差：4 维 ${sa.toFixed(2)}，512 维 ${sb.toFixed(2)}，比值 ${ratio.toFixed(2)}`);
    result.innerHTML = `${predicted ? `你的图钉在 ${(2 ** Number(bet.value)).toFixed(1)} 倍。` : ''}这次测到 <strong>${ratio.toFixed(2)} 倍</strong>，靠近 √128 ≈ 11.31，而不是 128。正负项相互抵消：总和会变宽，却没有一项项同方向叠起来。`;
    root.querySelector('#resample').hidden = false;
    root.querySelector('#seed').textContent = `超出 ±70 的样本计入两端格子。`;
    button.textContent = '用同一批再核对';
  }
  button.addEventListener('click', measure);
  root.querySelector('#resample').addEventListener('click', () => { seed += 2; measure(); });
}
