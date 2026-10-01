import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Source stays intact. Disabled collections are absent from the shipped site.
 * @param {{disabled?: string[]}} [options]
 */
export default function sections({ disabled = [] } = {}) {
  let base = '/';
  return { name:'optional-sections', hooks:{
    'astro:config:setup': ({ config }) => { base = config.base; },
    'astro:server:setup': ({ server }) => server.middlewares.use((request,response,next) => {
      const local = new URL(request.url || '/', 'http://localhost').pathname.slice(base.replace(/\/$/,'').length);
      if (!disabled.includes(local.split('/')[1])) return next();
      response.statusCode = 404; response.end('Not found');
    }),
    'astro:build:done': async ({ dir }) => {
      const output = path.resolve(fileURLToPath(dir));
      for (const key of disabled) {
        const target = path.resolve(output,key);
        if (!['academic','insight','dailies','library','projects','guestbook','admin'].includes(key) || path.dirname(target) !== output) throw Error('Invalid section output path');
        await rm(target,{recursive:true,force:true});
      }
    },
  }};
}
