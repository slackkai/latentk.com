/**
 * 拖动：指针（鼠标、触摸、笔）+ 方向键。只负责把事件换算成 SVG 坐标，拖动柄意味着什么由每张图自己决定。
 * 拖动柄上设了 touch-action: none，按住柄拖不会滚页面；图的其他地方不拦截滚动。
 */

/** 屏幕坐标 → SVG viewBox 坐标。 */
export function toSvg(svg, e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}

/**
 * 让 handle 可拖。onMove(p) 拿到指针的 SVG 坐标；onKey(dx, dy, big) 拿到方向键（dy 向下为正，big 是按住 Shift）。
 * onStart / onEnd 可选，拖完会调 onEnd（播报结果用）。
 */
export function draggable(svg, handle, { onMove, onKey, onStart, onEnd }) {
  handle.setAttribute('tabindex', '0');
  let active = null;
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    active = e.pointerId;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('is-dragging');
    handle.focus({ preventScroll: true });
    onStart?.();
  });
  handle.addEventListener('pointermove', e => {
    if (e.pointerId !== active) return;
    onMove(toSvg(svg, e));
  });
  const stop = e => {
    if (e.pointerId !== active) return;
    active = null;
    handle.classList.remove('is-dragging');
    onEnd?.();
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
  // iOS 上只靠 touch-action 有时还会带着页面滚，按住柄的那根手指明确不滚
  handle.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  handle.addEventListener('keydown', e => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || !onKey) return;
    e.preventDefault();
    onKey(dir[0], dir[1], e.shiftKey);
    onEnd?.();
  });
}

/** 在图上空白处点一下（不是拖、不是滑），把靶子放到那里。滑动照常滚页面。 */
export function onTap(svg, callback) {
  let start = null;
  svg.addEventListener('pointerdown', e => {
    start = e.target.closest('.handle') || e.button !== 0 ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
  });
  svg.addEventListener('pointerup', e => {
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const quick = e.timeStamp - start.t < 600;
    start = null;
    if (moved < 8 && quick) callback(toSvg(svg, e));
  });
  svg.addEventListener('pointercancel', () => { start = null; });
}
