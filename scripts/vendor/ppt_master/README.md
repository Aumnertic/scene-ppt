# Vendored from PPT Master

Source: https://github.com/hugohe3/ppt-master (commit 01fe549, 2026-11-12)
Copyright (c) 2025-2026 Hugo He, MIT License (see LICENSE in this folder).

Files used unchanged:
- `pptx_animations.py`: PowerPoint object-animation registry and `<p:timing>` writer
- `pptx_transitions.py`: slide-transition registry and `<p:transition>` writer (including Morph)
- `pptx_animation_presets.json`: PowerPoint-authored preset rows

Replaced:
- `console_encoding.py`: a stub. The original also runs PPT Master's distribution-integrity guard and workflow transcript recorder, which depend on the rest of the PPT Master skill; here only the UTF-8 stdio setup is kept.

scene-ppt calls these from `scripts/export_pptx.py`. If you need the full SVG→native-shape pipeline, use PPT Master itself.
