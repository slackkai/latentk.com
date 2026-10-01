/**
 * 每张图的外壳和旁边那张小卡片：标签、一句提示、读数、按钮、手绘滑块和开关、给读屏器的播报。
 * 宽的时候卡片在图右边，窄的时候落到图下面（见 figures.css）。
 */
import { borrowFonts } from './frame.js';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 角度显示成数学课本的习惯：逆时针为正、y 朝上。SVG 里的角度要取反。 */
export function deg(svgAngle) {
  const v = Math.round((-svgAngle * 180) / Math.PI);
  return `${v < 0 ? '−' : ''}${Math.abs(v)}°`;
}
export const num = v => (Math.abs(v) < 0.05 ? '0' : v.toFixed(Math.abs(v) >= 10 ? 0 : 1).replace('-', '−'));

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
}

/**
 * 搭好一张图：head（标签 + 怎么拖）、stage（SVG）、body（读数 + 按钮）、note（一句「你看到的是什么」）。
 * 窄屏时按 head → stage → body → note 从上往下排。
 */
export function shell(tag, hint) {
  borrowFonts();
  const root = document.getElementById('fig');
  root.className = 'fig';
  const head = el('div', 'fig-head', root);
  el('span', 'fig-tag', head, tag);
  el('p', 'fig-hint', head, hint);
  const stage = el('div', 'fig-stage', root);
  const body = el('div', 'fig-body', root);
  const readout = el('div', 'fig-readout', body);
  const controls = el('div', 'fig-controls', body);
  const note = el('p', 'fig-note', root);
  const live = el('p', 'sr-only', root);
  live.setAttribute('aria-live', 'polite');
  return { root, stage, readout, note, controls, say: text => { live.textContent = text; } };
}

/** 读数：若干行「名字 数值」。rows 里给 [name, value, cls?]，只在内容变了时改 DOM。 */
export function readoutRows(container) {
  let last = '';
  return rows => {
    const html = rows.map(([k, v, cls]) => `<div class="row${cls ? ` ${cls}` : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    if (html !== last) { container.innerHTML = html; last = html; }
  };
}

export function button(parent, text, onClick, quiet = false) {
  const b = el('button', quiet ? 'fig-btn is-quiet' : 'fig-btn', parent, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** 开关：一个带 aria-pressed 的按钮，前面画一个手绘小方框。 */
export function toggle(parent, text, on, onChange) {
  const b = el('button', 'fig-toggle', parent);
  b.type = 'button';
  el('span', 'box', b).setAttribute('aria-hidden', 'true');
  el('span', '', b, text);
  const set = value => { on = value; b.setAttribute('aria-pressed', String(on)); };
  set(on);
  b.addEventListener('click', () => { set(!on); onChange(on); });
  return { el: b, set };
}

/** 手绘滑块：原生 range 负责键盘和读屏，外观在 CSS 里重画。format 决定旁边显示的数。 */
export function slider(parent, { label, min, max, step, value, format = String, onInput }) {
  const wrap = el('label', 'fig-slider', parent);
  const head = el('span', 'head', wrap);
  el('span', '', head, label);
  const out = el('span', 'val', head);
  const input = el('input', '', wrap);
  Object.assign(input, { type: 'range', min, max, step, value });
  input.setAttribute('aria-label', label);
  const sync = () => {
    const v = Number(input.value);
    out.textContent = format(v);
    input.setAttribute('aria-valuetext', format(v));
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
  };
  input.addEventListener('input', () => { sync(); onInput(Number(input.value)); });
  sync();
  return { input, set: v => { input.value = v; sync(); } };
}
