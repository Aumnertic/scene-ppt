# scene-ppt

按使用场景设计中文 PPT 的 Claude Code Skill。先问清场合、受众和用途，再根据场景和材料选风格，用 HTML/SVG 渲染出有设计感的页面，导出 PNG 和 PDF。

AI 直出的 PPT 往往只有卡片和平涂色。这个 Skill 走 HTML/SVG 路线，能做复杂形状、结构图和密排版。

## 风格分支

| 分支 | 场景 | 主题 |
|---|---|---|
| `roadshow-cn` | 挑战杯、互联网+、创业比赛路演 | 深蓝 + 金 |
| `course-report` | 课程汇报、读书报告、小组研究 | `paper` / `swiss` |
| `school-event` | 班会、校园活动、毕业回顾 | `handbook` / `pop` |
| `curve-minimal` | 贝塞尔曲线极简，凸显个人风格 | `pen` / `ribbon` |

每个分支的 `exemplar/` 里有样板 deck 和截图。

## 结构

```
SKILL.md        入口与流程
guide/          设计指导：形状怎么选、反面清单
lib/            共用 SVG 形状库 shapes.js、base.css
scripts/        render.py（渲染 + 溢出检查 + 导出）、fontcheck.py、pixeldiff.py
styles/<分支>/   tokens.css、components.css、style.md、exemplar/
```

## 安装

```sh
git clone https://github.com/Aumnertic/scene-ppt ~/.claude/skills/scene-ppt
```

## 环境

macOS、Google Chrome、[uv](https://github.com/astral-sh/uv)。渲染时用 playwright 调本机 Chrome，不下载浏览器。字体用 macOS 系统中文字体，不随包分发。

```sh
uv run --with playwright python scripts/render.py deck.html out [theme]
```

## 状态

施工中。`roadshow-cn` 是已验收的基准，其余分支是草稿。

## License

MIT
