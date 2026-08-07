"""
Extension icons, downsampled from the PWA's existing 512px master icon
(../../webapp/icons/icon-512.png) rather than redrawn — same mark, same
brand, no visual drift between the PWA and the extension.

Chrome/Firefox extension manifests need 16/32/48/128px. Run once (or
whenever webapp/icons/icon-512.png changes); output is committed to
src/icons/ like the PWA commits its own icons/.

    python3 scripts/make_icons.py
"""

from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "..", "..", "webapp", "icons", "icon-512.png")
OUT = os.path.join(HERE, "..", "src", "icons")

SIZES = (16, 32, 48, 128)

os.makedirs(OUT, exist_ok=True)
master = Image.open(SOURCE).convert("RGBA")

for size in SIZES:
    resized = master.resize((size, size), Image.LANCZOS)
    resized.save(os.path.join(OUT, f"icon-{size}.png"))

print("icons written:", sorted(os.listdir(OUT)))
