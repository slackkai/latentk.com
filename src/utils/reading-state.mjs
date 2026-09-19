/** Browser-local reading data. Kept independent of the DOM so recovery can be tested. */
export function readingPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\?#]/.test(value)) return null;
  try {
    const path = new URL(value, 'https://reading.invalid').pathname;
    if (!/^\/(academic|insight|dailies|library|projects)\/.+/.test(path)) return null;
    return path.endsWith('/') ? path : path + '/';
  } catch { return null; }
}

/** @typedef {{path:string,title:string,section:string,savedAt:number}} Bookmark */
/** @typedef {{progress:number,heading:string,fraction:number,updatedAt:number}} Position */
/** @typedef {{size:'standard'|'large',width:'normal'|'narrow',focus:boolean}} Preferences */
/** @typedef {{version:1,bookmarks:Bookmark[],positions:Record<string,Position>,preferences:Preferences}} ReadingState */
const text = (value, limit = 250) => typeof value === 'string' ? value.slice(0, limit) : '';
const fraction = value => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const timestamp = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** @returns {ReadingState} */
export function normalizeReadingState(raw) {
  const data = raw?.version === 1 ? raw : {};
  const bookmarks = new Map();
  for (const item of Array.isArray(data.bookmarks) ? data.bookmarks : []) {
    const path = readingPath(item?.path);
    if (!path || !text(item.title).trim()) continue;
    bookmarks.set(path, { path, title: text(item.title), section: text(item.section, 40), savedAt: timestamp(item.savedAt) });
  }
  const positions = Object.entries(data.positions && typeof data.positions === 'object' ? data.positions : {})
    .flatMap(([key, value]) => {
      const path = readingPath(key);
      if (!path || !value || typeof value !== 'object') return [];
      return [[path, { progress: fraction(value.progress), heading: text(value.heading), fraction: fraction(value.fraction), updatedAt: timestamp(value.updatedAt) }]];
    }).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 100);
  return {
    version: 1,
    bookmarks: [...bookmarks.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, 200),
    positions: Object.fromEntries(positions),
    preferences: { size: data.preferences?.size === 'large' ? 'large' : 'standard', width: data.preferences?.width === 'narrow' ? 'narrow' : 'normal', focus: data.preferences?.focus === true },
  };
}

/** @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage */
export function createReadingStore(storage, key, now = Date.now) {
  let memory = normalizeReadingState(null);
  let available = true;
  function read() {
    if (!available) return structuredClone(memory);
    try {
      const raw = storage.getItem(key);
      if (raw) {
        try { memory = normalizeReadingState(JSON.parse(raw)); }
        catch { memory = normalizeReadingState(null); }
      } else if (available) memory = normalizeReadingState(null);
    } catch { available = false; }
    return structuredClone(memory);
  }
  function write(change) {
    const data = read();
    change(data);
    memory = normalizeReadingState(data);
    try { storage.setItem(key, JSON.stringify(memory)); available = true; }
    catch { available = false; }
    return { state: structuredClone(memory), persisted: available };
  }
  return {
    read,
    isPersistent: () => available,
    /** @param {{path:string,title:string,section:string}} item */
    toggleBookmark(item) {
      const path = readingPath(item.path);
      if (!path) return { state: read(), persisted: available };
      const current = read();
      if (current.bookmarks.length >= 200 && !current.bookmarks.some(bookmark => bookmark.path === path)) {
        return { state: current, persisted: available, limitReached: true };
      }
      return write(data => {
        const exists = data.bookmarks.some(b => b.path === path);
        data.bookmarks = data.bookmarks.filter(b => b.path !== path);
        if (!exists) data.bookmarks.unshift({ path, title: item.title, section: item.section, savedAt: now() });
      });
    },
    removeBookmark(path) { return write(data => { data.bookmarks = data.bookmarks.filter(b => b.path !== readingPath(path)); }); },
    /** @param {string} path @param {Omit<Position,'updatedAt'>} position */
    savePosition(path, position) {
      const key = readingPath(path);
      if (!key) return { state: read(), persisted: available };
      return write(data => { data.positions[key] = { ...position, updatedAt: now() }; });
    },
    /** @param {Partial<Preferences>} preferences */
    setPreferences(preferences) { return write(data => { data.preferences = { ...data.preferences, ...preferences }; }); },
  };
}
