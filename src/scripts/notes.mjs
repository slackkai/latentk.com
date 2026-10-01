/** @param {HTMLElement} root @param {Window & typeof globalThis} view */
export function mountNotes(root, view, labels = {}) {
  const controller = new view.AbortController();
  const { signal } = controller;
  const wide = view.matchMedia('(min-width: 1200px)');
  const english = root.ownerDocument.documentElement.lang.startsWith('en');
  const timers = new Map();
  const notes = [...root.querySelectorAll('.note-wrap')].map(wrap => ({
    input: wrap.querySelector('input'), ref: wrap.querySelector('.note-ref'),
    body: wrap.querySelector('.note'),
  })).filter(note => note.input && note.ref && note.body);
  notes.forEach((note, index) => {
    note.ref.textContent = String(index + 1);
    const id = 'note-' + (index + 1);
    note.input.id = id;
    note.ref.htmlFor = id;
    note.body.id = id + '-body';
    note.input.setAttribute('aria-controls', note.body.id);
  });
  const names = () => notes.forEach(note => {
    const number = note.ref.textContent.trim();
    const action = wide.matches ? (labels.read || root.ownerDocument.body.dataset.noteRead || (english ? 'Read note' : '查看注释')) : (labels.expand || root.ownerDocument.body.dataset.noteExpand || (english ? 'Expand note' : '展开注释'));
    note.input.setAttribute('aria-label', `${action} ${number}`);
  });
  const reset = note => {
    view.clearTimeout(timers.get(note));
    timers.delete(note);
    note.body.removeAttribute('data-note-active');
    note.ref.removeAttribute('data-note-active');
  };
  names();
  notes.forEach(note => note.input.addEventListener('change', () => {
    if (wide.matches) {
      // Desktop notes already show: every activation points to the paper again.
      note.input.checked = false;
      notes.forEach(reset);
    } else reset(note);
    if (wide.matches || note.input.checked) {
      // Flush the removed animation so a rapid second click restarts the nudge.
      void note.body.offsetWidth;
      note.body.setAttribute('data-note-active', '');
      note.ref.setAttribute('data-note-active', '');
      timers.set(note, view.setTimeout(() => reset(note), 3000));
    }
  }, { signal }));

  wide.addEventListener('change', () => {
    names();
    notes.forEach(note => { if (wide.matches) note.input.checked = false; reset(note); });
  }, { signal });
  return () => { controller.abort(); notes.forEach(reset); };
}
