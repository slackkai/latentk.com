// 图 1：正运动学。拖手肘转肩膀、拖指尖转手肘，指尖在纸上留下一串点。
import { forward, heading, wrap, toRad } from '../arm.js';
import { canvas, pedestal, ArmView, svgEl, setAttrs, handle, moveTo, arcPath, label, place, pointsAttr } from '../draw.js';
import { draggable } from '../drag.js';
import { shell, readoutRows, button, deg, num } from '../panel.js';

const base = { x: 210, y: 190 };
const lens = [90, 60];
// 关节转角（SVG 方向：负数是逆时针）。肩 40°、肘 55°
let rel = [toRad(-40), toRad(-55)];
let moved = null;
const trail = [];

const ui = shell('图 1 · 正运动学', '拖手肘上的圈：转肩膀。拖夹爪：只转手肘。');
const svg = canvas(ui.stage, 420, 380, '两节手臂，肩膀和手肘两个关节可以拖动');
const dots = svgEl('polyline', { class: 'trail' }, svg);
const horizon = svgEl('line', { class: 'guide' }, svg);
const extend = svgEl('line', { class: 'guide' }, svg);
const orbit = svgEl('circle', { class: 'guide is-pen', style: 'display:none' }, svg);
const arc1 = svgEl('path', { class: 'angle' }, svg);
const arc2 = svgEl('path', { class: 'angle is-marker' }, svg);
pedestal(svg, base, 34);
const arm = new ArmView(svg, 2);
const t1 = label(svg, 'is-pen');
const t2 = label(svg, 'is-marker');
const shoulderHandle = handle(svg, '肩膀转角');
const elbowHandle = handle(svg, '手肘转角');
const rows = readoutRows(ui.readout);

function draw() {
  const abs = [rel[0], rel[0] + rel[1]];
  const pts = forward(base, lens, abs);
  arm.update(pts, abs);
  setAttrs(horizon, { x1: base.x, y1: base.y, x2: base.x + 70, y2: base.y });
  setAttrs(extend, { x1: pts[1].x, y1: pts[1].y, x2: pts[1].x + Math.cos(abs[0]) * 52, y2: pts[1].y + Math.sin(abs[0]) * 52 });
  arc1.setAttribute('d', arcPath(base, 34, 0, abs[0]));
  arc2.setAttribute('d', arcPath(pts[1], 30, abs[0], abs[1]));
  const m1 = abs[0] / 2, m2 = abs[0] + rel[1] / 2;
  place(t1, { x: base.x + Math.cos(m1) * 50 - 8, y: base.y + Math.sin(m1) * 50 + 5 }, `θ₁ ${deg(rel[0])}`);
  place(t2, { x: pts[1].x + Math.cos(m2) * 50 - 10, y: pts[1].y + Math.sin(m2) * 50 + 5 }, `θ₂ ${deg(rel[1])}`);
  moveTo(shoulderHandle, pts[1]);
  moveTo(elbowHandle, pts[2]);
  setAttrs(shoulderHandle, { 'aria-valuenow': Math.round(-rel[0] * 180 / Math.PI), 'aria-valuetext': `肩膀 ${deg(rel[0])}`, 'aria-valuemin': -180, 'aria-valuemax': 180 });
  setAttrs(elbowHandle, { 'aria-valuenow': Math.round(-rel[1] * 180 / Math.PI), 'aria-valuetext': `手肘 ${deg(rel[1])}`, 'aria-valuemin': -180, 'aria-valuemax': 180 });
  trail.push(pts[2]);
  if (trail.length > 900) trail.shift();
  dots.setAttribute('points', pointsAttr(trail));
  const tip = { x: pts[2].x - base.x, y: base.y - pts[2].y };
  rows([
    ['肩 θ₁', deg(rel[0])],
    ['肘 θ₂', deg(rel[1])],
    ['前臂朝向 θ₁+θ₂', deg(abs[1])],
    ['指尖（以肩为原点）', `(${num(tip.x)}, ${num(tip.y)})`],
  ]);
  return pts;
}

const NOTES = {
  start: '指尖在哪，完全由两个角度决定：给定 θ₁、θ₂，只有一个答案。',
  elbow: '只转手肘：指尖画的是<b>以手肘为圆心</b>的圆，半径是前臂的长度。',
  shoulder: '只转肩膀：整条手臂像圆规一样绕肩膀扫，指尖画的是<b>以肩膀为圆心</b>的圆。',
};
function finish(announce = true) {
  ui.note.innerHTML = NOTES[moved ?? 'start'];
  orbit.style.display = 'none';
  const pts = forward(base, lens, [rel[0], rel[0] + rel[1]]);
  if (announce) ui.say(`肩膀 ${deg(rel[0])}，手肘 ${deg(rel[1])}，指尖在肩膀右边 ${num(pts[2].x - base.x)}、上方 ${num(base.y - pts[2].y)}。`);
}
function showOrbit(center, r) {
  setAttrs(orbit, { cx: center.x, cy: center.y, r });
  orbit.style.display = '';
}
const nudge = (dx, dy, big) => toRad((dx > 0 || dy < 0 ? -1 : 1) * (big ? 15 : 5));

draggable(svg, shoulderHandle, {
  onStart: () => { moved = 'shoulder'; const p = draw(); showOrbit(base, Math.hypot(p[2].x - base.x, p[2].y - base.y)); },
  onMove: p => { rel[0] = heading(base, p); const pts = draw(); showOrbit(base, Math.hypot(pts[2].x - base.x, pts[2].y - base.y)); },
  onKey: (dx, dy, big) => { moved = 'shoulder'; rel[0] = wrap(rel[0] + nudge(dx, dy, big)); draw(); },
  onEnd: finish,
});
draggable(svg, elbowHandle, {
  onStart: () => { moved = 'elbow'; const p = draw(); showOrbit(p[1], lens[1]); },
  onMove: p => {
    const pts = forward(base, lens, [rel[0], rel[0] + rel[1]]);
    rel[1] = wrap(heading(pts[1], p) - rel[0]);
    showOrbit(draw()[1], lens[1]);
  },
  onKey: (dx, dy, big) => { moved = 'elbow'; rel[1] = wrap(rel[1] + nudge(dx, dy, big)); draw(); },
  onEnd: finish,
});

button(ui.controls, '擦掉轨迹', () => { trail.length = 0; draw(); ui.say('轨迹已擦掉。'); }, true);
draw();
finish(false);
