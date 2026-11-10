/* 形状库：SVG 生成器，所有风格分支共用。
 *
 * 约定
 * - 每个函数对应一种「信息关系」的画法，签名统一为 (svg, data, opts)。
 * - 颜色和字体只从风格分支的 CSS 变量读取（tokens.css 里的 --c-* 和 --f-*），这里不写死。
 *   换风格只需要换 tokens.css。
 * - 几何参数（尺寸、间距）放在 opts 里，默认值按 1920×1080 画布调好。
 *
 * 各函数适用的信息关系，见 ../guide/shapes.md。
 */
(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // 读主题变量：T('accent') → --c-accent 的值；font('sans') → --f-sans
  const root = () => getComputedStyle(document.documentElement);
  // 变量缺失时报错（render.py 会收集 console.error），避免图形静默变黑或消失
  const need = (name) => {
    const v = root().getPropertyValue(name).trim();
    if (!v) console.error(`主题变量缺失：${name}`);
    return v;
  };
  const T = (n) => need("--c-" + n);
  const font = (n) => need("--f-" + n);
  // 空格分隔的颜色列表，'/' 分组：--iso-ramp: a b c / d e f
  const list = (n) => T(n).split(/\s+/).filter(Boolean);
  const groups = (n) => T(n).split("/").map((g) => g.trim().split(/\s+/));
  function alpha(hex, a) {
    const h = hex.replace("#", "");
    const v = (i) => parseInt(h.slice(i, i + 2), 16);
    return `rgba(${v(0)},${v(2)},${v(4)},${a})`;
  }

  /* ---------- 底纹 ---------- */

  // 数据雨：竖线 + 端点。用于深色科技封面的氛围层
  function dataRain(svg, _data, o = {}) {
    const n = o.n ?? 46;
    for (let i = 0; i < n; i++) {
      const x = 20 + i * 41 + ((i * 37) % 23), len = 40 + ((i * 53) % 160), y = (i * 71) % 120;
      el("line", { x1: x, y1: y, x2: x, y2: y + len, stroke: T("glow-2"), "stroke-width": 1.2, opacity: 0.35 }, svg);
      el("circle", { cx: x, cy: y + len, r: 3.2, fill: T("glow-3"), opacity: 0.8 }, svg);
    }
  }

  // 网格波浪：透视感的起伏网格，压在页面下部做「地面」
  function meshWave(svg, _data, o = {}) {
    const W = o.width ?? 1920, rows = o.rows ?? 22, cols = o.cols ?? 60, base = o.baseY ?? 760;
    const c = T("glow");
    const h = (x, j) => base + j * 15 + Math.sin(x / 170 + j * 0.35) * 38 + Math.sin(x / 63 + j) * 10;
    for (let j = 0; j < rows; j++) {
      let d = "";
      for (let i = 0; i <= cols; i++) { const x = (i * W) / cols; d += (i ? "L" : "M") + x.toFixed(1) + " " + h(x, j).toFixed(1); }
      el("path", { d, fill: "none", stroke: c, "stroke-width": 1.1, opacity: (0.15 + j * 0.03).toFixed(2) }, svg);
    }
    for (let i = 0; i <= cols; i++) {
      const x = (i * W) / cols; let d = "";
      for (let j = 0; j < rows; j++) d += (j ? "L" : "M") + x.toFixed(1) + " " + h(x, j).toFixed(1);
      el("path", { d, fill: "none", stroke: c, "stroke-width": 0.8, opacity: 0.22 }, svg);
    }
  }

  // 六边形底纹：整页铺满，透明度由外层 svg 控制
  function hexGrid(svg, _data, o = {}) {
    const R = o.r ?? 34, W = o.width ?? 1980, H = o.height ?? 1120, w = R * Math.sqrt(3);
    const stroke = o.stroke ?? T("on-dark");
    for (let y = 0; y < H; y += R * 1.5)
      for (let x = 0; x < W; x += w) {
        const ox = (y / (R * 1.5)) % 2 ? w / 2 : 0; let d = "";
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          d += (k ? "L" : "M") + (x + ox + R * Math.cos(a)).toFixed(1) + " " + (y + R * Math.sin(a)).toFixed(1);
        }
        el("path", { d: d + "Z", fill: "none", stroke, "stroke-width": 1 }, svg);
      }
  }

  /* ---------- 结构 ---------- */

  // 等轴测堆叠：分层架构（上层依赖下层）。data.layers 自上而下 [{name, items:[]}]
  function isoStack(svg, data, o = {}) {
    const F = font("sans");
    const ramp = groups("iso-ramp"); // 每层 [亮, 中, 暗]，自上而下
    const defs = el("defs", {}, svg);
    const cx = o.cx ?? 250, w = o.w ?? 190, dh = o.dh ?? 95, th = o.th ?? 34, gap = o.gap ?? 150, top = o.top ?? 70;
    const id = svg.id || "iso";
    data.layers.forEach((L, i) => {
      const c = ramp[i % ramp.length], y = top + i * gap;
      const g = el("linearGradient", { id: id + i, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
      el("stop", { offset: 0, "stop-color": c[0] }, g); el("stop", { offset: 1, "stop-color": c[1] }, g);
      const top4 = `M${cx} ${y} L${cx + w} ${y + dh / 2} L${cx} ${y + dh} L${cx - w} ${y + dh / 2}Z`;
      el("path", { d: `M${cx - w} ${y + dh / 2} L${cx} ${y + dh} L${cx} ${y + dh + th} L${cx - w} ${y + dh / 2 + th}Z`, fill: c[2] }, svg);
      el("path", { d: `M${cx + w} ${y + dh / 2} L${cx} ${y + dh} L${cx} ${y + dh + th} L${cx + w} ${y + dh / 2 + th}Z`, fill: c[1], opacity: 0.9 }, svg);
      el("path", { d: top4, fill: `url(#${id}${i})`, stroke: T("on-dark"), "stroke-width": 2 }, svg);
      el("text", { x: cx, y: y + dh / 2 + 10, "text-anchor": "middle", "font-size": 30, "font-weight": 800, fill: T("on-dark"), "font-family": F }, svg, L.name);
      // 引线 + 要点胶囊
      const lx = cx + w + 10, ly = y + dh / 2;
      el("path", { d: `M${cx + w - 20} ${ly} L${lx + 40} ${ly}`, stroke: T("leader"), "stroke-width": 2, "stroke-dasharray": "5 5" }, svg);
      el("circle", { cx: cx + w - 20, cy: ly, r: 5, fill: T("accent") }, svg);
      L.items.forEach((t, k) => {
        const bx = lx + 48, by = ly - 48 + k * 34;
        el("rect", { x: bx, y: by, width: 200, height: 28, rx: 14, fill: T("surface"), stroke: c[1], "stroke-width": 2 }, svg);
        el("text", { x: bx + 100, y: by + 20, "text-anchor": "middle", "font-size": 17, "font-weight": 700, fill: T("ink"), "font-family": F }, svg, t);
      });
      if (i < data.layers.length - 1) {
        el("path", { d: `M${cx} ${y + dh + th + 6} L${cx} ${y + gap - 4}`, stroke: T("accent"), "stroke-width": 3 }, svg);
        el("path", { d: `M${cx - 8} ${y + gap - 14} L${cx} ${y + gap - 2} L${cx + 8} ${y + gap - 14}`, fill: "none", stroke: T("accent"), "stroke-width": 3 }, svg);
      }
    });
    if (data.flowNote) {
      const yb = o.flowBottom ?? 640;
      el("path", { d: `M20 ${yb} L20 90`, stroke: T("primary"), "stroke-width": 4, "marker-end": "" }, svg);
      el("path", { d: "M8 104 L20 84 L32 104Z", fill: T("primary") }, svg);
      el("text", { x: 44, y: 380, "font-size": 20, "font-weight": 800, fill: T("primary"), "font-family": F, transform: "rotate(-90 44 380)", "text-anchor": "middle" }, svg, data.flowNote);
    }
  }

  // 箭头流程（chevron）：线性步骤。data.steps [[标题, 说明]]，opts.hl 为高亮步骤下标
  function chevronFlow(svg, data, o = {}) {
    const F = font("sans");
    const w = o.w ?? 372, h = o.h ?? 86, tip = o.tip ?? 34, hlIdx = o.hl ?? -1;
    const id = svg.id || "cg";
    data.steps.forEach(([t, d], i) => {
      const x = i * (w - 6), hl = i == hlIdx;
      const g = el("linearGradient", { id: id + i, x1: 0, x2: 1 }, el("defs", {}, svg));
      el("stop", { offset: 0, "stop-color": hl ? T("accent-hi") : T("primary-3") }, g);
      el("stop", { offset: 1, "stop-color": hl ? T("accent-lo") : T("dark") }, g);
      const p = i == 0
        ? `M${x} 0 H${x + w - tip} L${x + w} ${h / 2} L${x + w - tip} ${h} H${x}Z`
        : `M${x} 0 H${x + w - tip} L${x + w} ${h / 2} L${x + w - tip} ${h} H${x} L${x + tip} ${h / 2}Z`;
      el("path", { d: p, fill: `url(#${id}${i})`, stroke: T("on-dark"), "stroke-width": 3 }, svg);
      el("text", { x: x + w / 2 + (i ? 10 : -6), y: h / 2 + 11, "text-anchor": "middle", "font-size": 32, "font-weight": 800, fill: hl ? T("deep") : T("on-dark"), "font-family": F }, svg, `0${i + 1} ${t}`);
      el("text", { x: x + w / 2, y: h + 40, "text-anchor": "middle", "font-size": 20, "font-weight": 600, fill: T("ink-2"), "font-family": F }, svg, d);
    });
  }

  /* ---------- 数据 ---------- */

  // 指标环：少量独立指标的「占比/水平」。data.items [[名称, 显示值, 0-1]]
  function ringGauges(svg, data, o = {}) {
    const F = font("sans"), N = font("num"), hlIdx = o.hl ?? -1;
    data.items.forEach(([n, v, p], i) => {
      const cx = 75 + i * 160, cy = 68, r = 52, C = 2 * Math.PI * r;
      el("circle", { cx, cy, r, fill: "none", stroke: T("track"), "stroke-width": 12 }, svg);
      el("circle", { cx, cy, r, fill: "none", stroke: i == hlIdx ? T("accent") : T("primary"), "stroke-width": 12, "stroke-linecap": "round", "stroke-dasharray": `${C * Math.max(p, 0.12)} ${C}`, transform: `rotate(-90 ${cx} ${cy})` }, svg);
      el("text", { x: cx, y: cy + 9, "text-anchor": "middle", "font-size": 26, "font-weight": 700, fill: T("dark"), "font-family": N }, svg, v);
      el("text", { x: cx, y: cy + r + 30, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: T("ink-2"), "font-family": F }, svg, n);
    });
  }

  // 分组柱状图：多对象 × 多类别对比。最后一个系列视为「本作品」，标数值
  function groupedBars(svg, data, o = {}) {
    const F = font("sans"), N = font("num");
    const pal = list("series");
    const { cats, series } = data, max = data.max ?? 100;
    const L = o.left ?? 80, Tp = o.top ?? 70, W = o.width ?? 760, H = o.height ?? 300;
    const ours = series.length - 1;
    for (let k = 0; k <= 5; k++) {
      const y = Tp + H - (H * k) / 5;
      el("line", { x1: L, y1: y, x2: L + W, y2: y, stroke: T("line-soft"), "stroke-width": 1.5 }, svg);
      el("text", { x: L - 12, y: y + 6, "text-anchor": "end", "font-size": 16, fill: T("ink-3"), "font-family": N }, svg, (k * max) / 5 + "%");
    }
    const gw = W / cats.length, bw = 38, mid = (series.length - 1) / 2;
    cats.forEach((c, i) => {
      series.forEach((sr, j) => {
        const col = pal[j % pal.length], v = sr.v[i], bh = (H * v) / max, x = L + i * gw + gw / 2 + (j - mid) * (bw + 6) - bw / 2, y = Tp + H - bh;
        el("rect", { x, y, width: bw, height: bh, fill: col, rx: 3 }, svg);
        if (j == ours) el("text", { x: x + bw / 2, y: y - 10, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: col, "font-family": N }, svg, v);
      });
      el("text", { x: L + i * gw + gw / 2, y: Tp + H + 32, "text-anchor": "middle", "font-size": 19, "font-weight": 700, fill: T("ink"), "font-family": F }, svg, c);
    });
    if (data.avg != null) {
      const ya = Tp + H - (H * data.avg) / max;
      el("line", { x1: L, y1: ya, x2: L + W, y2: ya, stroke: T("accent-lo"), "stroke-width": 2, "stroke-dasharray": "8 6" }, svg);
      el("rect", { x: L + W - 150, y: ya - 34, width: 150, height: 28, rx: 4, fill: T("accent") }, svg);
      el("text", { x: L + W - 75, y: ya - 14, "text-anchor": "middle", "font-size": 16, "font-weight": 800, fill: T("deep"), "font-family": F }, svg, data.avgLabel ?? `均值 ${data.avg}%`);
    }
    series.forEach((sr, j) => {
      const x = L + 20 + j * 190;
      el("rect", { x, y: 22, width: 22, height: 22, rx: 3, fill: pal[j % pal.length] }, svg);
      el("text", { x: x + 32, y: 40, "font-size": 18, "font-weight": 700, fill: T("ink"), "font-family": F }, svg, sr.n);
    });
  }

  // 雷达图：两个对象在多个维度上的综合对比。data.series[0] 是对照，[1] 是本作品
  function radar(svg, data, o = {}) {
    const F = font("sans");
    const ax = data.axes, cx = o.cx ?? 205, cy = o.cy ?? 225, R = o.r ?? 130;
    const P = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / ax.length; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    for (let k = 1; k <= 4; k++)
      el("polygon", { points: ax.map((_, i) => P(i, (R * k) / 4).join(",")).join(" "), fill: k % 2 ? T("tint") : T("surface"), stroke: T("line"), "stroke-width": 1.5 }, svg);
    ax.forEach((a, i) => {
      const [x, y] = P(i, R);
      el("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: T("line") }, svg);
      const [tx, ty] = P(i, R + 34);
      el("text", { x: tx, y: ty + 7, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: T("dark"), "font-family": F }, svg, a);
    });
    const [base, ours] = data.series;
    const baseC = T("primary-lt"), oursFill = T("accent"), oursC = T("accent-lo");
    el("polygon", { points: base.v.map((v, i) => P(i, R * v).join(",")).join(" "), fill: alpha(baseC, 0.25), stroke: baseC, "stroke-width": 2.5 }, svg);
    el("polygon", { points: ours.v.map((v, i) => P(i, R * v).join(",")).join(" "), fill: alpha(oursFill, 0.35), stroke: oursC, "stroke-width": 3 }, svg);
    ours.v.forEach((v, i) => { const [x, y] = P(i, R * v); el("circle", { cx: x, cy: y, r: 5, fill: T("emph"), stroke: T("surface"), "stroke-width": 2 }, svg); });
    [[ours.n, oursC], [base.n, baseC]].forEach(([n, c], j) => {
      const x = 70 + j * 150;
      el("rect", { x, y: 410, width: 20, height: 20, rx: 3, fill: c }, svg);
      el("text", { x: x + 28, y: 426, "font-size": 17, "font-weight": 700, fill: T("ink"), "font-family": F }, svg, n);
    });
  }

  /* ---------- 装饰：有机形与手作感 ----------
   * 给「讲究好看、有创意」的场景用（课程汇报、班会、校园活动）。
   * 全部用种子随机数：同样的 seed 每次渲染结果一样，方便像素对比。 */

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // 闭合平滑曲线（Catmull-Rom → 贝塞尔）
  function smoothClosed(pts) {
    const n = pts.length; let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + "Z";
  }

  // 有机色块：照片、标题背后的不规则底形
  function blob(svg, _d, o = {}) {
    const r = rng(o.seed ?? 1), n = o.points ?? 7, R = o.r ?? 200, wob = o.wobble ?? 0.22, cx = o.cx ?? 0, cy = o.cy ?? 0, sx = o.sx ?? 1, sy = o.sy ?? 1;
    const pts = [...Array(n)].map((_, i) => { const a = (i / n) * Math.PI * 2, k = R * (1 - wob + r() * wob * 2); return [cx + Math.cos(a) * k * sx, cy + Math.sin(a) * k * sy]; });
    return el("path", { d: smoothClosed(pts), fill: o.fill ?? T("accent"), opacity: o.opacity ?? 1 }, svg);
  }

  // 手绘波浪线：标题下划线、分隔
  function squiggle(svg, _d, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 0, w = o.w ?? 300, A = o.amp ?? 7, P = o.period ?? 36;
    let d = `M${x} ${y}`;
    for (let i = 0; i < w / P; i++) { const x0 = x + i * P; d += ` Q${x0 + P / 4} ${y - A} ${x0 + P / 2} ${y} T${x0 + P} ${y}`; }
    return el("path", { d, fill: "none", stroke: o.stroke ?? T("accent"), "stroke-width": o.width ?? 5, "stroke-linecap": "round" }, svg);
  }

  // 手绘圈注：圈住关键数字，两圈略错开
  function scribbleCircle(svg, _d, o = {}) {
    const r = rng(o.seed ?? 3), cx = o.cx, cy = o.cy, rx = o.rx ?? 90, ry = o.ry ?? 60, n = 28;
    const pts = [];
    for (let i = 0; i <= n * 1.12; i++) { const a = (i / n) * Math.PI * 2 - 0.6, j = 1 + (r() - 0.5) * 0.06 + i * 0.002; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return el("path", { d, fill: "none", stroke: o.stroke ?? T("accent"), "stroke-width": o.width ?? 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
  }

  // 彩纸屑：小矩形、圆点、三角、短波浪，随机散布在 area 内，避开 avoid 矩形
  function confetti(svg, _d, o = {}) {
    const r = rng(o.seed ?? 7), [ax, ay, aw, ah] = o.area ?? [0, 0, 1920, 1080], cols = o.colors ?? list("confetti"), n = o.n ?? 60, s = o.size ?? 14;
    const avoid = o.avoid ?? [];
    let placed = 0, tries = 0;
    while (placed < n && tries++ < n * 20) {
      const x = ax + r() * aw, y = ay + r() * ah, c = cols[Math.floor(r() * cols.length)], rot = r() * 360, k = Math.floor(r() * 4), sz = s * (0.6 + r() * 0.8);
      if (avoid.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh)) continue;
      const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})` }, svg);
      if (k == 0) el("rect", { x: -sz / 2, y: -sz / 5, width: sz, height: sz / 2.5, rx: 2, fill: c }, g);
      else if (k == 1) el("circle", { r: sz / 3, fill: c }, g);
      else if (k == 2) el("path", { d: `M0 ${-sz / 2} L${sz / 2} ${sz / 2} L${-sz / 2} ${sz / 2}Z`, fill: c }, g);
      else el("path", { d: `M${-sz} 0 q${sz / 2} ${-sz / 2} ${sz} 0 t${sz} 0`, fill: "none", stroke: c, "stroke-width": 3, "stroke-linecap": "round" }, g);
      placed++;
    }
  }

  // 半调网点：网点大小沿某个方向渐变，做印刷感的过渡
  function halftone(svg, _d, o = {}) {
    const x0 = o.x ?? 0, y0 = o.y ?? 0, w = o.w ?? 400, h = o.h ?? 400, g = o.gap ?? 18, rmax = o.r ?? 6, dir = o.dir ?? "x";
    for (let y = 0; y <= h; y += g) for (let x = 0; x <= w; x += g) {
      const t = dir == "x" ? x / w : dir == "y" ? y / h : Math.hypot(x - w / 2, y - h / 2) / (Math.hypot(w, h) / 2);
      const r = rmax * (1 - t); if (r < 0.6) continue;
      el("circle", { cx: x0 + x, cy: y0 + y, r: r.toFixed(2), fill: o.fill ?? T("ink"), opacity: o.opacity ?? 1 }, svg);
    }
  }

  // 爆炸贴纸：锯齿圆，放标语或数字
  function starburst(svg, _d, o = {}) {
    const cx = o.cx, cy = o.cy, R = o.r ?? 90, k = o.spikes ?? 16, inner = o.inner ?? 0.82;
    const pts = [...Array(k * 2)].map((_, i) => { const a = (i / (k * 2)) * Math.PI * 2, rr = i % 2 ? R * inner : R; return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`; });
    return el("polygon", { points: pts.join(" "), fill: o.fill ?? T("accent"), stroke: o.stroke ?? "none", "stroke-width": o.strokeWidth ?? 0, transform: o.rotate ? `rotate(${o.rotate} ${cx} ${cy})` : "" }, svg);
  }

  // 蜿蜒路径：活动流程、时间线。比箭头流程图轻松，节点沿 S 形曲线分布
  // data.stops [{t:时间, d:内容}]；返回各节点坐标，方便页面在节点旁放 HTML
  function windingPath(svg, data, o = {}) {
    const x0 = o.x ?? 100, y0 = o.y ?? 300, w = o.w ?? 1600, amp = o.amp ?? 120, n = data.stops.length;
    const P = (t) => [x0 + w * t, y0 + Math.sin(t * Math.PI * (o.waves ?? 2)) * amp];
    let d = ""; for (let i = 0; i <= 100; i++) { const [x, y] = P(i / 100); d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }
    el("path", { d, fill: "none", stroke: o.track ?? T("line"), "stroke-width": o.trackWidth ?? 16, "stroke-linecap": "round" }, svg);
    el("path", { d, fill: "none", stroke: o.dash ?? T("surface"), "stroke-width": 3, "stroke-dasharray": "2 14", "stroke-linecap": "round" }, svg);
    const cols = o.colors ?? list("confetti");
    return data.stops.map((s, i) => {
      const t = n == 1 ? 0.5 : 0.04 + (0.92 * i) / (n - 1), [x, y] = P(t);
      el("circle", { cx: x, cy: y, r: o.node ?? 30, fill: cols[i % cols.length], stroke: o.nodeStroke ?? T("surface"), "stroke-width": 6 }, svg);
      el("text", { x, y: y + 9, "text-anchor": "middle", "font-size": 26, "font-weight": 700, fill: o.nodeText ?? T("on-dark"), "font-family": font("num") }, svg, String(i + 1));
      return [x, y];
    });
  }

  /* ---------- 手绘数据：给轻松场景用的图表 ----------
   * 抖动描边 + 斜线排线填充，像用笔画的。数值仍按比例画，不失真。 */

  // 把折线按 step 细分并加抖动，返回 path d
  function wobbly(pts, r, amp = 1.6, step = 14, close = false) {
    const seq = close ? [...pts, pts[0]] : pts; let d = "";
    for (let i = 0; i < seq.length - 1; i++) {
      const [x1, y1] = seq[i], [x2, y2] = seq[i + 1], n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const t = k / n, j = k == 0 || k == n ? 0 : 1;
        const x = x1 + (x2 - x1) * t + (r() - 0.5) * amp * 2 * j, y = y1 + (y2 - y1) * t + (r() - 0.5) * amp * 2 * j;
        d += (d ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      }
    }
    return d + (close ? "Z" : "");
  }
  // 斜线排线图案
  function hatch(svg, color, id, gap = 9, w = 3.2) {
    let defs = svg.querySelector("defs") || el("defs", {}, svg);
    const p = el("pattern", { id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: "rotate(40)" }, defs);
    el("rect", { width: gap, height: gap, fill: color, opacity: 0.22 }, p);
    el("line", { x1: 0, y1: 0, x2: 0, y2: gap, stroke: color, "stroke-width": w }, p);
    return `url(#${id})`;
  }

  // 手绘柱状图：data {cats:[], v:[], unit}，opts {x,y,w,h,max,hl:下标}
  function sketchBars(svg, data, o = {}) {
    const r = rng(o.seed ?? 71), F = font("hand"), N = font("num"), ink = T("ink");
    const x0 = o.x ?? 80, y0 = o.y ?? 40, W = o.w ?? 800, H = o.h ?? 500, n = data.v.length, max = o.max ?? Math.max(...data.v) * 1.15;
    const base = y0 + H, cols = o.colors ?? list("confetti"), id = svg.id || "sb";
    el("path", { d: wobbly([[x0, y0 - 10], [x0, base], [x0 + W, base]], r, 1.2), fill: "none", stroke: ink, "stroke-width": 3, "stroke-linecap": "round" }, svg);
    const gw = W / n, bw = gw * 0.52;
    data.v.forEach((v, i) => {
      const c = cols[i % cols.length], bh = (H * v) / max, x = x0 + gw * i + (gw - bw) / 2, y = base - bh;
      el("path", { d: wobbly([[x, base], [x, y], [x + bw, y], [x + bw, base]], r, 1.4, 14, true), fill: hatch(svg, c, `${id}h${i}`), stroke: ink, "stroke-width": 3, "stroke-linejoin": "round" }, svg);
      el("text", { x: x + bw / 2, y: y - 16, "text-anchor": "middle", "font-size": i == o.hl ? 50 : 40, "font-weight": 700, fill: i == o.hl ? T("accent-ink") : ink, "font-family": N }, svg, v);
      el("text", { x: x + bw / 2, y: base + 46, "text-anchor": "middle", "font-size": 30, fill: T("ink-2"), "font-family": F }, svg, data.cats[i]);
    });
  }

  // 手绘饼图：data {items:[[名称, 值]]}，opts {cx,cy,r}；返回每块的标签锚点
  function sketchPie(svg, data, o = {}) {
    const r = rng(o.seed ?? 81), ink = T("ink"), cx = o.cx ?? 300, cy = o.cy ?? 300, R = o.r ?? 200, cols = o.colors ?? list("confetti"), id = svg.id || "sp";
    const total = data.items.reduce((s, [, v]) => s + v, 0); let a0 = -Math.PI / 2; const anchors = [];
    data.items.forEach(([name, v], i) => {
      const a1 = a0 + (v / total) * Math.PI * 2, pts = [[cx, cy]];
      for (let k = 0; k <= 40; k++) { const a = a0 + ((a1 - a0) * k) / 40; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
      el("path", { d: wobbly(pts, r, 1.3, 16, true), fill: hatch(svg, cols[i % cols.length], `${id}p${i}`), stroke: ink, "stroke-width": 3, "stroke-linejoin": "round" }, svg);
      const am = (a0 + a1) / 2; anchors.push([cx + Math.cos(am) * R * 1.32, cy + Math.sin(am) * R * 1.32, am]); a0 = a1;
    });
    return anchors;
  }

  // 奖章花结：锯齿外圈 + 内圈 + 两条飘带；返回中心点
  function rosette(svg, _d, o = {}) {
    const cx = o.cx, cy = o.cy, R = o.r ?? 100, c = o.fill ?? T("accent"), ink = T("ink"), sw = o.strokeWidth ?? 0;
    const tail = (dx) => el("path", { d: `M${cx + dx - 26} ${cy + R * 0.5} L${cx + dx + 26} ${cy + R * 0.5} L${cx + dx + 30 + dx * 0.4} ${cy + R * 1.65} L${cx + dx + dx * 0.4} ${cy + R * 1.45} L${cx + dx - 30 + dx * 0.4} ${cy + R * 1.65}Z`, fill: c, stroke: sw ? ink : "none", "stroke-width": sw, opacity: 0.85 }, svg);
    tail(-R * 0.32); tail(R * 0.32);
    starburst(svg, null, { cx, cy, r: R, spikes: 22, inner: 0.9, fill: c, stroke: sw ? ink : "none", strokeWidth: sw });
    el("circle", { cx, cy, r: R * 0.74, fill: o.inner ?? T("surface"), stroke: c, "stroke-width": 4 }, svg);
    el("circle", { cx, cy, r: R * 0.64, fill: "none", stroke: c, "stroke-width": 2, "stroke-dasharray": "5 6" }, svg);
    return [cx, cy];
  }

  // 晾衣绳：两端固定、中间下垂的绳子；返回 y(x)，方便把照片挂上去
  function rope(svg, _d, o = {}) {
    const x0 = o.x0 ?? 0, x1 = o.x1 ?? 1920, y = o.y ?? 220, sag = o.sag ?? 80;
    const Y = (x) => { const t = (x - x0) / (x1 - x0); return y + sag * 4 * t * (1 - t); };
    let d = ""; for (let x = x0; x <= x1; x += 20) d += (d ? "L" : "M") + x + " " + Y(x).toFixed(1);
    el("path", { d, fill: "none", stroke: o.stroke ?? T("ink-2"), "stroke-width": o.width ?? 3, "stroke-dasharray": o.dash ?? "", "stroke-linecap": "round" }, svg);
    return Y;
  }

  /* ---------- 贝塞尔：钢笔工具模型 ----------
   * 锚点写法和矢量软件一致：{x, y, a: 切线角度（度，SVG 坐标，向下为正）, i: 入柄长, o: 出柄长}。
   * 同一锚点两个柄共线（平滑点）；i ≠ o 就是「不对称张力」：一边舒展、一边收紧。
   * 页边锚点用 a:0，相邻两页在同一高度进出，整套 deck 就是一根连续的线。 */

  const rad = (a) => (a * Math.PI) / 180;
  function bzSegs(anchors) {
    const s = [];
    for (let k = 0; k < anchors.length - 1; k++) {
      const A = anchors[k], B = anchors[k + 1], ca = Math.cos(rad(A.a ?? 0)), sa = Math.sin(rad(A.a ?? 0)), cb = Math.cos(rad(B.a ?? 0)), sb = Math.sin(rad(B.a ?? 0));
      s.push([[A.x, A.y], [A.x + ca * (A.o ?? 0), A.y + sa * (A.o ?? 0)], [B.x - cb * (B.i ?? 0), B.y - sb * (B.i ?? 0)], [B.x, B.y]]);
    }
    return s;
  }
  const f1 = (v) => v.toFixed(1);
  function bzD(segs) {
    return segs.map((g, k) => (k ? "" : `M${f1(g[0][0])} ${f1(g[0][1])}`) + ` C${f1(g[1][0])} ${f1(g[1][1])} ${f1(g[2][0])} ${f1(g[2][1])} ${f1(g[3][0])} ${f1(g[3][1])}`).join("");
  }
  function bzAt(g, t) {
    const u = 1 - t, b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((j) => b[0] * g[0][j] + b[1] * g[1][j] + b[2] * g[2][j] + b[3] * g[3][j]);
  }
  function bzTan(g, t) {
    const u = 1 - t;
    return [0, 1].map((j) => 3 * u * u * (g[1][j] - g[0][j]) + 6 * u * t * (g[2][j] - g[1][j]) + 3 * t * t * (g[3][j] - g[2][j]));
  }
  function bzSample(segs, n = 80) {
    const out = [];
    segs.forEach((g, k) => { for (let i = k ? 1 : 0; i <= n; i++) { const t = i / n, [x, y] = bzAt(g, t), [dx, dy] = bzTan(g, t); out.push({ x, y, a: Math.atan2(dy, dx) }); } });
    return out;
  }
  // 数据点 → 锚点，单调三次插值（Fritsch–Carlson）：曲线经过每个数据点，且不会冲出数据范围
  function monotoneAnchors(pts) {
    const n = pts.length, d = [], m = [];
    for (let k = 0; k < n - 1; k++) d.push((pts[k + 1][1] - pts[k][1]) / (pts[k + 1][0] - pts[k][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n - 1; k++) {
      if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
      const a = m[k] / d[k], b = m[k + 1] / d[k], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
    }
    return pts.map(([x, y], k) => {
      const hi = k ? (x - pts[k - 1][0]) / 3 : 0, ho = k < n - 1 ? (pts[k + 1][0] - x) / 3 : 0, s = Math.hypot(1, m[k]);
      return { x, y, a: (Math.atan(m[k]) * 180) / Math.PI, i: hi * s, o: ho * s };
    });
  }

  // 贯穿线。mode 'line'：等宽细线；'nib'：宽笔尖书法线，宽度随走向变化（像平头笔写出的粗细）。
  // o.field：给一个颜色，就把曲线下方（到 o.fieldTo，默认页底）填成色面，曲线成为分割页面的边界。
  // o.only：'field' 只画色面、'line' 只画线；色面要垫在别的图形下面时分两次调用。
  // 返回 {segs, yAt(x), pts}，方便把 HTML 文字摆在线旁边。
  function bezierThread(svg, data, o = {}) {
    const segs = bzSegs(data.anchors), pts = bzSample(segs, o.samples ?? 90), d = bzD(segs);
    if (o.field && o.only !== "line") el("path", { d: d + ` L${f1(pts.at(-1).x)} ${o.fieldTo ?? 1080} L${f1(pts[0].x)} ${o.fieldTo ?? 1080}Z`, fill: o.field, "fill-rule": "nonzero" }, svg);
    if (o.only === "field") { /* 只画色面：色面要压在其他图形下面时，分两次调用 */ }
    else if ((o.mode ?? "line") === "nib") {
      const lo = o.min ?? 3, hi = o.max ?? 18, phi = rad(o.angle ?? 40), L = [], R = [];
      pts.forEach((p) => {
        const w = (lo + (hi - lo) * Math.abs(Math.sin(p.a - phi))) / 2, nx = -Math.sin(p.a), ny = Math.cos(p.a);
        L.push(`${f1(p.x + nx * w)} ${f1(p.y + ny * w)}`); R.unshift(`${f1(p.x - nx * w)} ${f1(p.y - ny * w)}`);
      });
      el("path", { d: "M" + L.join(" L") + " L" + R.join(" L") + "Z", fill: o.stroke ?? T("ink") }, svg);
    } else {
      el("path", { d, fill: "none", stroke: o.stroke ?? T("ink"), "stroke-width": o.width ?? 2.5, "stroke-linecap": "round", "stroke-dasharray": o.dash ?? "" }, svg);
    }
    const yAt = (x) => { for (let k = 1; k < pts.length; k++) if ((pts[k - 1].x - x) * (pts[k].x - x) <= 0) { const t = (x - pts[k - 1].x) / (pts[k].x - pts[k - 1].x || 1); return pts[k - 1].y + t * (pts[k].y - pts[k - 1].y); } return null; };
    return { segs, pts, yAt };
  }

  // 锚点与控制柄：把曲线的「构造」画出来，钢笔工具的视觉母题。which：要显示的锚点序号
  // o.shape 'square'（选中的锚点）| 'dot'；o.handles=false 只画锚点
  function bezierHandles(svg, data, o = {}) {
    const c = o.color ?? T("accent"), s = o.size ?? 14, bg = o.fill ?? T("surface");
    (data.which ?? data.anchors.map((_, k) => k)).forEach((k) => {
      const A = data.anchors[k], ca = Math.cos(rad(A.a ?? 0)), sa = Math.sin(rad(A.a ?? 0));
      if (o.handles !== false) [[-(A.i ?? 0)], [A.o ?? 0]].forEach(([len]) => {
        if (!len) return;
        const hx = A.x + ca * len, hy = A.y + sa * len;
        el("line", { x1: A.x, y1: A.y, x2: hx, y2: hy, stroke: c, "stroke-width": o.handleWidth ?? 1.5 }, svg);
        el("circle", { cx: hx, cy: hy, r: o.knob ?? 6, fill: c }, svg);
      });
      if ((o.shape ?? "square") === "square") el("rect", { x: A.x - s / 2, y: A.y - s / 2, width: s, height: s, fill: bg, stroke: c, "stroke-width": 2 }, svg);
      else el("circle", { cx: A.x, cy: A.y, r: s / 2, fill: c, stroke: bg, "stroke-width": o.ring ?? 4 }, svg);
    });
  }

  // 流向图（桑基）：左右两列节点，连接带是两端水平的三次贝塞尔，带宽按数值。
  // data {left:[{v}], right:[{v}], links:[{s, t, v, hi}]}；返回各节点和连接带的坐标，文字由页面用 HTML 放
  function flowRibbons(svg, data, o = {}) {
    const x0 = o.x0 ?? 500, x1 = o.x1 ?? 1400, y0 = o.y0 ?? 240, y1 = o.y1 ?? 900, gap = o.gap ?? 26, bar = o.bar ?? 8;
    const tot = data.left.reduce((a, n) => a + n.v, 0), k = (y1 - y0 - gap * (Math.max(data.left.length, data.right.length) - 1)) / tot;
    const place = (col) => { let y = y0; return col.map((n) => { const r = { y0: y, y1: y + n.v * k }; y = r.y1 + gap; return r; }); };
    const L = place(data.left), R = place(data.right), curL = L.map((r) => r.y0), curR = R.map((r) => r.y0);
    const links = data.links.map((l, idx) => ({ ...l, idx })).sort((a, b) => a.s - b.s || a.t - b.t);
    links.forEach((l) => { l.ys = curL[l.s]; curL[l.s] += l.v * k; });
    // 目标端按来源排序，但被强调的流排在最后（节点最下方），让它尽量走一条完整的 S 形
    [...links].sort((a, b) => a.t - b.t || (a.hi ? 1 : 0) - (b.hi ? 1 : 0) || a.s - b.s).forEach((l) => { l.yt = curR[l.t]; curR[l.t] += l.v * k; });
    const xa = x0 + bar, xb = x1, xm = (xa + xb) / 2;
    [...links].sort((a, b) => (a.hi ? 1 : 0) - (b.hi ? 1 : 0)).forEach((l) => {
      const h = l.v * k;
      el("path", { d: `M${xa} ${f1(l.ys)} C${xm} ${f1(l.ys)} ${xm} ${f1(l.yt)} ${xb} ${f1(l.yt)} L${xb} ${f1(l.yt + h)} C${xm} ${f1(l.yt + h)} ${xm} ${f1(l.ys + h)} ${xa} ${f1(l.ys + h)}Z`,
        fill: l.hi ? (o.hiFill ?? T("accent")) : (o.fill ?? T("line-soft")), "fill-opacity": l.hi ? (o.hiOpacity ?? 1) : (o.opacity ?? 1),
        stroke: o.stroke ?? "none", "stroke-width": o.strokeWidth ?? 1, "stroke-opacity": o.strokeOpacity ?? 1 }, svg);
      l.h = h;
    });
    [[L, x0], [R, x1]].forEach(([col, x]) => col.forEach((r) => el("rect", { x, y: r.y0, width: bar, height: r.y1 - r.y0, fill: o.barFill ?? T("ink") }, svg)));
    return { left: L, right: R, links, xa, xb };
  }

  global.Shapes = { el, T, font, alpha, rng, dataRain, meshWave, hexGrid, isoStack, chevronFlow, ringGauges, groupedBars, radar,
    blob, squiggle, scribbleCircle, confetti, halftone, starburst, windingPath, sketchBars, sketchPie, rosette, rope,
    bzSegs, bzD, bzAt, bzTan, bzSample, monotoneAnchors, bezierThread, bezierHandles, flowRibbons };
})(window);
