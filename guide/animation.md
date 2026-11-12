# 动画与 PPTX 导出

`scripts/export_pptx.py` 把 deck.html 导出成带 PowerPoint 原生动画的 .pptx。

做法是拆层：
- **底图**：把带标注的元素藏起来（保留布局），截整页。纹理、滤镜、混合模式都烤在底图里。
- **图层**：每个带标注的元素单独截一张透明图，放回原来的坐标。
- **动画和切换**：写成 PowerPoint 原生 XML。这部分代码来自 [PPT Master](https://github.com/hugohe3/ppt-master)（MIT），在 `scripts/vendor/ppt_master/`。

导出后观感和 PNG/PDF 完全一致，换电脑也不会丢字体。代价是文字不能在 PPT 里改，要改就改 HTML 再导出。

```bash
uv run --with playwright --with python-pptx --with pillow --with lxml \
  python scripts/export_pptx.py deck.html out/deck.pptx [--theme 名] [--transition fade]
```

`--list` 列出全部效果名，`--keep` 保留中间图片（在 `out/_layers/`）。

## 标注

不加标注的页就是一张静态图，只有页面切换。

| 写在哪 | 属性 | 作用 |
|---|---|---|
| `<section class="slide">` | `data-transition="fade"` | 切到这页时的切换效果，默认取 `--transition`。`morph` 是平滑切换，`none` 关闭 |
| | `data-transition-dur="1"` | 切换时长（秒） |
| 元素 | `data-anim="fade"` | 进入动画。短名：`fade` `wipe` `fly` `zoom` `rise` `float` `split` `stretch` `appear` `grow` `faded-zoom` `ease-in` `unfold`；也可以写规范名 `entrance_*` / `emphasis_*` / `exit_*` |
| | `data-dir="right"` | 方向，适用于 wipe、fly、zoom、split、stretch 等。写的是运动方向：`right` 就是“从左侧” |
| | `data-step="1"` | 第几次单击出现。`0` 表示切到这页后自动播放。不写时沿用上一个标注元素的 step，第一个默认是 0 |
| | `data-with` | 和上一个动画同时开始。默认是上一个播完再开始 |
| | `data-delay="150"` | 延迟（毫秒） |
| | `data-dur="0.8"` | 时长（秒），默认 0.5 |
| 元素 | `data-morph="flag"` | 单独成层，命名为 `!!flag`。相邻两页同名的层，在 morph 切换时会平滑移动和缩放 |
| 页内 | `<aside class="notes">…</aside>` | 讲稿，写进备注页。截图和导出画面里都会隐藏 |

### 把几个元素合成一个动画

用 `.grp` 包起来，标注写在包装盒上：

```html
<div class="grp" data-anim="rise" data-step="2">
  <i class="dot" style="top:672px"></i>
  <div class="y" style="left:880px;top:660px">1942</div>
  <div class="t" style="left:1110px;top:660px">……</div>
</div>
```

`.grp` 在 `lib/base.css` 里定义，是一个铺满父级定位盒的透明盒子，包进去的元素坐标和换行都不会变。不要用普通的 `<div>` 包：它没有定位，会改变层叠顺序（被 `z-index:1` 的兄弟元素盖住），而且绝对定位子元素的宽度会塌掉。

JS 生成的内容同样适用：生成 HTML 时把每组包进 `.grp`。一张 SVG 里的几个部分要分别出场时，拆成几张叠在一起的 SVG。例如路线图拆成“底图”和“高亮段”两张同尺寸的 SVG 叠放，高亮段再用 wipe 擦出来；横向箭头时间轴每一段生成一张 SVG。

### 图层规则

- 一个标注元素连同它的全部子元素是一层。嵌套的标注元素各自成层，会从父层里扣掉。
- 图层永远在底图上面。如果某个静态元素在 HTML 里压在标注元素上面，导出后它会跑到图层下面。脚本发现这种情况会报警告。如果两者的像素实际并不重叠（比如只是包围盒交叉），可以忽略；如果真的重叠，就给那个静态元素也加上标注。
- 图层按真正画出东西的范围裁切：文字、svg、img、有背景或边框的盒子都算。阴影和辉光会多留 48px 边。

## 怎么设计动画

动画是给讲的人用的：每次单击对应讲稿里的一句话。不是为了炫。

- **标题和页面框架不动**，随页面切换一起出现。动的是内容。
- **一次单击，一个论点。**讲稿里写到哪儿，就点到哪儿。用【单击】标出点击的位置，讲的人照着念就能对上。
- **一页 1 到 4 次单击。**超过 5 次，说明这页该拆了。
- **同一组的东西一次点出来**，用 after-previous 加短延迟依次出场。例如时间轴的五段、释义的四行。
- **效果选少数几种，全篇统一。**
  - `fade`：引文、照片、氛围。
  - `rise`：列表项、时间线条目。
  - `wipe`：线条、路线、横向时间轴、印章式的强调。方向跟着阅读或行进方向走。
  - `zoom` / `faded-zoom`：全页只有一个的重点，比如一句口号、一个大数字。
  - 不要用飞入、弹跳、旋转，除非场景本身需要（班会、活动可以活泼一些）。
- **封面和结尾页可以自动播放**（step 0）：切到这页后元素依次出现，不用点。
- **morph 用在“同一个东西换了位置或尺度”的地方**：地图从全图推近到局部、某个元素从目录飞到正文。两页上的这个元素要标同样的 `data-morph` 名。不同图片之间做 morph 会一边移动一边淡入淡出。
- 重点页（情感高点、结盟、献旗这类）把切换放慢到 1 到 1.2 秒。

## 检查

- 脚本会自动校验每页时间轴的结构（PPT Master 的 `validate_pptx_animation_package`）。
- 交付前在 PowerPoint 或 WPS 里实际放一遍。WPS 对 morph 的支持取决于版本，不支持时会退回淡入淡出（XML 里写了 fallback）。
- 想确认拆层没有错位：用 python-pptx 读出每张图的位置叠回去，和 `render.py` 的 PNG 逐像素对比。差异应该只出现在文字边缘的抗锯齿上。
