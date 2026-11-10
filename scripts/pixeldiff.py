"""两个目录里同名 PNG 的逐像素对比，用于回归检查。

用法: uv run --with pillow python pixeldiff.py <基准目录> <新目录>
每张图输出差异区域和差异像素数（任一通道差 > 8 计为不同）。全部为 0 时退出码 0，否则 1。

roadshow-cn 的回归做法：
  1. 用 render.py 渲染冻结的原基准 stages/04-render/exemplar/deck.html → A 目录
  2. 渲染 skill/styles/roadshow-cn/exemplar/deck.html → B 目录
  3. python pixeldiff.py A B
用新渲染做对比，不直接比存档的 PNG，是为了排除 Chrome 版本或字体更新带来的差异。
"""
import sys, pathlib
from PIL import Image, ImageChops

a, b = map(pathlib.Path, sys.argv[1:3])
bad = 0
for pa in sorted(a.glob("*.png")):
    pb = b / pa.name
    if not pb.exists():
        print(f"{pa.name}: 新目录里没有"); bad += 1; continue
    ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    if ia.size != ib.size:
        print(f"{pa.name}: 尺寸不同 {ia.size} vs {ib.size}"); bad += 1; continue
    d = ImageChops.difference(ia, ib)
    n = sum(1 for px in d.get_flattened_data() if max(px) > 8) if hasattr(d, "get_flattened_data") else sum(1 for px in d.getdata() if max(px) > 8)
    print(f"{pa.name}: 差异区域 {d.getbbox()}，差异像素 {n}")
    bad += n > 0
sys.exit(1 if bad else 0)
