"""deck.html -> PPTX：分层截图 + PowerPoint 原生动画 / 切换。

用法:
  uv run --with playwright --with python-pptx --with pillow python export_pptx.py \
      deck.html out/deck.pptx [--theme 名] [--scale 2] [--transition fade] [--transition-dur 0.6]

原理：浏览器负责排版和画面，这个脚本只负责拆层。
  - 底图：把所有带标注的元素藏起来（保留布局），截整页。纹理、滤镜、混合模式都烤在底图里。
  - 图层：每个带标注的元素单独截一张透明 PNG（完全不透明的存 JPEG），按原坐标放回去。
  - 动画和切换写成 PowerPoint 原生 XML（vendor/ppt_master，MIT）。
文字不可编辑（它在图片里），要改就改 HTML 再导出。换来的是：观感和 PNG/PDF 完全一致，换电脑不丢字体。

HTML 标注（全部可选，不加就是一页静态图）：
  <section class="slide" data-transition="morph" data-transition-dur="1">   页面切换，默认 --transition
  <div data-anim="fade">                    进入动画。fade wipe fly zoom rise float split stretch appear …
                                            也可写完整名 entrance_* / emphasis_* / exit_*（见 --list）
      data-dir="right"                      方向（wipe/fly/zoom/split/stretch 等有方向的效果）
      data-step="1"                         第几次单击出现；0 = 切到这页后自动播放。不写时沿用上一个元素的 step（第一个默认 0）
      data-with                             和上一个动画同时开始（默认是上一个播完再开始）
      data-delay="200"                      延迟毫秒
      data-dur="0.6"                        时长秒，默认 0.5
  <div data-morph="flag">                   单独成层，命名为 !!flag；相邻两页同名的层在 morph 切换时会平滑过渡
  <aside class="notes">讲稿</aside>          写进备注页，导出和截图时都隐藏

几个元素一起出场：用 <div class="grp" data-anim=…> 包起来（lib/base.css），别用普通 div。详见 guide/animation.md。

图层规则：
  - 标注元素和它的全部子元素是一层；嵌套的标注元素各自成层，从父层里扣掉。
  - 图层永远在底图上面。如果一个静态元素在 HTML 里盖在标注元素上面，导出后它会被压到图层下面，脚本会报警告。
    这种情况把那个静态元素也加上 data-anim（或 data-morph）就行。
"""
from __future__ import annotations

import argparse
import io
import pathlib
import re
import shutil
import sys
import tempfile
import zipfile

from PIL import Image
from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.util import Emu

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor" / "ppt_master"))
import pptx_animations as PA  # noqa: E402
import pptx_transitions as PT  # noqa: E402

W, H = 1920, 1080
SLIDE_W, SLIDE_H = 12192000, 6858000  # 16:9，13.333 x 7.5 in
EMU = SLIDE_W / W

SHORT = {  # 常用短名 -> PowerPoint 规范名
    "fade": "entrance_fade", "wipe": "entrance_wipe", "fly": "entrance_fly", "zoom": "entrance_zoom",
    "rise": "entrance_rise_up", "float": "entrance_float", "split": "entrance_split",
    "stretch": "entrance_stretch", "appear": "entrance_appear", "grow": "entrance_grow_and_turn",
    "faded-zoom": "entrance_faded_zoom", "ease-in": "entrance_ease_in", "unfold": "entrance_unfold",
    "pulse": "emphasis_pulse", "out": "exit_fade",
}

CSS = """
html,body{margin:0 !important;background:transparent !important}
.slide{margin:0 !important}
.notes{display:none !important}
.x-off{display:none !important}
.x-hide{opacity:0 !important}
html.x-iso .x-cur, html.x-iso .x-cur *{visibility:hidden !important}
html.x-iso .x-cur .x-target, html.x-iso .x-cur .x-target *{visibility:visible !important}
"""

# 图层的实际范围 = 真正画出东西的部分的并集：文字（用 Range 量，溢出盒子的也算）、svg、img、
# 有背景/边框/阴影的盒子、伪元素所在的盒子。分组用的透明包装盒（比如铺满页面的 .grp）自己不算。
HELPERS = """
window.xBox = (e) => {
  const rects = [];
  const paints = n => { const s = getComputedStyle(n);
    return s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || s.borderStyle !== 'none'
      || s.boxShadow !== 'none' || s.outlineStyle !== 'none'
      || ['::before', '::after'].some(p => { const q = getComputedStyle(n, p); return q.content !== 'none' && q.content !== 'normal'; }); };
  for (const n of [e, ...e.querySelectorAll('*')]) {
    if (n.closest('svg') && n.tagName !== 'svg') continue;
    if (n.tagName === 'svg' || n.tagName === 'IMG' || paints(n)) rects.push(n.getBoundingClientRect());
    for (const t of n.childNodes) if (t.nodeType === 3 && t.textContent.trim()) {
      const r = document.createRange(); r.selectNodeContents(t); rects.push(r.getBoundingClientRect());
    }
  }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of rects) {
    if (r.width < 0.5 && r.height < 0.5) continue;
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  return x0 > x1 ? [0, 0, 0, 0] : [x0, y0, x1, y1];
};
"""

# 收集一页里的图层：返回 [{idx, anim, morph, step, with, delay, dur, dir, name, rect}]
COLLECT = """
(slide) => {
  const els = [...slide.querySelectorAll('[data-anim],[data-morph]')];
  const sr = slide.getBoundingClientRect();
  let step = 0;
  return els.map((e, i) => {
    e.dataset.xLayer = i;
    const d = e.dataset;
    if (d.step !== undefined && d.step !== '') step = +d.step;
    const [x0, y0, x1, y1] = xBox(e);
    return {idx: i, anim: d.anim || null, morph: d.morph || null, step, with: d.with !== undefined,
      delay: +(d.delay || 0), dur: d.dur ? +d.dur : null, dir: d.dir || null,
      name: e.id || d.morph || (d.anim ? `${d.anim}-${i + 1}` : `layer-${i + 1}`),
      rect: [x0 - sr.left, y0 - sr.top, x1 - sr.left, y1 - sr.top],
      tag: (e.textContent || e.tagName).trim().slice(0, 16)};
  });
}
"""

# 静态元素压在图层上面的情况（导出后会被图层盖住）
OVERLAP = """
(slide) => {
  const layers = [...slide.querySelectorAll('[data-x-layer]')];
  const inLayer = n => n.closest('[data-x-layer]');
  const all = [...slide.querySelectorAll('*')];
  const out = [];
  layers.forEach(L => {
    const [l0, t0, r0, b0] = xBox(L), lr = {left: l0, top: t0, right: r0, bottom: b0};
    if (r0 - l0 < 1) return;
    const after = all.filter(n => !inLayer(n) && (L.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !n.contains(L) && (n.children.length === 0 || n.tagName === 'svg' || n.tagName === 'IMG'));
    const hits = after.filter(n => {
      const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
      if (n.closest('svg') && n.tagName !== 'svg') return false;
      return r.left < lr.right && r.right > lr.left && r.top < lr.bottom && r.bottom > lr.top;
    });
    if (hits.length) out.push(`${L.dataset.morph || L.dataset.anim}「${(L.textContent||'').trim().slice(0,12)}」被 ${hits.length} 个静态元素压着，如「${(hits[0].textContent||hits[0].tagName).trim().slice(0,12)}」`);
  });
  return out;
}
"""


def effect_name(raw: str) -> str:
    return PA.normalize_animation_effect(SHORT.get(raw, raw), allow_none=False, allow_modes=False)


def save_img(img: Image.Image, base: pathlib.Path) -> pathlib.Path:
    """完全不透明存 JPEG，否则 PNG。"""
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] == 255:
        img = img.convert("RGB")
    if img.mode == "RGB":
        p = base.with_suffix(".jpg"); img.save(p, quality=90, optimize=True)
    else:
        p = base.with_suffix(".png"); img.save(p, optimize=True)
    return p


def capture(src: pathlib.Path, work: pathlib.Path, theme: str, scale: float):
    slides, warns = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=scale)
        pg.on("pageerror", lambda e: warns.append(f"JS 异常: {e}"))
        pg.goto(src.as_uri() + (f"?theme={theme}" if theme else ""))
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(500)
        # 讲稿要在隐藏前取
        notes = pg.eval_on_selector_all(".slide", "els => els.map(s => [...s.querySelectorAll('.notes')].map(n => n.innerText.trim()).join('\\n\\n'))")
        ids = pg.eval_on_selector_all(".slide", "els => els.map(e => e.id)")
        attrs = pg.eval_on_selector_all(".slide", "els => els.map(e => [e.dataset.transition || null, e.dataset.transitionDur ? +e.dataset.transitionDur : null])")
        pg.add_style_tag(content=CSS)
        pg.evaluate("() => {" + HELPERS + "}")
        for si, sid in enumerate(ids):
            pg.evaluate("i => document.querySelectorAll('.slide').forEach((s, k) => s.classList.toggle('x-off', k !== i))", si)
            pg.evaluate("() => window.scrollTo(0, 0)")
            slide = pg.locator(".slide:not(.x-off)")
            layers = slide.evaluate(COLLECT)
            warns += [f"{sid}: {w}" for w in slide.evaluate(OVERLAP)]
            # 底图：藏起所有图层
            slide.evaluate("s => s.querySelectorAll('[data-x-layer]').forEach(e => e.classList.add('x-hide'))")
            bg = work / f"{sid}-bg.jpg"
            Image.open(io.BytesIO(slide.screenshot())).convert("RGB").save(bg, quality=90, optimize=True)
            # 逐层：只显示这一层（嵌套的子图层扣掉）
            pg.evaluate("() => document.documentElement.classList.add('x-iso')")
            slide.evaluate("s => s.classList.add('x-cur')")
            out_layers = []
            for L in layers:
                sel = f'[data-x-layer="{L["idx"]}"]'
                slide.evaluate("""(s, sel) => { const t = s.querySelector(sel);
                    t.classList.remove('x-hide'); t.classList.add('x-target');
                    t.querySelectorAll('[data-x-layer]').forEach(c => c.classList.add('x-hide')); }""", sel)
                pad = 48
                x0, y0, x1, y1 = L["rect"]
                x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
                x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
                if x1 - x0 < 1 or y1 - y0 < 1:
                    warns.append(f"{sid}: 图层「{L['name']}」在页面外，跳过")
                else:
                    raw = pg.screenshot(clip={"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}, omit_background=True)
                    img = Image.open(io.BytesIO(raw)).convert("RGBA")
                    bbox = img.getchannel("A").getbbox()
                    if not bbox:
                        warns.append(f"{sid}: 图层「{L['name']}」截出来是空的，跳过")
                    else:
                        img = img.crop(bbox)
                        path = save_img(img, work / f"{sid}-L{L['idx']:02d}")
                        L["box"] = [x0 + bbox[0] / scale, y0 + bbox[1] / scale, (bbox[2] - bbox[0]) / scale, (bbox[3] - bbox[1]) / scale]
                        L["file"] = path
                        out_layers.append(L)
                slide.evaluate("""(s, sel) => { const t = s.querySelector(sel);
                    t.classList.remove('x-target'); t.classList.add('x-hide');
                    t.querySelectorAll('[data-x-layer]').forEach(c => c.classList.add('x-hide')); }""", sel)
            pg.evaluate("() => document.documentElement.classList.remove('x-iso')")
            slide.evaluate("""s => { s.classList.remove('x-cur');
                s.querySelectorAll('[data-x-layer]').forEach(e => { e.classList.remove('x-hide'); delete e.dataset.xLayer; }); }""")
            slides.append({"id": sid, "bg": bg, "layers": out_layers, "notes": notes[si],
                           "transition": attrs[si][0], "transition_dur": attrs[si][1]})
        b.close()
    return slides, warns


def build(slides, out: pathlib.Path, default_tr: str, default_tr_dur: float):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(SLIDE_W), Emu(SLIDE_H)
    blank = prs.slide_layouts[6]
    extras = []  # 每页 (transition_xml, timing_xml)
    for s in slides:
        sl = prs.slides.add_slide(blank)
        bg = sl.shapes.add_picture(str(s["bg"]), 0, 0, Emu(SLIDE_W), Emu(SLIDE_H))
        bg.name = "底图"
        targets, step_seen = [], set()
        for L in s["layers"]:
            x, y, w, h = L["box"]
            pic = sl.shapes.add_picture(str(L["file"]), Emu(round(x * EMU)), Emu(round(y * EMU)),
                                        Emu(round(w * EMU)), Emu(round(h * EMU)))
            pic.name = f"!!{L['morph']}" if L["morph"] else L["name"]
            if not L["anim"]:
                continue
            first_in_step = L["step"] not in step_seen
            step_seen.add(L["step"])
            if first_in_step:
                trigger = "after-previous" if L["step"] == 0 else "on-click"
            else:
                trigger = "with-previous" if L["with"] else "after-previous"
            t = {"shape_id": pic.shape_id, "delay_ms": int(L["delay"]), "effect": effect_name(L["anim"]),
                 "trigger": trigger}
            if L["dur"]:
                t["duration"] = L["dur"]
            if L["dir"]:
                t["effect_options"] = {"direction": L["dir"]}
            targets.append((L["step"], len(targets), t))
        if s["notes"]:
            sl.notes_slide.notes_text_frame.text = s["notes"]
        targets.sort(key=lambda r: (r[0], r[1]))
        timing = PA.create_sequence_timing_xml([t for _, _, t in targets], duration=0.5) if targets else ""
        tr = s["transition"] or default_tr
        transition = "" if tr == "none" else PT.create_transition_xml(tr, s["transition_dur"] or default_tr_dur)
        extras.append((transition, timing))
    tmp = out.with_suffix(".tmp.pptx")
    prs.save(tmp)
    # 把切换和时间轴插进每页 XML（顺序：cSld, clrMapOvr, transition, timing）
    with zipfile.ZipFile(tmp) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", item.filename)
            if m:
                transition, timing = extras[int(m.group(1)) - 1]
                xml = data.decode("utf-8")
                if transition:
                    xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + transition, 1)
                if timing:
                    xml = xml.replace("</p:sld>", timing + "</p:sld>", 1)
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    tmp.unlink()
    PA.validate_pptx_animation_package(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", nargs="?", default="deck.html")
    ap.add_argument("out", nargs="?", default="out/deck.pptx")
    ap.add_argument("--theme", default="")
    ap.add_argument("--scale", type=float, default=2, help="截图倍率，默认 2（4K 投影也清楚）")
    ap.add_argument("--transition", default="fade", help="默认页面切换，none 关闭")
    ap.add_argument("--transition-dur", type=float, default=0.6)
    ap.add_argument("--keep", action="store_true", help="保留中间图片（out 旁边的 _layers/）")
    ap.add_argument("--list", action="store_true", help="列出全部动画和切换名")
    a = ap.parse_args()
    if a.list:
        print("短名：", ", ".join(f"{k}={v}" for k, v in SHORT.items()))
        print("动画：", ", ".join(PA.get_available_animations()))
        print("切换：", ", ".join(PA.get_available_transitions()))
        return
    src, out = pathlib.Path(a.src).resolve(), pathlib.Path(a.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    work = out.parent / "_layers" if a.keep else pathlib.Path(tempfile.mkdtemp(prefix="scene-pptx-"))
    work.mkdir(exist_ok=True)
    slides, warns = capture(src, work, a.theme, a.scale)
    build(slides, out, a.transition, a.transition_dur)
    if not a.keep:
        shutil.rmtree(work, ignore_errors=True)
    n_layers = sum(len(s["layers"]) for s in slides)
    n_anim = sum(1 for s in slides for L in s["layers"] if L["anim"])
    print(f"{len(slides)} 页，{n_layers} 个图层，{n_anim} 个动画 -> {out}（{out.stat().st_size / 1e6:.1f} MB）")
    print("检查：" + ("通过" if not warns else "\n  " + "\n  ".join(warns)))


if __name__ == "__main__":
    main()
