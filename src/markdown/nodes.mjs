export const el = (hName, hProperties = {}, children = []) => ({ type: 'notebookElement', data: { hName, hProperties }, children });
export const text = value => ({ type: 'text', value });
