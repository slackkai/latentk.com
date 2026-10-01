const labels = {
  academic:'Academic',insight:'Writing',dailies:'Dailies',library:'Library',projects:'Projects',settings:'Site settings',
  theme:'Theme and sections',interactions:'Navigation and comments',site:'Identity',now:'Now',about:'About',
  title:'Title',date:'Date',updated:'Updated',description:'Description',author:'Author',authors:'Authors',tags:'Tags',body:'Body',draft:'Draft',comments:'Comments',
  kind:'Kind',series:'Series',name:'Name',order:'Order',venue:'Venue',year:'Year',links:'Links',cover:'Cover',pinned:'Pinned',mood:'Mood',location:'Location',images:'Images',
  reviewed:'Last checked',type:'Type',url:'Source URL',rating:'Rating',status:'Status',summary:'Summary',video:'Video',stack:'Tools and technologies',featured:'Featured',
  lang:'Interface language',defaultPalette:'Default palette',sections:'Sections',enabled:'Enabled',label:'Label',subtitle:'Subtitle',desc:'Description',emoji:'Icon',rotate:'Rotation',
  navigation:'Navigation order',navLabels:'Navigation labels',item:'Item',features:'Optional features',cms:'Content manager',search:'Search',paletteSwitcher:'Palette switcher',
  readingProgress:'Reading progress',toc:'Contents',postMeta:'Article information',relatedPosts:'Related articles',heatmap:'Heatmap',guestbook:'Guestbook',nowCard:'Now card',codeCopy:'Copy code',imageZoom:'View images',
  home:'Home',hero:'Drawing',badge:'Text above the title',armIdle:'Idle motion',topics:'Research topics',web3formsKey:'Web3Forms access key',pageSize:'Entries per page',
  autoHideHeader:'Hide header when scrolling down',repo:'Repository',repoId:'Repository ID',category:'Discussion category',categoryId:'Category ID',tagline:'Tagline',github:'GitHub',email:'Email',signoffs:'Sign-off lines',
  doing:'Doing',reading:'Reading',listening:'Listening',highlights:'Highlights',workbench:'Workbench',tools:'Tools',hardware:'Hardware',questions:'Open questions',
  note:'Margin note',mark:'Highlight',pen:'Pen',stamp:'Stamp',postit:'Sticky note',photos:'Photos',fold:'Fold',steps:'Steps',layout:'Layout',embed:'Embedded page',bookmark:'Bookmark',
  text:'Text',color:'Color',variant:'Style',tilt:'Tilt',cols:'Columns',scatter:'Scatter',wide:'Wide',src:'Source',poster:'Poster',loop:'Loop',page:'Page',snippet:'HTML snippet',height:'Height',image:'Image',tip:'Tip',warn:'Warning',info:'Note',question:'Question',
  drafts:'Drafts',published:'Published',
};
/** Labels only; preserve patterns, callbacks and stored Markdown values. */
export function localizeCms(value,language) {
  if(language==='zh')return value;
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    const key=node.name || node.id;
    if(node.label && labels[key])node.label=labels[key];
    if(typeof node.hint==='string' && /\p{Script=Han}/u.test(node.hint))node.hint='See docs/THEME.md and docs/SYNTAX.md for details.';
    if(Array.isArray(node.pattern)&&typeof node.pattern[1]==='string'&&/\p{Script=Han}/u.test(node.pattern[1]))node.pattern[1]='Enter a valid value.';
    Object.values(node).forEach(visit);
  };
  visit(value);return value;
}
