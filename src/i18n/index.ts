import { config } from '../config';
import { zh, type UI } from './zh';
import { en } from './en';

const dicts: Record<string,UI> = { zh, en };

/** 当前语言的界面文字 / UI strings for the configured language */
export const t = dicts[config.lang] ?? en;
export type { UI } from './zh';
