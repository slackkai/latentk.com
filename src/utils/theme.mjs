import { z } from 'astro/zod';
import { locales } from '../i18n/locales.mjs';

export const sectionKeys = ['academic', 'insight', 'dailies', 'library', 'projects'];
const optionalText = z.preprocess(v=>v==null || typeof v==='string' && !v.trim()?undefined:v,z.string().optional());
const section = key => z.object({
  enabled: z.boolean().default(key === 'insight'),
  label: optionalText, subtitle: optionalText, desc: optionalText,
  emoji: optionalText, rotate: z.preprocess(v=>v==null || typeof v==='string' && !v.trim()?undefined:v,z.string().regex(/^-?\d+(\.\d+)?deg$/).optional()),
}).strict().default({ enabled: key === 'insight' });
const featureDefaults = { cms: false, search: true, paletteSwitcher: true, readingProgress: true, toc: true,
  postMeta: true, relatedPosts: true, heatmap: true, guestbook: false, nowCard: false,
  codeCopy: true, imageZoom: true };
export const themeSchema = z.object({
  lang: z.enum(Object.keys(locales)).default('zh'),
  defaultPalette: z.enum(['blue','classic','green','mono']).default('blue'),
  sections: z.object(Object.fromEntries(sectionKeys.map(key => [key, section(key)]))).strict()
    .default(Object.fromEntries(sectionKeys.map(key => [key, { enabled: key === 'insight' }]))),
  navLabels: z.object(Object.fromEntries(['home','tags','about','archive','guestbook'].map(key=>[key,optionalText]))).strict().default({}),
  navigation: z.array(z.union([
    z.enum(['home', ...sectionKeys, 'tags','about','archive','guestbook']),
    z.object({ label: z.string().min(1), href: z.string().regex(/^(https?:\/\/|mailto:|\/|#)/) }).strict(),
  ])).default(['home', ...sectionKeys, 'tags', 'about']),
  features: z.object(Object.fromEntries(Object.entries(featureDefaults).map(([key,value]) => [key,z.boolean().default(value)]))).strict().default(featureDefaults),
  home: z.object({ hero: z.enum(['arm','doodle','none']).default('doodle'), badge: z.string().default(''), armIdle: z.boolean().default(false) }).strict().default({ hero:'doodle', badge:'', armIdle:false }),
  academic: z.object({ topics: z.array(z.object({ emoji:z.string(), title:z.string(), desc:z.string() })).default([]) }).strict().default({topics:[]}),
  guestbook: z.object({ web3formsKey:z.string().default('') }).strict().default({web3formsKey:''}),
  library: z.object({ pageSize:z.number().int().min(6).max(100).default(24) }).strict().default({pageSize:24}),
}).strict();

export const sectionDefaults = {
  zh: {
    academic: {label:'Academic',subtitle:'学术',desc:'论文笔记与研究记录。',emoji:'🎓',rotate:'-1deg'},
    insight: {label:'文章',subtitle:'文章',desc:'想法、笔记与长文。',emoji:'✍️',rotate:'1deg'},
    dailies: {label:'日常',subtitle:'日常',desc:'日志与生活切片。',emoji:'📸',rotate:'-0.5deg'},
    library: {label:'资料库',subtitle:'资料库',desc:'书、工具与值得回看的资料。',emoji:'📚',rotate:'0.7deg'},
    projects: {label:'项目',subtitle:'项目',desc:'作品与项目记录。',emoji:'🛠️',rotate:'-0.7deg'},
  },
  en: {
    academic: {label:'Academic',subtitle:'Research',desc:'Paper notes and research records.',emoji:'🎓',rotate:'-1deg'},
    insight: {label:'Writing',subtitle:'Writing',desc:'Ideas, notes and essays.',emoji:'✍️',rotate:'1deg'},
    dailies: {label:'Dailies',subtitle:'Life',desc:'Journals and everyday observations.',emoji:'📸',rotate:'-0.5deg'},
    library: {label:'Library',subtitle:'Resources',desc:'Books, tools and things worth returning to.',emoji:'📚',rotate:'0.7deg'},
    projects: {label:'Projects',subtitle:'Projects',desc:'Work and project records.',emoji:'🛠️',rotate:'-0.7deg'},
  },
};
