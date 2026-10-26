"""Renders from gallery.py -> the gallery pictures of the site (docs/gallery/).

  python scripts/blender/gallery_encode.py [router ...]

For each build: <k>.webp (1800x1350), <k>-640.webp (640x480) and <k>-og.jpg (1200x630, for link previews).
The finish is the hero film's, lighter: a soft vignette and a little grain.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "docs", "blender", "gallery")
OUT = os.path.join(REPO, "docs", "gallery")
NAMES = sys.argv[1:] or ["router", "network", "pi", "kvm", "audio", "client", "unifi", "bezel"]


def finish(im):
    w, h = im.size
    # vignette: a blurred ellipse, 18 % darker at the corners
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((-w * 0.15, -h * 0.15, w * 1.15, h * 1.15), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w / 8)).point(lambda v: int(209 + v * 46 / 255))
    im = ImageChops.multiply(im, Image.merge("RGB", [mask] * 3))
    # grain
    noise = Image.effect_noise((w, h), 5).convert("RGB")      # grey 128 +- 5
    return ImageChops.add(im, noise, offset=-128)


for k in NAMES:
    im = finish(Image.open(os.path.join(SRC, k + ".png")).convert("RGB"))
    im.save(os.path.join(OUT, k + ".webp"), quality=82, method=6)
    im.resize((640, 480), Image.LANCZOS).save(os.path.join(OUT, k + "-640.webp"), quality=80, method=6)
    w, h = im.size
    ch = round(w * 630 / 1200)
    top = (h - ch) // 2
    im.crop((0, top, w, top + ch)).resize((1200, 630), Image.LANCZOS).save(os.path.join(OUT, k + "-og.jpg"), quality=84)
    print(k, "ok")
