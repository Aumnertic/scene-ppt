"""Stub replacing PPT Master's console_encoding (vendored subset).

The original also runs PPT Master's distribution-integrity guard and a
workflow transcript recorder, which only make sense inside the full PPT Master
skill. Here we keep just the UTF-8 stdio behaviour.
"""
import sys


def configure_utf8_stdio() -> None:
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError, ValueError):
            pass
