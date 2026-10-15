"""Everything for a MakerWorld upload, in build/makerworld/ (not committed).

  python scripts/makerworld.py

- bay2rack-makerworld.scad: the model as ONE file (MakerWorld's Parametric Model Maker can't include local
  files), with a printable part as the default and the preview-only settings hidden.
- stl/: the files most people need, flat names, already in print orientation.
- images/: covers and gallery as PNG.
- description-en.md / description-es.md: the text for the model page.
The STL folder of the repo stays the source; run scripts/build.py first if the model changed.
"""
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "makerworld"
OPENSCAD = r"C:\Program Files\OpenSCAD\openscad.com"

# (published name, file in stl/)
STLS = [
    ("adapter-3bay-2U.stl", "plate-flush/3bay-2U/adapter.stl"),
    ("adapter-2bay-1U.stl", "plate-flush/2bay-1U/adapter.stl"),
    ("adapter-4bay-3U.stl", "plate-flush/4bay-3U/adapter.stl"),
    ("adapter-bezel-3bay-2U-patch6.stl", "bezel-flush/3bay-2U-patch6/adapter.stl"),
    ("filler-keystone6.stl", "plate-flush/3bay-2U/filler-keystone6.stl"),
    ("filler-vent.stl", "plate-flush/3bay-2U/filler-vent.stl"),
    ("filler-blank.stl", "plate-flush/3bay-2U/filler-blank.stl"),
    ("bezel-3bay-fan80-buttons.stl", "bezels/3bay-buttons-fan80/adapter.stl"),
    ("module-ms105g.stl", "modules/ms105g.stl"),
    ("module-unifi-flex-mini.stl", "modules/uswflex.stl"),
    ("module-unifi-express.stl", "modules/ux.stl"),
    ("module-kvm-jetkvm-nanokvm.stl", "modules/kvm-jet-nano.stl"),
    ("module-raspberry-pi5.stl", "modules/pi5.stl"),
    ("module-raspberry-pi-blades-2U.stl", "modules/piblade-x4.stl"),
    ("module-fans-40mm.stl", "modules/fan40.stl"),
    ("module-patch6.stl", "modules/patch6.stl"),
    ("module-buttons.stl", "modules/buttons.stl"),
    ("keystone-cover.stl", "covers/keystone-blank.stl"),
    ("keystone-pass-through.stl", "covers/keystone-pass.stl"),
    ("pci-bracket-lan.stl", "rear/pci-lan.stl"),
    ("pci-bracket-power.stl", "rear/pci-power.stl"),
    ("test-bay-plate.stl", "tests/bay-plate.stl"),
    ("test-rack-M6.stl", "tests/rack-M6-heatset.stl"),
    ("test-keystone-metal.stl", "tests/keystone-metal.stl"),
]
# first one is the cover
IMAGES = [
    ("01-cover.png", "docs/img/film/hero.webp"),
    ("02-router.png", "docs/gallery/router.webp"),
    ("03-front.png", "docs/img/film/front.webp"),
    ("04-adapter-back.png", "docs/img/adapter-v2-back.webp"),
    ("05-adapter-front.png", "docs/img/adapter-v2-front.webp"),
    ("06-network.png", "docs/gallery/network.webp"),
    ("07-pi-cluster.png", "docs/gallery/pi.webp"),
    ("08-kvm.png", "docs/gallery/kvm.webp"),
    ("09-audio.png", "docs/gallery/audio.webp"),
    ("10-fan80-buttons.png", "docs/gallery/client.webp"),
    ("11-cables.png", "docs/img/film/cables.webp"),
    ("12-variants.png", "docs/img/variants.png"),
    ("13-keystone.png", "docs/img/keystone.png"),
    ("14-buttons.png", "docs/img/buttons.png"),
    ("15-print.png", "docs/img/print.png"),
]


def flatten():
    src = (ROOT / "src" / "bay2rack.scad").read_text(encoding="utf-8")

    def inline(m):
        lib = (ROOT / "src" / m.group(1)).read_text(encoding="utf-8")
        return f"// ---- {m.group(1)}\n{lib.rstrip()}\n// ---- end of {m.group(1)}"
    out = re.sub(r"^include <(lib/[\w.]+)>$", inline, src, flags=re.M)
    assert "include <" not in out, "a nested include is left"
    # a printable part by default: the assembly is the browser preview of the whole case, not something to print
    part = re.search(r'^part = "assembly"; // \[assembly:[^,]+, (.*)\]$', out, re.M)
    assert part, "part line changed"
    out = out.replace(part.group(0), f'part = "adapter"; // [{part.group(1)}]')
    out = out.replace("// What to render. \"assembly\" is a preview only, do not print it.", "// What to render")
    out = out.replace("/* [Preview] */", "/* [Hidden] */", 1)
    out = out.replace("//  This file only holds the parameters; the geometry lives in lib/.",
                      "//  MakerWorld build: one file (the repo keeps the geometry in src/lib/).\n"
                      "//  Configurator with a 3D preview: https://abarriuso.github.io/bay2rack/")
    path = OUT / "bay2rack-makerworld.scad"
    path.write_text(out, encoding="utf-8", newline="\n")
    return path


def triangles(path):
    """Triangle count and bounding box of an ASCII or binary STL."""
    b = path.read_bytes()
    if b[:5] == b"solid" and b"facet" in b[:300]:
        v = [tuple(map(float, m.groups())) for m in re.finditer(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", b)]
    else:
        n = struct.unpack("<I", b[80:84])[0]
        v = [f[i:i + 3] for k in range(n) for f in [struct.unpack("<12f", b[84 + 50 * k:132 + 50 * k])] for i in (3, 6, 9)]
    box = [round(f(x[i] for x in v), 2) for f in (min, max) for i in range(3)]
    return len(v) // 3, box


def check(scad):
    """The one-file model must give the same adapter as the repo."""
    stl = OUT / "_check.stl"
    r = subprocess.run([OPENSCAD, "-o", str(stl), str(scad)], capture_output=True, text=True)
    if r.returncode or not stl.exists():
        sys.exit("OpenSCAD failed on the flattened file:\n" + r.stderr[-2000:])
    got, want = triangles(stl), triangles(ROOT / "stl/plate-flush/3bay-2U/adapter.stl")
    stl.unlink()
    if got != want:
        sys.exit(f"the flattened model differs from the repo: {got} vs {want}")
    print(f"check: same adapter as the repo ({got[0]} triangles)")


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    (OUT / "stl").mkdir(parents=True)
    (OUT / "images").mkdir()
    scad = flatten()
    for name, src in STLS:
        shutil.copy2(ROOT / "stl" / src, OUT / "stl" / name)
    for name, src in IMAGES:
        Image.open(ROOT / src).convert("RGB").save(OUT / "images" / name, optimize=True)
    for f in ("description-en.md", "description-es.md"):
        shutil.copy2(ROOT / "scripts" / "makerworld" / f, OUT / f)
    shutil.copy2(ROOT / "LICENSE", OUT / "LICENSE.txt")
    if "--no-check" not in sys.argv:
        check(scad)
    print(f"{len(STLS)} STL, {len(IMAGES)} images -> {OUT}")


main()
