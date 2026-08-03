from PIL import Image, ImageDraw, ImageFont
import os

OUT = '/sessions/bold-gallant-maxwell/mnt/outputs/build/icons'
os.makedirs(OUT, exist_ok=True)

BG = (28, 25, 23, 255)      # --text-primary / stone-900, matches existing header logo mark
FG = (255, 255, 255, 255)
TEAL = (13, 148, 136, 255)  # --accent-teal, used as a thin accent ring

FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'

def rounded_square(size, radius_ratio=0.22, bg=BG):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=bg)
    return img, draw

def draw_c(draw, size, scale=0.56, color=FG):
    font = ImageFont.truetype(FONT_PATH, int(size * scale))
    text = "C"
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=color)

# --- Standard icons (192, 512) ---
for size in (192, 512):
    img, draw = rounded_square(size)
    draw_c(draw, size)
    img.save(f'{OUT}/icon-{size}.png')

# --- Maskable icon (512, extra safe-zone padding ~ 20%, background fills full canvas) ---
size = 512
img = Image.new('RGBA', (size, size), BG)
draw = ImageDraw.Draw(img)
draw_c(draw, size, scale=0.42)
img.save(f'{OUT}/icon-maskable-512.png')

# --- Apple touch icon (180, no transparency, iOS applies its own mask) ---
size = 180
img, draw = rounded_square(size, radius_ratio=0.0)
draw_c(draw, size)
img.save(f'{OUT}/apple-touch-icon.png')

# --- Favicon (multi-res .ico) ---
fav_sizes = [16, 32, 48]
fav_imgs = []
for s in fav_sizes:
    im, dr = rounded_square(s, radius_ratio=0.22)
    draw_c(dr, s)
    fav_imgs.append(im)
fav_imgs[0].save(f'{OUT}/favicon.ico', sizes=[(s, s) for s in fav_sizes])

print("icons written:", os.listdir(OUT))
