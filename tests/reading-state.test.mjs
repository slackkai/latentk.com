import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingStore, normalizeReadingState, readingPath } from '../src/utils/reading-state.mjs';

function storage() {
  const data = new Map();
  return { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value) };
}
const item={path:'/library/cs231n/',title:'CS231n',section:'Library'};

test('bookmarks survive reload and use the same canonical URL from cards and articles',()=>{
  const disk=storage();
  const one=createReadingStore(disk,'site',()=>12);
  one.toggleBookmark({...item,path:'/library/cs231n'});
  const two=createReadingStore(disk,'site');
  assert.deepEqual(two.read().bookmarks,[{...item,savedAt:12}]);
  two.toggleBookmark(item);
  assert.equal(one.read().bookmarks.length,0);
});

test('position and preference writes preserve bookmarks added in another tab',()=>{
  const disk=storage(),one=createReadingStore(disk,'site'),two=createReadingStore(disk,'site');
  one.toggleBookmark(item);
  two.read();
  one.toggleBookmark({path:'/academic/attention/',title:'Attention',section:'Academic'});
  two.savePosition('/academic/attention/',{progress:.45,heading:'多头注意力',fraction:.2});
  two.setPreferences({size:'large',focus:true});
  assert.equal(one.read().bookmarks.length,2);
  assert.equal(one.read().positions['/academic/attention/'].progress,.45);
  assert.equal(one.read().preferences.size,'large');
});

test('corrupt or untrusted stored data cannot create off-site links or invalid settings',()=>{
  const disk=storage();disk.setItem('site','{not json');
  const store=createReadingStore(disk,'site');
  assert.equal(store.read().bookmarks.length,0);
  disk.setItem('site',JSON.stringify({version:1,bookmarks:[{...item,path:'https://evil.test/'},{...item,path:'//evil.test/'},{...item,path:'/library/../../about/'},item],positions:{'/library/cs231n/':{progress:9,fraction:-2,heading:42}},preferences:{size:'999px',width:'999px',focus:'false'}}));
  const state=store.read();
  assert.equal(state.bookmarks.length,1);
  assert.equal(state.positions[item.path].progress,1);
  assert.equal(state.positions[item.path].fraction,0);
  assert.deepEqual(state.preferences,{size:'standard',width:'normal',focus:false});
  for(const path of ['javascript:alert(1)','/library/x?y=1','/library/x#y','/library/\\evil','/about/','/library/']) assert.equal(readingPath(path),null);
});

test('storage denial and quota failures retain session state without throwing',()=>{
  const denied={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('denied')}};
  const first=createReadingStore(denied,'site');
  assert.equal(first.toggleBookmark(item).persisted,false);
  assert.equal(first.read().bookmarks.length,1);
  const old=JSON.stringify({version:1,bookmarks:[]});
  const quota={getItem:()=>old,setItem:()=>{throw Error('quota')}};
  const second=createReadingStore(quota,'site');
  second.toggleBookmark(item);
  second.setPreferences({focus:true});
  assert.equal(second.read().bookmarks.length,1);
  assert.equal(second.read().preferences.focus,true);
});

test('site namespaces stay isolated and record counts are bounded',()=>{
  const disk=storage(),personal=createReadingStore(disk,'/latentk.com/'),theme=createReadingStore(disk,'/theme/');
  personal.toggleBookmark(item);assert.equal(theme.read().bookmarks.length,0);
  const state=normalizeReadingState({version:1,bookmarks:Array.from({length:250},(_,i)=>({...item,path:`/library/${i}/`,savedAt:i})),positions:Object.fromEntries(Array.from({length:130},(_,i)=>[`/library/${i}/`,{updatedAt:i}]))});
  assert.equal(state.bookmarks.length,200);assert.equal(Object.keys(state.positions).length,100);
  assert.equal(state.bookmarks[0].path,'/library/249/');
});

test('a full reading list never silently evicts an existing bookmark',()=>{
  const disk=storage();
  disk.setItem('site',JSON.stringify({version:1,bookmarks:Array.from({length:200},(_,i)=>({...item,path:`/library/${i}/`,savedAt:i}))}));
  const store=createReadingStore(disk,'site');
  assert.equal(store.toggleBookmark(item).limitReached,true);
  assert.equal(store.read().bookmarks.length,200);
  assert.ok(store.read().bookmarks.some(bookmark=>bookmark.path==='/library/0/'));
});
