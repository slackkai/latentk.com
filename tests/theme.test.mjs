import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,mkdir,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { themeSchema } from '../src/utils/theme.mjs';
import { setup } from '../scripts/setup.mjs';
import { makeCmsConfig } from '../cms.config.mjs';

test('theme defaults are neutral, profiles validate, and invalid configuration stays strict',async()=>{
  const defaults=themeSchema.parse({});
  assert.equal(defaults.sections.insight.enabled,true);
  assert.equal(defaults.sections.academic.enabled,false);
  assert.equal(defaults.home.hero,'doodle');assert.equal(defaults.academic.topics.length,0);
  assert.equal(defaults.guestbook.web3formsKey,'');assert.equal(defaults.features.guestbook,false);
  for(const profile of ['minimal','research','knowledge'])themeSchema.parse(JSON.parse(await readFile(new URL('../examples/config/'+profile+'.json',import.meta.url),'utf8')));
  for(const value of [{lang:'typo'},{features:{toc:'false'}},{library:{pageSize:0}},{sections:{typo:{enabled:true}}}])assert.equal(themeSchema.safeParse(value).success,false);
  const cms=makeCmsConfig({repo:'owner/theme',siteUrl:'https://example.com',theme:defaults});
  assert.deepEqual(cms.collections.filter(x=>x.folder).map(x=>x.name),['insight']);
  assert.ok(cms.collections.find(x=>x.name==='settings').files.some(x=>x.name==='theme'));
});
test('first-use setup writes a neutral profile, dry-run preserves files and existing personal settings are protected',async()=>{
  const root=await mkdtemp(join(tmpdir(),'notebook-setup-'));
  try{
    await mkdir(join(root,'src/data'),{recursive:true});await mkdir(join(root,'examples/config'),{recursive:true});
    await writeFile(join(root,'src/data/site.json'),JSON.stringify({author:'Your Name',title:'Margin Notes',url:'https://example.com'}));
    await writeFile(join(root,'examples/config/minimal.json'),await readFile(new URL('../examples/config/minimal.json',import.meta.url)));
    const answers={author:'Alex',title:'Alex’s notebook',lang:'en',profile:'minimal',url:'https://alex.example'};
    await setup({root,answers,dryRun:true});assert.match(await readFile(join(root,'src/data/site.json'),'utf8'),/Your Name/);
    await setup({root,answers});const theme=JSON.parse(await readFile(join(root,'src/data/theme.json'),'utf8'));
    assert.equal(theme.lang,'en');assert.equal(theme.sections.library.enabled,false);
    assert.equal(JSON.parse(await readFile(join(root,'src/data/interactions.json'),'utf8')).comments.enabled,false);
    await assert.rejects(setup({root,answers}),/Existing personal settings/);
  }finally{await rm(root,{recursive:true,force:true});}
});
