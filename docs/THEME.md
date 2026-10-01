# 使用 Margin Notes

Margin Notes 是一个受笔记本启发、以 Markdown 为先、支持页边批注与注释的个人知识站主题。板块是可选的，不需要采用演示站的全部分类，也不需要使用机械臂、评论或其他外部服务。

## 第一次启动

从主题模板创建自己的 GitHub 仓库，克隆后运行：

```sh
npm ci
npm run setup
npm run dev:full
```

向导会询问作者、站名、界面语言、板块组合和发布地址。它只更新三个设置文件，保留 Markdown 与附件。已有个人设置时会停止；只有确实要替换设置，才使用 `npm run setup -- --replace`。可先用 `--dry-run` 查看涉及的文件。

CMS 默认关闭，直接编辑 Markdown 和 JSON 即可使用。需要后台时打开 `features.cms`；下载 ZIP、尚未设置 Git remote 时，在 `.env` 中填写自己的 `CMS_REPOSITORY=用户名/仓库名`，然后启动。后台绝不能指向主题作者的仓库。已经从自己仓库克隆时，会读取自己的 `origin`。

选择一种起点：

| 配置 | 板块 | 场景 |
| --- | --- | --- |
| minimal | 文章 | 一个简洁的笔记与文章站 |
| research | 学术、文章、项目 | 研究记录与作品 |
| knowledge | 文章、资料库、项目 | 长期积累的个人知识站 |

示例文件在 `examples/config/`。它们只是起点：之后可以独立启用或关闭任意板块。

## 设置在哪里

| 文件 | 修改内容 |
| --- | --- |
| `src/data/site.json` | 站名、作者、简介、发布地址、联系方式、页脚结束语 |
| `src/data/theme.json` | 语言、配色、板块、导航顺序、功能、首页、资料库每页数量 |
| `src/data/interactions.json` | 导航隐藏行为、评论仓库与开关 |
| `src/content/about/about.md` | 自我介绍与可选工作台 |
| `src/content/` | Markdown 正文与附件 |

启用 `features.cms` 后，后台 `/admin/` 的“站点设置”也能修改这些设置。`src/config.ts` 只负责把设置转换成组件需要的数据，日常配置不需要编辑它。

### 关闭或更名板块

在 `theme.json` 的对应板块中改 `enabled`，例如：

```json
"academic": { "enabled": false },
"library": { "enabled": true, "label": "书架" }
```

关闭后，该板块从导航、首页、标签、归档、推荐、RSS、搜索、CMS 集合和发布页面中一起移除。源文件保留，重新启用便会恢复。发布前的链接检查能指出正文里仍指向关闭板块的链接。

`label`、`subtitle`、`desc`、`emoji`、`rotate` 都可覆盖默认值，留空回到当前语言的默认显示。更名只改变显示文字，原 URL 不变。基础入口名称可用 `navLabels` 覆盖。导航顺序由 `navigation` 数组控制；也可手动加入 `{ "label": "GitHub", "href": "https://github.com/你的账号" }` 这样的自定义链接。后台的导航列表用于内置入口，自定义对象请在 JSON 中编辑。

### 保留想要的功能

`features` 分别控制可选 CMS、搜索、配色切换、阅读进度、目录、文章信息、相关文章、热力图、留言页、Now 卡片、代码复制和图片查看。关闭搜索时不会生成 Pagefind 索引。

首页 `home.hero` 可选 `doodle`、`arm`、`none`；`badge` 留空不显示。研究方向 `academic.topics` 留空不显示。评论和留言默认关闭，向导不会复用演示站的仓库 ID 或服务 key。

资料库默认每页 24 条，可以调整 `library.pageSize`。静态分页在没有 JavaScript 时也能浏览；搜索、筛选、排序覆盖整个集合，页面只插入当前页的卡片。

## 写第一篇

```sh
npm run new -- insight first-note "第一条笔记"
```

正文可以一直只写普通 Markdown。图片、代码复制和默认排版无需额外语法。需要批注或便利贴时，再使用现有指令；示例在 `/projects/syntax-combinations/`（启用 Projects 后可见），完整写法见 [SYNTAX.md](SYNTAX.md)。主题中的其他演示内容保留为草稿，可以自行替换或删除。

## 语言与内容

默认提供中文、英文界面，通过 `lang` 设置。语言不改变文章正文；可以用任意语言或混排写作，也可以覆盖栏目名称。新增语言时，在 `src/i18n/locales.mjs` 登记语言代码，复制 `en.ts` 建立同结构字典，并在 `src/i18n/index.ts` 注册。字典的 `UI` 类型帮助检查缺漏；未注册字典时回退到英文。

## 发布与维护

```sh
npm test
npm run check
npm run preview:site
```

在自己的 GitHub 仓库启用 Pages 的 GitHub Actions 发布方式，然后推送。现有工作流读取仓库的 Pages 地址与路径，支持项目路径和自定义域名；域名步骤见 [DOMAIN.md](DOMAIN.md)。评论另行在“导航与评论”中配置，使用自己的仓库。

更新主题时，保留 `src/data/` 与 `src/content/`，合并主题的组件、脚本和样式更新，然后重新运行测试与完整预览。可用 `git diff` 检查更改，避免用整个文件夹覆盖自己的内容。

---

## Quick start

Margin Notes is a notebook-inspired, Markdown-first theme for personal knowledge sites, with margin notes and annotations. Start with `npm ci`, `npm run setup`, then `npm run dev:full`. Choose a minimal writing site, research notebook, or knowledge site. All sections and optional features remain configurable.

Identity lives in `src/data/site.json`, behavior in `src/data/theme.json`, and comments in `src/data/interactions.json`. Edit those files or enable `features.cms` to use `/admin/`; no TypeScript changes are needed for normal setup. Disable sections with `enabled: false`, override their labels, and reorder `navigation`. Source content stays intact.

The setup command protects existing personal settings. Use `--dry-run` to inspect its three-file plan; `--replace` explicitly allows replacing settings. It never overwrites articles. A ZIP checkout needs `CMS_REPOSITORY=owner/repository` in `.env` before using the CMS. Use your own repository and service credentials.

Library pages are static and remain navigable without JavaScript. Filtering loads a lightweight catalog and creates only the current page of cards. UI locale is independent of article language. To add a locale, register it in `src/i18n/locales.mjs`, create a dictionary implementing `UI`, and add it to `src/i18n/index.ts`.

Run `npm test`, `npm run check`, and `npm run preview:site` before publishing through your own GitHub Pages workflow. Preserve `src/data/` and `src/content/` when merging future theme updates.
