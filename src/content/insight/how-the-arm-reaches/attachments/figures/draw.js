/**
 * 手绘手臂的 SVG 零件，画风照首页 Hero：粗铅笔连杆、白心关节圆、marker 色夹爪、虚线十字靶。
 * 只管画：数学在 arm.js，拖动在 drag.js。线宽、颜色都写在 figures.css 里，这里只放形状。
 */
const NS = 'http://www.w3.org/2000/svg';
const r2 = v => Math.round(v * 100) / 100;

export function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  setAttrs(node, attrs);
  parent?.append(node);
  return node;
}

export function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, typeof v === 'number' ? r2(v) : v);
  return node;
}

/** 画布：viewBox 固定，宽度跟着容器走。里面有可拖的东西，所以用 group 而不是 img。 */
export function canvas(parent, w, h, label) {
  return svgEl('svg', { class: 'fig-svg', viewBox: `0 0 ${w} ${h}`, role: 'group', 'aria-label': label }, parent);
}

/** 底座：地面一横 + 梯形座 + 白心转轴，比例和首页一样（转轴在梯形顶边中点）。 */
export function pedestal(parent, base, halfGround = 40) {
  const g = svgEl('g', { class: 'arm-base' }, parent);
  svgEl('path', { d: `M${r2(base.x - halfGround)} ${r2(base.y + 18)} h${halfGround * 2}` }, g);
  svgEl('path', { d: `M${r2(base.x - 30)} ${r2(base.y + 18)} l10 -18 h40 l10 18` }, g);
  svgEl('circle', { class: 'joint', cx: base.x, cy: base.y, r: 7 }, g);
  return g;
}

/** 一条手臂：n 节连杆、中间的关节圆、末端夹爪。ghost 是细虚线版，用来画「另一个解」「上一步」这类影子。 */
export class ArmView {
  constructor(parent, n, { ghost = false, gripper = true } = {}) {
    this.g = svgEl('g', { class: ghost ? 'arm is-ghost' : 'arm' }, parent);
    this.links = Array.from({ length: n }, () => svgEl('line', { class: 'link' }, this.g));
    this.joints = Array.from({ length: n - 1 }, () => svgEl('circle', { class: 'joint', r: ghost ? 4 : 6 }, this.g));
    this.grip = null;
    if (gripper) {
      this.grip = svgEl('g', { class: 'gripper' }, this.g);
      svgEl('path', { d: 'M0 -10 l14 -6 l4 6' }, this.grip);
      svgEl('path', { d: 'M0 10 l14 6 l4 -6' }, this.grip);
      svgEl('circle', { class: 'tip', r: ghost ? 4 : 5 }, this.grip);
    }
  }

  /** points 来自 arm.forward()；夹爪朝最后一节连杆的方向。 */
  update(points, angles) {
    this.links.forEach((line, i) => setAttrs(line, { x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y }));
    this.joints.forEach((c, i) => setAttrs(c, { cx: points[i + 1].x, cy: points[i + 1].y }));
    if (this.grip) {
      const e = points[points.length - 1];
      this.grip.setAttribute('transform', `translate(${r2(e.x)} ${r2(e.y)}) rotate(${r2((angles[angles.length - 1] * 180) / Math.PI)})`);
    }
  }

  show(on) {
    this.g.style.display = on ? '' : 'none';
  }
}

/** 十字靶：和首页一样的虚线圆 + 十字。 */
export function crosshair(parent) {
  const g = svgEl('g', { class: 'target' }, parent);
  svgEl('circle', { r: 9 }, g);
  svgEl('path', { d: 'M-14 0 h28 M0 -14 v28' }, g);
  return g;
}

export const moveTo = (node, p) => node.setAttribute('transform', `translate(${r2(p.x)} ${r2(p.y)})`);

/**
 * 可拖的柄：一个 <g>，里面一个透明大圆当触摸区、一个虚线圈表示「可以拖」，真正看得见的东西另外画。
 * 转角度的柄用 role=slider（配 aria-valuenow），二维拖动的靶子用 role=button。位置用 moveTo 设。
 */
export function handle(parent, label, role = 'slider', hitRadius = 22) {
  const g = svgEl('g', { class: role === 'button' ? 'handle is-target' : 'handle', role, 'aria-label': label }, parent);
  svgEl('circle', { class: 'hit', r: hitRadius }, g);
  svgEl('circle', { class: 'ring', r: role === 'button' ? 19 : 13 }, g);
  return g;
}

/** 从 SVG 角度 a0 转到 a1 的一段圆弧（y 向下，角度增加在屏幕上是顺时针），画关节转角用。 */
export function arcPath(c, r, a0, a1) {
  let d = a1 - a0;
  if (Math.abs(d) < 1e-3) return '';
  if (Math.abs(d) > 2 * Math.PI - 1e-3) d = Math.sign(d) * (2 * Math.PI - 1e-3);
  const p0 = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
  const p1 = { x: c.x + r * Math.cos(a0 + d), y: c.y + r * Math.sin(a0 + d) };
  return `M${r2(p0.x)} ${r2(p0.y)} A${r} ${r} 0 ${Math.abs(d) > Math.PI ? 1 : 0} ${d > 0 ? 1 : 0} ${r2(p1.x)} ${r2(p1.y)}`;
}

/** 圆环（外圈减内圈），配合 fill-rule: evenodd。内圈太小就只画外圈。 */
export function ringPath(c, outer, inner) {
  const circle = r => `M${r2(c.x - r)} ${r2(c.y)} a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0 a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`;
  return inner > 0.5 ? `${circle(outer)} ${circle(inner)}` : circle(outer);
}

/** 带箭头的线段。 */
export function arrowPath(from, to, head = 9) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const h1 = { x: to.x - head * Math.cos(a - 0.45), y: to.y - head * Math.sin(a - 0.45) };
  const h2 = { x: to.x - head * Math.cos(a + 0.45), y: to.y - head * Math.sin(a + 0.45) };
  return `M${r2(from.x)} ${r2(from.y)} L${r2(to.x)} ${r2(to.y)} M${r2(h1.x)} ${r2(h1.y)} L${r2(to.x)} ${r2(to.y)} L${r2(h2.x)} ${r2(h2.y)}`;
}

export const pointsAttr = pts => pts.map(p => `${r2(p.x)},${r2(p.y)}`).join(' ');

/** SVG 里的一行手写字。 */
export function label(parent, cls = '') {
  return svgEl('text', { class: cls || undefined }, parent);
}

export function place(node, p, text) {
  setAttrs(node, { x: p.x, y: p.y });
  if (text !== undefined && node.textContent !== text) node.textContent = text;
  return node;
}
