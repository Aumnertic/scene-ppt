---
name: scene-ppt
description: 按使用场景设计中文 PPT / 幻灯片 / 演示文稿：先问清场合、受众和用途，再根据场景和用户材料选风格，用 HTML/SVG 渲染出有设计感的页面并导出 PNG 和 PDF。内置四个风格分支：竞赛路演（挑战杯、互联网+）、课程汇报、班会和校园活动、需要凸显设计感和个人风格的贝塞尔曲线极简风，也能为其他场景派生新风格。只要用户想做 PPT、deck、slides、路演稿、答辩、汇报、班会课件、活动展示，或者抱怨 AI 做的 PPT 太丑、太模板化、只有卡片，都应该使用这个 skill，即使用户没有说「设计」两个字。
compatibility: 需要 macOS、Google Chrome 和 uv（渲染时用 playwright 调用本机 Chrome）；字体依赖 macOS 系统中文字体。
---

# 场景化 PPT 设计

这个 skill 提供两样东西：

1. **模板参考**：`styles/<分支>/exemplar/` 和 `samples/` 里的成品样板。
2. **设计指导**：`guide/` 里关于「怎么组织、用什么形状」的说明。

**核心原则：风格跟着场景和材料走，不写死。**样板用来定质量标杆、演示手法，不是让你照着抄。新 deck 要按自己的内容重新构图。照抄样板的排版，或者让每套 deck 长得都一样，正是这个 skill 要避免的「AI 感」。

## 环境要求

- macOS、Google Chrome、`uv`。渲染时调用本机 Chrome，不需要下载浏览器。
- 字体都是 macOS 系统字体，不能随 skill 打包。中文字体的粗细档必须用 PostScript 名指定，例如 `STSongti-SC-Black`、`FZLTTHK--GBK1-0`。只写族名加 `font-weight`，会回落到常规体。

## 流程

### 00 场景判断

**先读用户给的材料**，材料能回答的问题就不要再问。然后只问「答案会改变设计决定」的问题，一次最多问 3 到 4 个。有提问工具时用提问工具。

| 问题 | 决定什么 |
|---|---|
| 用在什么场合？比如比赛路演、课程或学术汇报、班会或校园活动、工作汇报、其他 | 选哪个风格分支 |
| 现场投屏讲，还是发文件让人自己看？讲多久？ | 信息密度和页数。投屏讲：字大、字少，约 1 分钟 1 页。发文件：信息可以更密 |
| 想让观众记住什么、感觉到什么？比如专业可信、有想法、温暖有趣、热血 | 选分支里的哪套主题 |
| 有没有必须用的颜色、标志或模板要求？比如校徽、班旗色、赛事要求 | 主色变量 |

**场景 → 分支和主题**

| 场景 | 分支 | 主题怎么选 | 密度 |
|---|---|---|---|
| 挑战杯、互联网+、创业比赛、项目答辩 | `roadshow-cn` | 单主题；赛事偏商业时，金色调亮，再加科技青 | 塞满（七成以上） |
| 课程期末汇报、读书报告、小组研究展示 | `course-report` | 人文社科选 `paper`；理工、设计、数据选 `swiss` | 可以留白，字号反差要大 |
| 班会、期中期末回顾、运动会、社团、毕业 | `school-event` | 回忆、感谢选 `handbook`；比赛、动员选 `pop` | 可以留白，每页有一个「实物」 |
| 需要凸显设计感、个人风格：作品集讲解、求职或保研面试的自我介绍、设计类分享、个人主题演讲 | `curve-minimal` | 想要克制、理性、像设计稿，或者要发文件、打印，选 `pen`（浅底）；想要更有表现力、更有个人气质，现场投屏讲，选 `ribbon`（深底） | 极少，大量留白；每页只有一处重点 |
| 都不合适 | 新建主题或分支，见下文 | — | — |

**没有合适的分支时，不要硬套最接近的那个。**按「气质 → 字体 → 形状语言 → 颜色」的顺序派生一套新的 `tokens.css`。必需的变量和按需变量的划分写在 `styles/roadshow-cn/tokens.css` 开头。字体先用 `scripts/fontcheck.py` 确认 Chrome 确实用上了。

主色优先从用户材料里取，比如学校标准色、班旗色、课题相关的颜色。

### 01 整理素材

列出用户材料里的照片、关键数字、原话引文、证书文件。照片的多少会直接影响版式：照片少于 3 张时，不要做照片墙。目前这一步靠手工整理，还没有脚本。

### 02 大纲

先定章节，再给每页分配角色：封面、章节页、内容页、数据页、结尾。各分支的典型页型见 `styles/<分支>/style.md`。

### 03 每页选形状

每一页先认出它的**信息关系**（层级、顺序、对比、排序、占比、关键数字、并列、现场照片……），再到 **`guide/shapes.md`** 找对应的候选形状，按选择标准和当前分支挑一个。说不出「为什么用这个形状」，就是选错了。装饰最后加，按构图作用挑（同一份文档第 4 节）。

### 04 渲染

1. 参照所选分支 `exemplar/deck.html` 的**文件结构**来写，不要照搬它的构图：
   - `<head>` 第一行放主题脚本 `<script>{const t=new URLSearchParams(location.search).get('theme');if(t)document.documentElement.dataset.theme=t}</script>`。漏掉它，`render.py` 传了主题名也会静默渲染成默认主题；
   - 然后依次引用 `tokens.css`、`lib/base.css`、分支的 `components.css`。roadshow-cn 是单主题分支，也没有接入 `lib/base.css`，按它自己的样板来写；
   - 页面末尾引用 `lib/shapes.js`；
   - 每页一个 `<section class="slide">`，尺寸 1920×1080。
2. 页面 `<style>` 里只写坐标和尺寸。颜色都用 `var(--c-*)`，或者在 JS 里用 `Shapes.T('角色名')` 读取。
3. 照片位用 `<div class="photo" data-label="…">`。有真图时在里面放 `<img>`。
4. 要出 PPTX 时，边写页面边加动画标注和讲稿：`data-anim` / `data-step`，`<aside class="notes">`。规则和设计原则见 **`guide/animation.md`**。几个元素一起出场时，用 `.grp` 包起来，不要用普通 `<div>`。
5. 渲染命令：

```bash
uv run --with playwright python scripts/render.py <deck.html> <输出目录> [主题名]
```

### 05 检查

- `render.py` 会自动检查：文本框溢出（只查加了 `.fit` 的元素）、JS 报错、省略号、主题变量缺失。
- **每一页的 PNG 都要看一遍。**自动检查查不到元素重叠、遮挡、末尾单字成行。新做的页面第一次渲染时，几乎每页都会有这类问题。
- 对照 **`guide/anti-patterns.md`** 检查：只有卡片、粉紫渐变、emoji 代替插画，都算失败。
- 大号书法、手写或展示字体的标题不要加 `.fit`，否则检查会误报。

### 06 交付

把 PNG 和 PDF（`render.py` 已经生成）交给用户，让用户自己看效果。

需要在 PowerPoint 或 WPS 里放映，或者需要动画时，导出 PPTX：

```bash
uv run --with playwright --with python-pptx --with pillow --with lxml \
  python scripts/export_pptx.py <deck.html> <输出目录>/deck.pptx [--theme 主题名]
```

PPTX 里每页是一张底图加若干透明图层，带 PowerPoint 原生的动画、切换和备注。文字不能在 PPT 里直接改；要修改就改 HTML，再重新渲染和导出。

## 文件索引

| 路径 | 内容 | 什么时候读 |
|---|---|---|
| `guide/shapes.md` | 信息关系 → 形状，附理由、场景变体、实现方式、变量依赖 | 阶段 03，每页都要用 |
| `guide/anti-patterns.md` | AI 直出 PPT 的典型特征 | 阶段 05 |
| `styles/<分支>/style.md` | 分支的适用场景、设计手法、页型、主题选择依据 | 选好分支之后 |
| `styles/<分支>/tokens.css` | 颜色、字体、字号变量；不同主题用 `[data-theme]` 覆盖 | 改主色或新建主题时 |
| `styles/<分支>/components.css` | 分支的 HTML 组件 | 阶段 04 |
| `styles/<分支>/exemplar/` | 4 页样板加各主题的截图 | 阶段 04，看手法用 |
| `styles/school-event/samples/banhui-full/` | 12 页完整班会样板（handbook 主题，用户好评） | 做完整 deck 时参考节奏 |
| `lib/shapes.js` | 19 个 SVG 生成器（结构、数据、装饰、手绘） | 阶段 04 |
| `lib/base.css` | 重置样式、画布、照片位 | 阶段 04 |
| `scripts/render.py` | 渲染、检查、导出 PNG 和 PDF | 阶段 04、05 |
| `guide/animation.md` | 动画标注、拆层规则、动画怎么设计 | 要出 PPTX 时，阶段 04 |
| `scripts/export_pptx.py` | 拆层导出带动画的 PPTX | 阶段 06 |
| `scripts/vendor/ppt_master/` | 动画和切换的 OOXML 生成器（来自 PPT Master，MIT） | 不用读 |
| `scripts/pixeldiff.py` | 逐像素对比，用来回归检查 | 改了 `lib/` 之后 |
| `scripts/fontcheck.py` | 查 Chrome 实际用上的字体 | 新建主题、换字体时 |

## 尚未完成

- 01 到 03 阶段还没有脚本，靠按上面的说明手工完成。
- `guide/organization.md`（整套 deck 的章节骨架、页型角色、节奏）还没写。
- PPTX 里的文字是图片，不能在 PPT 里改（为了观感一致和字体不丢，有意这样设计）。
- 字体不能跨机器：换到非 macOS 环境时，要改用可打包的开源网页字体。
