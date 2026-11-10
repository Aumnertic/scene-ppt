"""deck.html -> 每页 PNG + 矢量 PDF + 溢出检查.

用法: uv run --with playwright python render.py [deck.html] [out_dir] [theme]
- theme：可选，分支内的主题名，会以 ?theme=<名> 传给页面（页面据此设置 <html data-theme>）。
使用本机 Google Chrome（channel="chrome"），不下载浏览器。
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "deck.html").resolve()
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "out").resolve()
theme = sys.argv[3] if len(sys.argv) > 3 else ""
out.mkdir(parents=True, exist_ok=True)

CHECK = """
() => {
  const bad = [];
  document.querySelectorAll('.slide').forEach(s => {
    const sr = s.getBoundingClientRect();
    s.querySelectorAll('.fit').forEach(e => {
      const over = e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2;
      const r = e.getBoundingClientRect();
      const out = r.right > sr.right + 1 || r.bottom > sr.bottom + 1 || r.left < sr.left - 1;
      if (over || out) bad.push(`${s.id}: ${over ? '内容溢出' : ''}${out ? '超出页面' : ''} -> ${e.textContent.trim().slice(0, 24)}`);
    });
    const txt = s.innerText;
    if (/…|\\.\\.\\.|等等$/.test(txt)) bad.push(`${s.id}: 出现省略号截断`);
  });
  return bad;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    errors = []
    pg.on("pageerror", lambda e: errors.append(f"JS 异常: {e}"))
    pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    pg.goto(src.as_uri() + (f"?theme={theme}" if theme else ""))
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(400)
    ids = pg.eval_on_selector_all(".slide", "els => els.map(e => e.id)")
    for i in ids:
        pg.locator(f"#{i}").screenshot(path=str(out / f"{i}.png"))
    issues = errors + pg.evaluate(CHECK)
    # PDF：每页一张 1920x1080
    pg.add_style_tag(content="@page{size:1920px 1080px;margin:0} body{background:none} .slide{margin:0;page-break-after:always}")
    pg.pdf(path=str(out / "deck.pdf"), width="1920px", height="1080px", print_background=True)
    b.close()

print(f"{len(ids)} 页 -> {out}")
print("检查：" + ("通过" if not issues else "\n  " + "\n  ".join(issues)))
