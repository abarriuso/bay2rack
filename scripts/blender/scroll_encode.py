"""Frames from scroll.py -> the scroll film of the site (docs/scroll/).

  python scripts/blender/scroll_encode.py

For each theme (dark, light): <theme>/1600/NNNN.webp with every frame, and <theme>/960/NNNN.webp with one in four
for phones; film.json says how many frames there are, in which sizes, and which frames each text of the page
belongs to (the beats of scroll.py, without their draft texts: the page has its own, in both languages).
The frames are those of scroll.py --render (f_####.png) with, between each two, the ones of --between
(q_####_k.png) when they are there. When scroll.py --sharp has rendered the key frames again at 2560 x 1440
(sharp/, sharp_light/), <theme>/2560/NNNN.webp has them too: the page shows one of those when the scroll stops.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "docs" / "blender" / "scroll"
OUT = ROOT / "docs" / "scroll"
# (folder, width, height, every nth frame, WebP quality, role): "fine" plays on wide screens, "base" loads first
# everywhere (and is all a phone takes), "sharp" is for a frame the scroll stops on (the key frames, see SHARP)
SIZES = [("1600", 1600, 900, 1, 76, "fine"), ("960", 960, 540, 4, 70, "base")]
SHARP = ("2560", 2560, 1440, 4, 80, "sharp")
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
        for name, w, h, step, quality, _ in SIZES:
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
    # the sharp key frames: one every `grain` frames of the film (the key frames are 1, 1 + grain, ...)
    sizes = list(SIZES)
    sharp = {th: sorted((SRC / ("sharp" + folder[len("frames"):])).glob("f_*.png")) for th, folder in THEMES.items()}
    if all(len(v) == beats["frames"] for v in sharp.values()):
        name, w, h, _, quality, role = SHARP
        for theme, keys in sharp.items():
            out = OUT / theme / name
            out.mkdir(parents=True, exist_ok=True)
            for old in out.glob("*.webp"):
                old.unlink()
            for i, f in enumerate(keys):
                im = Image.open(f).convert("RGB")
                if im.size != (w, h):
                    im = im.resize((w, h), Image.LANCZOS)
                im.save(out / f"{i + 1:04d}.webp", quality=quality, method=6)
            size = sum(p.stat().st_size for p in out.glob("*.webp"))
            total += size
            print(f"{theme}/{name}: {len(keys)} frames, {size / 1e6:.1f} MB")
        sizes.append((name, w, h, grain, quality, role))
    else:
        print("no sharp frames (scroll.py --sharp, both themes): the film has none")
    meta = {"frames": count,
            "sizes": [{"dir": name, "w": w, "h": h, "step": step, "role": role} for name, w, h, step, _, role in sizes],
            "beats": [{"from": (b["from"] - 1) * grain + 1, "to": min(count, b["to"] * grain), "key": b["key"], "side": b["side"],
                       "subject": b["subject"]} for b in beats["beats"]]}
    (OUT / "film.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"docs/scroll: {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
