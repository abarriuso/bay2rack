#!/usr/bin/env python3
"""Render the README images into docs/img/.

Each view is rendered by OpenSCAD at 2x into build/render/, cropped to its content,
downscaled (anti-aliasing) and laid out as captioned cards on a few sheets.
Needs OpenSCAD and Pillow (pip install pillow).

Usage: python scripts/render_docs.py
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import ROOT, SCAD, find_openscad, scad_value  # noqa: E402

IMG = ROOT / "docs" / "img"
RAW = ROOT / "build" / "render"
ISO = "0,0,0,68,0,-32,0"            # gimbal camera, used with --viewall
CLOSE = "-320,-470,250,0,40,60"     # eye + target: close-up of the bays in the tower
NO_CASE = {"case_view": "none", "scene": "single"}
BEZEL = {"front_style": "bezel", "filler_mode": "integral"}

# name: (camera, raw size, viewall, params)  - raw size is 2x the card size
VIEWS = {
    "homelab-back":    ("1150,1650,800,240,260,-60", "1200,900", False, {}),
    "rack-close":      ("-170,-330,150,0,0,60", "1200,900", False, {"scene": "single", "case_view": "none"}),
    "mounted-bezel":   (CLOSE, "1200,900", False, {**BEZEL, "scene": "single"}),
    "mounted-1bay":    ("-260,-400,200,0,40,15", "1200,900", False, {"bays": 1, "case_model": "obsidian750d", **BEZEL, "scene": "single"}),
    "btn-ring":        ("-60,-230,95,0,-10,108", "1200,900", False, {"spare_fill": "buttons", "led_style": "ring", **NO_CASE}),
    "btn-halo":        ("-60,-230,95,0,-10,108", "1200,900", False, {"spare_fill": "buttons", "led_style": "halo", **NO_CASE}),
    "btn-glow":        ("-60,-230,95,0,-10,108", "1200,900", False, {"spare_fill": "buttons", "led_style": "glow", **NO_CASE}),
    "pf-1":            (ISO, "1200,900", True, {"bays": 1, **NO_CASE}),
    "pf-3":            (ISO, "1200,900", True, {"bays": 3, **NO_CASE}),
    "pf-4":            (ISO, "1200,900", True, {"bays": 4, **NO_CASE}),
    "po-3":            (ISO, "1200,900", True, {"bays": 3, "fit": "overhang", "hole_pattern": "center", **NO_CASE}),
    "bf-3":            (ISO, "1200,900", True, {**BEZEL, **NO_CASE}),
    "bo-3":            (ISO, "1200,900", True, {"fit": "overhang", "hole_pattern": "center", "front_style": "bezel", **NO_CASE}),
    "hw-explode":      (ISO, "1200,900", True, {"explode": 25, **NO_CASE}),
    "hw-row":          ("0,0,0,60,0,-25,0", "1200,900", True, {"section": "rack_row"}),
    "hw-column":       ("0,0,0,75,0,60,0", "1200,900", True, {"section": "rack_column"}),
    "mod-ms105g":      ("0,0,0,55,0,25,0", "1200,900", True, {"part": "rack_module", "module_type": "ms105g"}),
    "mod-shelf":       ("0,0,0,55,0,25,0", "1200,900", True, {"part": "rack_module", "module_type": "shelf"}),
    "mod-kvm":         ("0,0,0,55,0,25,0", "1200,900", True, {"part": "rack_module", "module_type": "kvm:jet+nano"}),
    "mod-pi":          ("0,0,0,55,0,25,0", "1200,900", True, {"part": "rack_module", "module_type": "pi:pi5"}),
    "mod-nkvm":        ("0,0,0,55,0,25,0", "1200,900", True, {"part": "rack_module", "module_type": "nkvm:side"}),
    "ks-front":        ("0,0,0,90,0,0,0", "1200,900", True, {"part": "rack_panel", "print_orientation": False}),
    "ks-back":         ("0,0,0,62,0,200,0", "1200,900", True, {"part": "rack_panel", "print_orientation": False}),
    "ks-cut":          ("0,0,0,90,0,90,0", "1200,900", True, None),     # special: cut-open coupon
    "cover-pass":      ("0,0,0,50,0,30,0", "1200,900", True, {"part": "keystone_cover", "cover_type": "pass"}),
    "print":           ("0,0,0,55,0,-30,0", "1200,900", True, {"part": "adapter"}),
}

SHEETS = {
    "homelab.png":  (2, [("homelab-back", "cables: back of the case -> patch panel"),
                         ("rack-close", "MS105G switch · NanoKVM shelf · patch panel")]),
    "variants.png": (3, [("pf-1", "plate-flush · 1 bay · 6-port patch"),
                         ("pf-3", "plate-flush · 3 bays · 2U + patch"),
                         ("pf-4", "plate-flush · 4 bays · 3U + patch"),
                         ("po-3", "plate-overhang · 3 bays · 3U"),
                         ("bf-3", "bezel-flush · 3 bays · 2U + patch"),
                         ("bo-3", "bezel-overhang · 3 bays · 3U")]),
    "mounted.png":  (2, [("mounted-bezel", "exact 5.25\" bezel · flush with the case front"),
                         ("mounted-1bay", "1 bay · patch panel bezel")]),
    "modules.png":  (3, [("mod-ms105g", "Mercusys MS105G mount"),
                         ("mod-kvm", "KVM over IP tray · JetKVM + NanoKVM"),
                         ("mod-pi", "Raspberry Pi tray"),
                         ("mod-nkvm", "NanoKVM bay · standing, lid apart"),
                         ("mod-shelf", "1U shelf (NanoKVM, Pi...)"),
                         ("cover-pass", "keystone pass-through cover")]),
    "buttons.png":  (3, [("btn-ring", "MX keys · LED ring"),
                         ("btn-halo", "MX keys · halo"),
                         ("btn-glow", "MX keys · hidden glow")]),
    "keystone.png": (3, [("ks-front", "1U panel · metal keystones, covers, pass-through"),
                         ("ks-back", "holder cells (back)"),
                         ("ks-cut", "cell profile: latch ramp + rear lips")]),
    "hardware.png": (3, [("hw-explode", "explode = 25"),
                         ("hw-row", "section = rack_row"),
                         ("hw-column", "section = rack_column")]),
    "print.png":    (1, [("print", None)]),
}

CARD = (600, 450)       # card size of the sheet images (px)
GAP, PAD, CAP = 18, 24, 34
BG, CARD_BG, TEXT = (255, 255, 255), (246, 247, 249), (60, 64, 72)

KS_CUT_SCAD = """include <{main}>
part = "none";
intersection() {{
    test_keystone();
    translate([-100, -50, -50]) cube(100);
}}
"""


def render(openscad, name, spec):
    camera, size, viewall, params = spec
    out = RAW / f"{name}.png"
    if params is None:   # cut-open keystone coupon
        src = RAW / "ks_cut.scad"
        src.write_text(KS_CUT_SCAD.format(main=SCAD.as_posix()), encoding="utf-8")
        params = {}
    else:
        src = SCAD
    cmd = [openscad, "-o", str(out), f"--imgsize={size}", f"--camera={camera}", "--colorscheme=Tomorrow"]
    if viewall:
        cmd += ["--viewall", "--autocenter"]
    cmd += [a for k, v in params.items() for a in ("-D", f"{k}={scad_value(v)}")] + [str(src)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return name, r.returncode == 0 and out.exists()


def load_cropped(name):
    im = Image.open(RAW / f"{name}.png").convert("RGB")
    bg = im.getpixel((0, 0))
    diff = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L").point(lambda v: 255 if v > 4 else 0)
    box = diff.getbbox() or (0, 0, *im.size)
    m = 30
    box = (max(box[0] - m, 0), max(box[1] - m, 0), min(box[2] + m, im.size[0]), min(box[3] + m, im.size[1]))
    im = im.crop(box)
    # unify the background with the card colour
    out = Image.new("RGB", im.size, CARD_BG)
    out.paste(im, mask=diff.crop(box).point(lambda v: 255 if v else 0))
    full_bleed = box[0] == 0 and box[1] == 0          # tower shots fill the frame: keep their background
    return im if full_bleed else out


def font(size):
    for f in ("DejaVuSans.ttf", "segoeui.ttf", "Arial.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    try:
        import matplotlib
        return ImageFont.truetype(str(Path(matplotlib.get_data_path()) / "fonts/ttf/DejaVuSans.ttf"), size)
    except Exception:
        return ImageFont.load_default()


def fit(im, w, h):
    s = min(w / im.size[0], h / im.size[1])
    return im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.LANCZOS)


def sheet(filename, cols, items):
    if cols == 1 and len(items) == 1:      # single image: just crop + downscale
        im = load_cropped(items[0][0])
        im = im.resize((im.size[0] // 2, im.size[1] // 2), Image.LANCZOS)
        im.save(IMG / filename, optimize=True)
        return
    rows = (len(items) + cols - 1) // cols
    cw, ch = CARD
    W = PAD * 2 + cols * cw + (cols - 1) * GAP
    H = PAD * 2 + rows * (ch + CAP) + (rows - 1) * GAP
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    f = font(19)
    for i, (name, caption) in enumerate(items):
        r, c = divmod(i, cols)
        x0, y0 = PAD + c * (cw + GAP), PAD + r * (ch + CAP + GAP)
        draw.rounded_rectangle([x0, y0, x0 + cw, y0 + ch], radius=14, fill=CARD_BG)
        im = load_cropped(name)
        full = im.getpixel((0, 0)) != CARD_BG
        im = fit(im, cw, ch) if full else fit(im, cw - 30, ch - 30)
        if full:   # full-bleed render: clip to the rounded card
            m = Image.new("L", (cw, ch), 0)
            ImageDraw.Draw(m).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=14, fill=255)
            tile = Image.new("RGB", (cw, ch), CARD_BG)
            tile.paste(im, ((cw - im.size[0]) // 2, (ch - im.size[1]) // 2))
            canvas.paste(tile, (x0, y0), m)
        else:
            canvas.paste(im, (x0 + (cw - im.size[0]) // 2, y0 + (ch - im.size[1]) // 2))
        if caption:
            tw = draw.textlength(caption, font=f)
            draw.text((x0 + (cw - tw) / 2, y0 + ch + 7), caption, fill=TEXT, font=f)
    canvas.save(IMG / filename, optimize=True)


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)
    openscad = find_openscad()
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        for name, ok in pool.map(lambda kv: render(openscad, *kv), VIEWS.items()):
            if not ok:
                print(f"  FAIL  render {name}")
    for old in IMG.glob("*.png"):
        old.unlink()
    for filename, (cols, items) in SHEETS.items():
        sheet(filename, cols, items)
        print(f"  ok    docs/img/{filename}")


if __name__ == "__main__":
    main()
