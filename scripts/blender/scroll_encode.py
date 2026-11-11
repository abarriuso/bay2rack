"""Frames from scroll.py -> the scroll film of the site (docs/scroll/).

  python scripts/blender/scroll_encode.py

For each theme (dark, light): <theme>/1600/NNN.webp with every frame, and <theme>/960/NNN.webp with every second
one for phones; film.json says how many frames there are, in which sizes, and which frames each text of the page
belongs to (the beats of scroll.py, without their draft texts: the page has its own, in both languages).
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "docs" / "blender" / "scroll"
OUT = ROOT / "docs" / "scroll"
# (folder, width, height, every nth frame, WebP quality): the first is for wide screens, the last for phones
SIZES = [("1600", 1600, 900, 1, 76), ("960", 960, 540, 2, 70)]
THEMES = {"dark": "frames", "light": "frames_light"}


def main():
    beats = json.loads((SRC / "beats.json").read_text(encoding="utf-8"))
    total = 0
    for theme, folder in THEMES.items():
        frames = sorted((SRC / folder).glob("f_*.png"))
        if len(frames) != beats["frames"]:
            sys.exit(f"{folder}: {len(frames)} frames, the film has {beats['frames']} - render it first (scroll.py --render)")
        for name, w, h, step, quality in SIZES:
            out = OUT / theme / name
            out.mkdir(parents=True, exist_ok=True)
            for old in out.glob("*.webp"):
                old.unlink()
            for i, f in enumerate(frames[::step]):
                im = Image.open(f).convert("RGB")
                if im.size != (w, h):
                    im = im.resize((w, h), Image.LANCZOS)
                im.save(out / f"{i + 1:03d}.webp", quality=quality, method=6)
            size = sum(p.stat().st_size for p in out.glob("*.webp"))
            total += size
            print(f"{theme}/{name}: {len(frames[::step])} frames, {size / 1e6:.1f} MB")
    meta = {"frames": beats["frames"],
            "sizes": [{"dir": name, "w": w, "h": h, "step": step} for name, w, h, step, _ in SIZES],
            "beats": [{k: b[k] for k in ("from", "to", "key", "side", "subject")} for b in beats["beats"]]}
    (OUT / "film.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"docs/scroll: {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
