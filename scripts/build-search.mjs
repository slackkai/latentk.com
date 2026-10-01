import { readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { themeSchema } from '../src/utils/theme.mjs';
const theme = themeSchema.parse(JSON.parse(await readFile('src/data/theme.json','utf8')));
if (theme.features.search) execFileSync(process.execPath,['node_modules/pagefind/lib/runner/bin.cjs','--site','dist'],{stdio:'inherit'});
else await rm(new URL('../dist/pagefind/',import.meta.url),{recursive:true,force:true});
