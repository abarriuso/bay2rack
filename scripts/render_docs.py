#!/usr/bin/env python3
"""Render the images used by the README into docs/img/ (OpenSCAD preview, no extra deps).

Usage: python scripts/render_docs.py [name ...]
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import ROOT, SCAD, find_openscad, scad_value  # noqa: E402

IMG = ROOT / "docs" / "img"
ISO = "0,0,0,70,0,-30,0"            # gimbal camera, used with --viewall
CLOSE = "-320,-470,250,0,40,60"     # eye + target, close-up of the bays in the tower
NO_CASE = {"case_view": "none"}

# name: (camera, size, viewall, params)
IMAGES = {
    "hero":               ("-760,-1050,420,0,200,-130", "900,1000", False, {}),
    "mounted-plate":      (CLOSE, "1000,800", False, {}),
    "mounted-bezel":      (CLOSE, "1000,800", False, {"front_style": "bezel", "filler_mode": "integral"}),
    "mounted-bezel-1bay": ("-260,-400,200,0,40,15", "1000,800", False,
                           {"bays": 1, "case_bays": 3, "front_style": "bezel", "filler_mode": "integral"}),
    "plate-flush-1bay":   (ISO, "900,750", True, {"bays": 1, **NO_CASE}),
    "plate-flush-3bay":   (ISO, "900,750", True, {"bays": 3, **NO_CASE}),
    "plate-flush-4bay":   (ISO, "900,750", True, {"bays": 4, **NO_CASE}),
    "plate-overhang-3bay": (ISO, "900,750", True, {"bays": 3, "fit": "overhang", "hole_pattern": "center", **NO_CASE}),
    "bezel-flush-3bay":   ("0,0,0,75,0,-25,0", "900,750", True,
                           {"front_style": "bezel", "filler_mode": "integral", "case_view": "ghost"}),
    "hw-explode":         (ISO, "1000,800", True, {"explode": 25, **NO_CASE}),
    "hw-section-row":     ("0,0,0,60,0,-25,0", "1000,800", True, {"section": "rack_row"}),
    "hw-section-column":  ("0,0,0,75,0,60,0", "1000,800", True, {"section": "rack_column"}),
    "print-orientation":  ("0,0,0,55,0,-30,0", "900,750", True, {"part": "adapter"}),
}


def render(openscad, name, spec):
    camera, size, viewall, params = spec
    out = IMG / f"{name}.png"
    cmd = [openscad, "-o", str(out), f"--imgsize={size}", f"--camera={camera}", "--colorscheme=Tomorrow"]
    if viewall:
        cmd += ["--viewall", "--autocenter"]
    cmd += [a for k, v in params.items() for a in ("-D", f"{k}={scad_value(v)}")] + [str(SCAD)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return name, r.returncode == 0 and out.exists()


def main(names):
    IMG.mkdir(parents=True, exist_ok=True)
    todo = {n: s for n, s in IMAGES.items() if not names or n in names}
    if not names:
        for old in IMG.glob("*.png"):
            old.unlink()
    openscad = find_openscad()
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        for name, ok in pool.map(lambda kv: render(openscad, *kv), todo.items()):
            print(f"  {'ok  ' if ok else 'FAIL'}  docs/img/{name}.png")


if __name__ == "__main__":
    main(sys.argv[1:])
