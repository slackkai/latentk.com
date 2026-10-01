import site from './data/site.json';
import interactions from './data/interactions.json';
import settings from './data/theme.json';
import { interactionsSchema } from './utils/interactions.mjs';
import { themeSchema, sectionKeys, sectionDefaults } from './utils/theme.mjs';
import { locales } from './i18n/locales.mjs';
export type Lang = keyof typeof locales;
export type SectionKey = 'academic' | 'insight' | 'dailies' | 'library' | 'projects';
export type PaletteId = 'blue' | 'classic' | 'green' | 'mono';
const theme = themeSchema.parse(settings);
const language = theme.lang as Lang;
const defaults = sectionDefaults[language] ?? sectionDefaults.en;
export const config = { ...theme, lang: language, htmlLang: locales[language].html,
  site: { ...site, github: site.github ?? '', email: site.email ?? '', signoffs: (site.signoffs ?? []).filter(Boolean) },
  interactions: interactionsSchema.parse(interactions),
  sections: Object.fromEntries((sectionKeys as SectionKey[]).map(key => [key, {...defaults[key],...Object.fromEntries(Object.entries(theme.sections[key]).filter(([,value])=>value!==undefined))}])) as Record<SectionKey, {enabled:boolean;emoji:string;label:string;subtitle:string;desc:string;rotate:string}>,
};
export const SITE = config.site;
export type SectionMeta = { key:SectionKey; label:string;subtitle:string;href:string;emoji:string;desc:string;rotate:string };
export const SECTIONS = Object.fromEntries((sectionKeys as SectionKey[]).map(key => [key,{key,href:'/'+key+'/',...config.sections[key]}])) as unknown as Record<SectionKey,SectionMeta>;
export const ENABLED_SECTIONS = (sectionKeys as SectionKey[]).filter(key=>config.sections[key].enabled).map(key=>SECTIONS[key]);
export const isEnabled = (key:string): key is SectionKey => Object.hasOwn(config.sections,key) && config.sections[key as SectionKey].enabled;
const extra: Record<string,string> = language === 'zh' ? {home:'首页',tags:'标签',about:'关于',archive:'归档',guestbook:'留言'} : {home:'Home',tags:'Tags',about:'About',archive:'Archive',guestbook:'Guestbook'};
export const NAV = config.navigation.flatMap(item => {
  if (typeof item !== 'string') return [item];
  if (sectionKeys.includes(item)) return isEnabled(item) ? [{label:SECTIONS[item].label,href:SECTIONS[item].href}] : [];
  if (item === 'guestbook' && !config.features.guestbook) return [];
  return [{label:config.navLabels[item] || extra[item],href:item === 'home' ? '/' : '/'+item+'/'}];
});
