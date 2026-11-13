"""The colour along the top edge of each picture of the scroll film -> docs/scroll/edges.json.

  python scripts/blender/scroll_edges.py

Run it after scroll_encode.py. A phone's own bars (the status and address bar above the page) take the colour the
page gives them (theme-color): while the film fills the screen, film.js gives them the colour of the picture's top
edge, read from here (reading it off the canvas as it plays would hold up the frames).
For each theme: "tall", one colour per picture of the upright set (where a phone held upright shows it: its middle
part), and "wide", one per picture of the base set; each colour six hex digits, one after the other.
"""
import json
from pathlib import Path

from PIL import Image, ImageStat

OUT = Path(__file__).resolve().parent.parent.parent / "docs" / "scroll"
# (key, folder, the part of the width seen) - an upright phone shows about the middle 60 % of an upright picture
SETS = [("tall", "tall", (0.22, 0.78)), ("wide", "960", (0.1, 0.9))]
ROWS = 0.012                                              # the top band read: a little over 1 % of the height


def edge(path, span):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    band = im.crop((int(w * span[0]), 0, int(w * span[1]), max(2, round(h * ROWS))))
    r, g, b = ImageStat.Stat(band).mean
    return f"{round(r):02x}{round(g):02x}{round(b):02x}"


def main():
    out = {}
    for theme in ("dark", "light"):
        out[theme] = {}
        for key, folder, span in SETS:
            files = sorted((OUT / theme / folder).glob("*.webp"))
            out[theme][key] = "".join(edge(f, span) for f in files)
            print(theme, key, len(files))
    (OUT / "edges.json").write_text(json.dumps(out), encoding="utf-8")


if __name__ == "__main__":
    main()
