"""查 Chrome 实际用上了哪个字体（CDP 的 CSS.getPlatformFontsForNode）。

用法: uv run --with playwright python fontcheck.py "字体名:粗细" ...
例:   uv run --with playwright python fontcheck.py "STSongti-SC-Black:400" "Lantinghei SC:800"
输出每个字体实际命中的族名和 PostScript 名。命中 PingFang 或 Courier 说明回落了，没用上。
"""
import sys
from playwright.sync_api import sync_playwright
fams = [(a.rsplit(':',1)[0], int(a.rsplit(':',1)[1]) if ':' in a else 400) for a in sys.argv[1:]]
html = "".join(f'<p id="f{i}" style="font-family:\'{f}\',monospace;font-weight:{w}">汉字测试 Abc 123</p>' for i,(f,w) in enumerate(fams))
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome"); pg = b.new_page(); pg.set_content(html)
    cdp = pg.context.new_cdp_session(pg); cdp.send("DOM.enable"); cdp.send("CSS.enable")
    root = cdp.send("DOM.getDocument")["root"]["nodeId"]
    for i,(f,w) in enumerate(fams):
        nid = cdp.send("DOM.querySelector", {"nodeId": root, "selector": f"#f{i}"})["nodeId"]
        fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]
        print(f"{f:14} {w}: " + ", ".join(f"{x['familyName']}({x.get('postScriptName','')})" for x in fonts))
    b.close()
