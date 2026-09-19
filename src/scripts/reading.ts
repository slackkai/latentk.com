import { createReadingStore } from '../utils/reading-state.mjs';
export { readingPath } from '../utils/reading-state.mjs';

export const readingStorageKey = `latentk:reading:v1:${import.meta.env.BASE_URL}`;
export const readingStore = createReadingStore({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, readingStorageKey);

export function notifyReadingChange() {
  document.dispatchEvent(new CustomEvent('reading:change'));
}

export function refreshBookmarkButtons() {
  const saved = new Set(readingStore.read().bookmarks.map(item => item.path));
  document.querySelectorAll<HTMLButtonElement>('[data-bookmark-path]').forEach(button => {
    const active = saved.has(button.dataset.bookmarkPath!);
    button.setAttribute('aria-pressed', String(active));
    const label = button.querySelector('[data-bookmark-label]');
    if (label) label.textContent = active ? '已加入稍后读 ✓' : '加入稍后读';
  });
  document.querySelectorAll<HTMLElement>('[data-storage-note]').forEach(note => {
    note.textContent = readingStore.isPersistent()
      ? '仅保存在当前浏览器，不同步账号。'
      : '浏览器无法保存数据：本次浏览可用，关闭后可能丢失。';
  });
}

// Delegation stays attached to the document across Astro page swaps, exactly once.
let initialized = false;
export function initReadingActions() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-bookmark-path]');
    if (!button) return;
    const result = readingStore.toggleBookmark({ path: button.dataset.bookmarkPath!, title: button.dataset.bookmarkTitle!, section: button.dataset.bookmarkSection! });
    notifyReadingChange();
    if ('limitReached' in result && result.limitReached) {
      const label = button.querySelector('[data-bookmark-label]');
      if (label) label.textContent = '稍后读已满，请先移除一些';
    }
  });
  document.addEventListener('reading:change', refreshBookmarkButtons);
  document.addEventListener('astro:page-load', refreshBookmarkButtons);
  window.addEventListener('storage', event => {
    if (event.key === readingStorageKey || event.key === null) notifyReadingChange();
  });
  refreshBookmarkButtons();
}
