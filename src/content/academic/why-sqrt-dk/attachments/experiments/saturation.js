import { scoreShape, weigh, sensitivity } from './model.js';

export function mount(root) {
  const shape = scoreShape(41);
  root.innerHTML = `<header><span class="tag">二 · 放大同一行</span><h1>赢家越自信，越不容易改变吗？</h1></header>
    <p>这里不换向量，只把同一行分数一起放大。谁高谁低不变，差距变大。</p>
    <div class="controls"><label>分数尺度 <output id="scale">1.0</output>
    <input aria-label="分数尺度" type="range" min="0" max="5" step="0.05" value="0"></label>
    <button id="saturate">放大到 32 倍</button><button id="reset">回到 1 倍</button></div>
    <div class="grid-two"><section class="paper"><h2>分数 → 注意力份额</h2><div class="rows"></div><small>橙色是本行赢家 H；这里的 A–H 是位置编号，不是真实词语。</small></section>
    <section class="paper"><h2>赢家自己的灵敏度</h2><div class="metrics">
    <div class="metric"><small>拿走的份额</small><b id="share"></b></div><div class="metric"><small>∂p<sub>H</sub> / ∂s<sub>H</sub></small><b id="signal"></b></div></div>
    <p><span class="meter"><i></i></span><small>量表上限 0.25；量的是本行 softmax 的局部变化率，不是整个模型的训练梯度。</small></p>
    <p id="meaning"></p></section></div>
    <details><summary>摊开这一行的数字</summary><table><thead><tr><th>位置</th><th>分数</th><th>份额</th><th>自身灵敏度</th></tr></thead><tbody></tbody></table></details>
    <div class="result" role="status"></div>`;
  const input = root.querySelector('input');
  function render() {
    const scale = 2 ** Number(input.value), w = weigh(shape, scale);
    root.querySelector('#scale').textContent = scale.toFixed(1);
    root.querySelector('.rows').innerHTML = w.p.map((p, i) => `<div class="row ${i === w.top ? 'winner' : ''}"><span>${String.fromCharCode(65 + i)}</span><div class="track"><div class="bar" style="width:${p * 100}%"></div></div><b>${(p * 100).toFixed(1)}%</b></div>`).join('');
    root.querySelector('#share').textContent = `${(w.share * 100).toFixed(2)}%`;
    root.querySelector('#signal').textContent = w.signal < .001 ? w.signal.toExponential(2) : w.signal.toFixed(4);
    root.querySelector('.meter i').style.width = `${w.signal / .25 * 100}%`;
    root.querySelector('#meaning').textContent = '把 H 的分数单独加一个很小的量，它的份额会改变多少？柱子几乎占满以后，再推一下也推不动多少。';
    root.querySelector('tbody').innerHTML = w.p.map((p, i) => `<tr><td>${String.fromCharCode(65 + i)}</td><td>${w.scores[i].toFixed(2)}</td><td>${p.toFixed(5)}</td><td>${sensitivity(w.p, i).toExponential(2)}</td></tr>`).join('');
    root.querySelector('.result').textContent = w.share < .5 ? '刚开始放大时，赢家的灵敏度还可能上升。它并不是从头到尾都在下降。' : w.share < .99 ? '赢家跨过 50% 以后，份额继续增加，自身灵敏度开始下降。看两个数字往相反方向走。' : '几乎所有注意力都给了 H，H 自己却也不灵敏了。接近独占时，softmax 的整张雅可比矩阵都接近零。';
  }
  input.addEventListener('input', render);
  root.querySelector('#saturate').addEventListener('click', () => { input.value = '5'; render(); });
  root.querySelector('#reset').addEventListener('click', () => { input.value = '0'; render(); });
  render();
}
