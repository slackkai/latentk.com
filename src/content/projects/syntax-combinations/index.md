---
title: 同一本笔记里，组件怎样配合
date: 2026-09-30
description: 页边批注、便利贴、相片和折页的组合示例。全部使用现有 Markdown 语法。
status: active
tags: [site, markdown]
comments: false
---

## 01 · 正文与页边，保持各自的节奏

批注可以补充依据，而不打断主要论述。比如这一条观察 :stamp[待复核]{blue}，需要保留它成立的条件。:note[这里允许 **加粗**、:mark[高亮条件]{yellow} 和 :stamp[有边界]{blue}。链接仍能正常访问：[原有语法演示](/projects/syntax-showcase/)，点击链接不应收起批注。]

一条普通脚注也可以使用相同的标记[^boundary]。再次引用同一条脚注[^boundary]，两个触发位置应能分别展开。

:::note[一张写在页边的工作纸]
先读正文，再回来核对：

- :mark[有没有保留前提？]{green}
- :stamp[检查过]{green} 只是当前状态，不是永久结论。
- 公式仍可读：$e_{k+1}=(1-K\Delta t)e_k$。
:::

页边信息可以比正文更琐碎，但它仍然属于这一段。接下来的正文不应该挤进批注，也不应该被批注盖住。

[^boundary]: 结论依赖 :mark[测试范围]。这里的 **链接与格式** 应被保留：[查看组合中的图注](#photos-in-fold)。

## 02 · 两张便利贴，各自带着批注

:::::layout{cols=2}
::::postit[观察记录 :stamp[初稿]{blue}]{info}
把 :mark[事实]{green} 和解释分开写。:note[窄容器里的批注留在当前卡片内，不飞到整页右侧。链接和 :stamp[状态]{green} 可以一起出现。]

- **看到了什么**：相同输入得到两个结果。
- **还缺什么**：环境、版本与重复次数。

:::note[补充记录]
这条块级批注也是当前便利贴的一部分。

可以继续记录 :mark[一个具体的前提]，也可以放一个 [返回正文的链接](#inline-markers)。
:::
::::

::::postit[修订决定 :stamp[可检查]{green}]{tip}
解释暂时保留，但把 :pen[已经证明了]{strike} 改为 **在这组条件下观察到**。:note[两栏变成一栏时，批注仍跟着自己的记录。]

```python
conditions = {"runs": 3, "same_input": True}
print(conditions)
```

复制按钮应能使用键盘到达，也不遮住第一行。
::::
:::::

## 03 · 折页里放图，图注里放笔迹

::::fold[展开这份图像记录 :stamp[两张]{blue}]{#photos-in-fold}
:::photos{cols=2}
[![机械臂的线稿](/projects/syntax-showcase/attachments/sketch-arm.svg)](/projects/syntax-showcase/attachments/sketch-arm.svg)
**图 A** · :mark[原图链接被保留]{green}。:stamp[草图]{blue} :note[点击图片打开它原来的链接；点击编号仅展开说明。]

![四足机器人的线稿](/projects/syntax-showcase/attachments/sketch-dog.svg)
**图 B** · :mark[结构示意]{yellow}，不代表真实测试。:stamp[示意]{red}

这段正文仍属于相片组，不能因为它不是图片而被丢掉。可以继续放 [图注中的链接](#inline-markers) 或 :mark[文字说明]。
:::

图注与原图链接在折页中保持各自的作用。关闭折页后，内容留在原来的位置。
::::

## 04 · 便利贴里放图，折页再补细节

:::::postit[一张完整的观察纸]{question}
先写主要问题，再给一张能帮助理解的图。:note[批注可以在这张纸中补充 :mark[背景]，不必增加一种新卡片。]

:::photos
![一本摊开的笔记本](/projects/syntax-showcase/attachments/sketch-notebook.svg)
**笔记的单位是一条可回看的记录**。:stamp[可修改]{green}
:::

::::fold[补充：这张纸还可以包含什么？]
- 一段真实的观察。
- 一条 :mark[带条件的判断]{pink}。
- 一个 [可以回到来源的链接](/projects/syntax-showcase/)。

:::postit[内层提醒]{warn}
嵌套的便利贴收敛装饰和间距，让内容比边框更显眼。:note[再小一层，批注也不应该越界。]
:::
::::
:::::

## 05 · 标题、链接和印章都能换行

<span id="inline-markers"></span>

### :mark[一条足够长、在手机上需要换行的标题：把观察、证据与仍然未知的部分写在同一页]{yellow} :stamp[继续修订]{blue}

[:mark[这个高亮仍然是一个普通链接]{green}](/projects/syntax-showcase/)；[:stamp[查看原演示]{blue}](/projects/syntax-showcase/) 也仍然是链接。

:::postit[带长标识符的记录]{info}
`experiment_reproduction_environment_2026_09_30_revision_0123456789` 不应该把便利贴撑出手机屏幕。

:stamp[一个较长的状态说明：需要补充环境与重复次数]{red} 可以换行。答案暂时 :pen[只在当前条件下成立]{hide}，用 Tab 到达它，再按空格揭开。
:::

## 06 · 深层组合仍有清楚的阅读顺序

:::::::fold[展开：两栏、便利贴和内层折页]{open}
::::::layout{cols=2}
:::::postit[左：主要结论]{tip}
先把 :mark[结论] 放在这里。:note[每条批注属于它附近的内容。]

::::fold[展开依据]
依据不必在第一眼就全部出现。:stamp[待检查]{blue}

:::note[范围]
这是一个 **版式示例**，没有借用真实项目的数据。
:::
::::
:::::

:::::postit[右：下一次检查]{info}
1. 用 Tab 检查折页和批注。
2. 点击 :pen[隐藏内容]{hide}。
3. 切换浅色、深色和配色。
4. 把窗口缩窄，确认阅读顺序一致。
:::::
::::::
:::::::

这一页没有增加新的指令名称。正文源码中的所有组合都由现有 `note`、`mark`、`stamp`、`photos`、`postit`、`fold`、`layout` 和 `pen` 组成。

::::::::::::fold[查看整页 Markdown]

````````md
## 01 · 正文与页边，保持各自的节奏

批注可以补充依据，而不打断主要论述。比如这一条观察 :stamp[待复核]{blue}，需要保留它成立的条件。:note[这里允许 **加粗**、:mark[高亮条件]{yellow} 和 :stamp[有边界]{blue}。链接仍能正常访问：[原有语法演示](/projects/syntax-showcase/)，点击链接不应收起批注。]

一条普通脚注也可以使用相同的标记[^boundary]。再次引用同一条脚注[^boundary]，两个触发位置应能分别展开。

:::note[一张写在页边的工作纸]
先读正文，再回来核对：

- :mark[有没有保留前提？]{green}
- :stamp[检查过]{green} 只是当前状态，不是永久结论。
- 公式仍可读：$e_{k+1}=(1-K\Delta t)e_k$。
:::

页边信息可以比正文更琐碎，但它仍然属于这一段。接下来的正文不应该挤进批注，也不应该被批注盖住。

[^boundary]: 结论依赖 :mark[测试范围]。这里的 **链接与格式** 应被保留：[查看组合中的图注](#photos-in-fold)。

## 02 · 两张便利贴，各自带着批注

:::::layout{cols=2}
::::postit[观察记录 :stamp[初稿]{blue}]{info}
把 :mark[事实]{green} 和解释分开写。:note[窄容器里的批注留在当前卡片内，不飞到整页右侧。链接和 :stamp[状态]{green} 可以一起出现。]

- **看到了什么**：相同输入得到两个结果。
- **还缺什么**：环境、版本与重复次数。

:::note[补充记录]
这条块级批注也是当前便利贴的一部分。

可以继续记录 :mark[一个具体的前提]，也可以放一个 [返回正文的链接](#inline-markers)。
:::
::::

::::postit[修订决定 :stamp[可检查]{green}]{tip}
解释暂时保留，但把 :pen[已经证明了]{strike} 改为 **在这组条件下观察到**。:note[两栏变成一栏时，批注仍跟着自己的记录。]

```python
conditions = {"runs": 3, "same_input": True}
print(conditions)
```

复制按钮应能使用键盘到达，也不遮住第一行。
::::
:::::

## 03 · 折页里放图，图注里放笔迹

::::fold[展开这份图像记录 :stamp[两张]{blue}]{#photos-in-fold}
:::photos{cols=2}
[![机械臂的线稿](/projects/syntax-showcase/attachments/sketch-arm.svg)](/projects/syntax-showcase/attachments/sketch-arm.svg)
**图 A** · :mark[原图链接被保留]{green}。:stamp[草图]{blue} :note[点击图片打开它原来的链接；点击编号仅展开说明。]

![四足机器人的线稿](/projects/syntax-showcase/attachments/sketch-dog.svg)
**图 B** · :mark[结构示意]{yellow}，不代表真实测试。:stamp[示意]{red}

这段正文仍属于相片组，不能因为它不是图片而被丢掉。可以继续放 [图注中的链接](#inline-markers) 或 :mark[文字说明]。
:::

图注与原图链接在折页中保持各自的作用。关闭折页后，内容留在原来的位置。
::::

## 04 · 便利贴里放图，折页再补细节

:::::postit[一张完整的观察纸]{question}
先写主要问题，再给一张能帮助理解的图。:note[批注可以在这张纸中补充 :mark[背景]，不必增加一种新卡片。]

:::photos
![一本摊开的笔记本](/projects/syntax-showcase/attachments/sketch-notebook.svg)
**笔记的单位是一条可回看的记录**。:stamp[可修改]{green}
:::

::::fold[补充：这张纸还可以包含什么？]
- 一段真实的观察。
- 一条 :mark[带条件的判断]{pink}。
- 一个 [可以回到来源的链接](/projects/syntax-showcase/)。

:::postit[内层提醒]{warn}
嵌套的便利贴收敛装饰和间距，让内容比边框更显眼。:note[再小一层，批注也不应该越界。]
:::
::::
:::::

## 05 · 标题、链接和印章都能换行

<span id="inline-markers"></span>

### :mark[一条足够长、在手机上需要换行的标题：把观察、证据与仍然未知的部分写在同一页]{yellow} :stamp[继续修订]{blue}

[:mark[这个高亮仍然是一个普通链接]{green}](/projects/syntax-showcase/)；[:stamp[查看原演示]{blue}](/projects/syntax-showcase/) 也仍然是链接。

:::postit[带长标识符的记录]{info}
`experiment_reproduction_environment_2026_09_30_revision_0123456789` 不应该把便利贴撑出手机屏幕。

:stamp[一个较长的状态说明：需要补充环境与重复次数]{red} 可以换行。答案暂时 :pen[只在当前条件下成立]{hide}，用 Tab 到达它，再按空格揭开。
:::

## 06 · 深层组合仍有清楚的阅读顺序

:::::::fold[展开：两栏、便利贴和内层折页]{open}
::::::layout{cols=2}
:::::postit[左：主要结论]{tip}
先把 :mark[结论] 放在这里。:note[每条批注属于它附近的内容。]

::::fold[展开依据]
依据不必在第一眼就全部出现。:stamp[待检查]{blue}

:::note[范围]
这是一个 **版式示例**，没有借用真实项目的数据。
:::
::::
:::::

:::::postit[右：下一次检查]{info}
1. 用 Tab 检查折页和批注。
2. 点击 :pen[隐藏内容]{hide}。
3. 切换浅色、深色和配色。
4. 把窗口缩窄，确认阅读顺序一致。
:::::
::::::
:::::::

这一页没有增加新的指令名称。正文源码中的所有组合都由现有 `note`、`mark`、`stamp`、`photos`、`postit`、`fold`、`layout` 和 `pen` 组成。

````````

::::::::::::
