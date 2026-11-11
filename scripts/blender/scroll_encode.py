"""Frames from scroll.py -> the scroll film of the site (docs/scroll/).

  python scripts/blender/scroll_encode.py

For each theme (dark, light): <theme>/1600/NNNN.webp with every frame, and <theme>/960/NNNN.webp with one in four
for phones; film.json says how many frames there are, in which sizes, and which frames each text of the page
belongs to (the beats of scroll.py, without their draft texts: the page has its own, in both languages).
The frames are those of scroll.py --render (f_####.png) with, between each two, the ones of --between
(q_####_k.png) when they are there.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "docs" / "blender" / "scroll"
OUT = ROOT / "docs" / "scroll"
# (folder, width, height, every nth frame, WebP quality): the first is for wide screens, the last for phones
SIZES = [("1600", 1600, 900, 1, 76), ("960", 960, 540, 4, 70)]
THEMES = {"dark": "frames", "light": "frames_light"}


def main():
    beats = json.loads((SRC / "beats.json").read_text(encoding="utf-8"))
    total = 0
    grain = None                                           # frames per frame of the keys (1: no in-between frames)
    for theme, folder in THEMES.items():
        keys = sorted((SRC / folder).glob("f_*.png"))
        if len(keys) != beats["frames"]:
            sys.exit(f"{folder}: {len(keys)} frames, the film has {beats['frames']} - render it first (scroll.py --render)")
        # the in-between frames: all of them (the same number after every frame but the last) or none
        fine = len(list((SRC / folder).glob(f"q_{1:04d}_*.png"))) + 1
        frames = []
        for i, f in enumerate(keys):
            frames.append(f)
            if i < len(keys) - 1:
                mid = [SRC / folder / f"q_{i + 1:04d}_{k}.png" for k in range(1, fine)]
                if not all(m.exists() for m in mid):
                    sys.exit(f"{folder}: the frames between {i + 1} and {i + 2} are missing (scroll.py --between {fine})")
                frames += mid
        if grain not in (None, fine):
            sys.exit("the two themes have a different number of in-between frames")
        grain = fine
        for name, w, h, step, quality in SIZES:
            out = OUT / theme / name
            out.mkdir(parents=True, exist_ok=True)
            for old in out.glob("*.webp"):
                old.unlink()
            for i, f in enumerate(frames[::step]):
                im = Image.open(f).convert("RGB")
                if im.size != (w, h):
                    im = im.resize((w, h), Image.LANCZOS)
                im.save(out / f"{i + 1:04d}.webp", quality=quality, method=6)
            size = sum(p.stat().st_size for p in out.glob("*.webp"))
            total += size
            print(f"{theme}/{name}: {len(frames[::step])} frames, {size / 1e6:.1f} MB")
    count = (beats["frames"] - 1) * grain + 1
    meta = {"frames": count,
            "sizes": [{"dir": name, "w": w, "h": h, "step": step} for name, w, h, step, _ in SIZES],
            "beats": [{"from": (b["from"] - 1) * grain + 1, "to": min(count, b["to"] * grain), "key": b["key"], "side": b["side"],
                       "subject": b["subject"]} for b in beats["beats"]]}
    (OUT / "film.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"docs/scroll: {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
