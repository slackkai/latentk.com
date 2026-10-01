import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { locales } from '../src/i18n/locales.mjs';
import { themeSchema } from '../src/utils/theme.mjs';

export async function setup({ root = process.cwd(), answers, replace = false, dryRun = false }) {
  const file = relative => new URL(relative, pathToFileURL(root.replace(/[\\/]$/,'')+'/'));
  const site = JSON.parse(await readFile(file('src/data/site.json'),'utf8'));
  if (!replace && !['Your Name','Your name',''].includes(site.author)) throw Error('Existing personal settings found. Use --replace only when you intend to replace them.');
  if (!['minimal','research','knowledge'].includes(answers.profile)) throw Error('Unknown profile');
  if (!answers.author?.trim() || !answers.title?.trim()) throw Error('Author and site title are required.');
  const preset = JSON.parse(await readFile(file(`examples/config/${answers.profile}.json`),'utf8'));
  const theme = themeSchema.parse({...preset,lang:answers.lang});
  const url = answers.url?.trim() || 'https://example.com';
  if (!/^https?:\/\//.test(url)) throw Error('Site URL must start with http:// or https://');
  new URL(url);
  const plan = [
    ['src/data/site.json',{...site,title:answers.title.trim(),author:answers.author.trim(),url,
      tagline:answers.tagline || '',description:answers.description || '',github:answers.github || '',email:answers.email || '',signoffs:[]}],
    ['src/data/theme.json',theme],
    ['src/data/interactions.json',{autoHideHeader:true,comments:{enabled:false,repo:'',repoId:'',category:'',categoryId:''}}],
  ];
  if (!dryRun) for (const [path,data] of plan) await writeFile(file(path),JSON.stringify(data,null,2)+'\n');
  return plan.map(([path])=>path);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const answerPath = process.argv.indexOf('--answers');
  let answers;
  if (answerPath >= 0) answers = JSON.parse(await readFile(process.argv[answerPath+1],'utf8'));
  else {
    const prompt = createInterface({input:process.stdin,output:process.stdout});
    try {
      console.log('Notebook-inspired · Markdown-first · Margin notes · Personal knowledge site');
      answers = {
        author:await prompt.question('Your name / 作者：'),
        title:await prompt.question('Site title / 站名：'),
        lang:(await prompt.question('UI language / 语言 ['+Object.keys(locales).join('/')+', zh]：')) || 'zh',
        profile:(await prompt.question('Profile / 板块 [minimal/research/knowledge, minimal]：')) || 'minimal',
        url:(await prompt.question('Site URL / 发布地址 [https://example.com]：')) || 'https://example.com',
      };
    } finally { prompt.close(); }
  }
  const files = await setup({answers,replace:process.argv.includes('--replace'),dryRun:process.argv.includes('--dry-run')});
  console.log(files.join('\n'));
  console.log('Next: npm run dev:full. CMS is optional (features.cms). Configuration: src/data/. Publishing: docs/THEME.md.');
}
