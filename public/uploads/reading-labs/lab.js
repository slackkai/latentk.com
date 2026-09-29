export const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const percent = value => `${(100 * value).toFixed(1)}%`;

export function initLab() {
  // Same-origin embeds inherit colors from the site; font-face rules need copying.
  try {
    if (parent === window) return;
    const rules = [];
    const collect = (list, base) => {
      for (const rule of list) {
        if (rule.type === 5) rules.push(rule.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (_, q, url) => `url("${new URL(url, base).href}")`));
        else if (rule.type === 3 && rule.styleSheet) { try { collect(rule.styleSheet.cssRules, rule.styleSheet.href || base); } catch {} }
        else if (rule.cssRules) collect(rule.cssRules, base);
      }
    };
    for (const sheet of parent.document.styleSheets) { try { collect(sheet.cssRules, sheet.href || parent.document.baseURI); } catch {} }
    const style = document.createElement('style');
    style.textContent = rules.join('\n');
    document.head.append(style);
  } catch { /* Standalone pages keep their local fallback font. */ }
}

export function saveText(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const observers = new WeakMap();
// One scale per plot. Pointer, keyboard scrubber and table expose the same rows.
export function lineChart(host, { rows, series, title, unit = '', domain, reference, xLabel = '步', format = n => n.toFixed(2) }) {
  observers.get(host)?.disconnect();
  host.innerHTML = `<h3>${esc(title)}</h3>${series.length > 1 ? `<div class="legend">${series.map((s, i) => `<span><i class="key ${i ? 'second' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}<div class="chart"><div data-plot></div><output class="readout" aria-live="polite"></output><label class="inspect">逐${esc(xLabel)}查看<input type="range" min="0" max="${rows.length - 1}" value="${rows.length - 1}" aria-label="逐${esc(xLabel)}查看图表数值"></label></div><details><summary>查看全部数据（也可用键盘读取）</summary><div class="table-wrap"><table><caption>${esc(title)} · ${esc(unit)}</caption><thead><tr><th>${esc(xLabel)}</th>${series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.x)}</td>${series.map(s => `<td>${esc(format(r[s.key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  const plot = host.querySelector('[data-plot]');
  const output = host.querySelector('output');
  const slider = host.querySelector('input');
  const values = rows.flatMap(r => series.map(s => r[s.key]));
  let [low, high] = domain || [Math.min(0, ...values), Math.max(1, ...values)];
  if (high === low) high = low + 1;
  const H = 260, top = 25, bottom = 35;
  let W, left = 45, right = 85, lastWidth = 0;
  const x = i => left + i / Math.max(1, rows.length - 1) * (W - left - right);
  const y = value => H - bottom - (value - low) / (high - low) * (H - top - bottom);
  function inspect(index) {
    const row = rows[index];
    slider.value = index;
    output.textContent = `${xLabel} ${row.x} · ${series.map(s => `${s.name} ${format(row[s.key])}${unit}`).join('；')}`;
    const line = plot.querySelector('.crosshair');
    if (line) { line.setAttribute('x1', x(index)); line.setAttribute('x2', x(index)); }
  }
  function draw() {
    W = Math.max(260, Math.round(plot.clientWidth));
    if (W === lastWidth) return;
    lastWidth = W;
    const ticks = Array.from({ length: 5 }, (_, i) => low + (high - low) * i / 4);
    const labels = series.map((s, i) => ({ ...s, i, actual: y(rows.at(-1)[s.key]), at: y(rows.at(-1)[s.key]) })).sort((a,b) => a.at - b.at);
    for (let i = 1; i < labels.length; i++) labels[i].at = Math.max(labels[i].at, labels[i-1].at + 18);
    if (labels.at(-1).at > H - bottom) { const shift = labels.at(-1).at - (H - bottom); labels.forEach(l => l.at -= shift); }
    plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}；完整数值见下方滑块和数据表"><text x="${left}" y="15">${esc(unit)}</text>${ticks.map(v => `<line class="gridline" x1="${left}" x2="${W-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${esc(format(v))}</text>`).join('')}${[0, Math.floor((rows.length-1)/2), rows.length-1].map(i => `<text x="${x(i)}" y="${H-12}" text-anchor="middle">${esc(rows[i].x)}</text>`).join('')}${reference ? `<line x1="${left}" x2="${W-right}" y1="${y(reference.value)}" y2="${y(reference.value)}" stroke="var(--pencil-25)" stroke-dasharray="3 3"/><text x="${W-right-8}" y="${y(reference.value)-6}" text-anchor="end">${esc(reference.label)}</text>` : ''}${series.map((s,i) => `<path class="curve ${i ? 'second' : ''}" d="${rows.map((r,j) => `${j ? 'L' : 'M'}${x(j).toFixed(2)},${y(r[s.key]).toFixed(2)}`).join(' ')}"/>`).join('')}${labels.map(l => `<path class="gridline" fill="none" d="M${W-right},${l.actual} L${W-right+10},${l.at} H${W-right+14}"/><text x="${W-right+17}" y="${l.at+4}">${esc(l.name)}</text>`).join('')}<line class="crosshair" y1="${top}" y2="${H-bottom}"/></svg>`;
    inspect(Number(slider.value));
  }
  slider.addEventListener('input', () => inspect(Number(slider.value)));
  plot.addEventListener('pointermove', event => {
    const rect = plot.getBoundingClientRect();
    const index = Math.round((event.clientX - rect.left - left) / (W-left-right) * (rows.length-1));
    inspect(Math.max(0, Math.min(rows.length-1, index)));
  });
  draw();
  const observer = new ResizeObserver(draw);
  observer.observe(plot); observers.set(host, observer);
}
