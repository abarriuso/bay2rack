"""Render the edge cases of the model and check every one of them.

  python scripts/test_models.py            # all cases, in parallel
  python scripts/test_models.py -k module  # only the cases whose name contains "module"

Each case is rendered to STL with the OpenSCAD CLI and must:
  - finish without an OpenSCAD error and give a non-empty mesh,
  - print no WARNING (or exactly the warning it is meant to trigger),
  - for an adapter: print the summary line, and a bill of materials whose rack screw count
    matches the rack units (6 per U with the EIA pattern),
  - (BOM cases) print the bill of materials lines they list.
The ready-made builds of the web configurator (EXAMPLES in web/src/main.js) are tested too, so the
site never offers a build that does not fit. Exit code 1 if anything fails (used by CI).
"""
import argparse
import concurrent.futures as cf
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCAD = ROOT / "src" / "bay2rack.scad"


def openscad():
    for exe in (os.environ.get("OPENSCAD"), shutil.which("openscad"), r"C:\Program Files\OpenSCAD\openscad.com"):
        if exe and Path(exe).exists() or (exe and shutil.which(exe)):
            return exe
    sys.exit("OpenSCAD not found: install it or set OPENSCAD")


# ---------------------------------------------------------------- cases: (name, defines, expected warning)
def adapter(name, warn=None, need=(), **d):
    return (f"adapter/{name}", {"part": "adapter", **d}, warn, list(need))


def module(kind, warn=None, **d):
    return (f"module/{kind}", {"part": "rack_module", "module_type": kind, **d}, warn)


CASES = (
    # every bay count, both front styles
    # (6 bays make an adapter longer than 250 mm on the bed: the model says so in a note, it is not an error)
    [adapter(f"plate-flush-{b}", bays=b, need=["on the bed"] if b == 6 else []) for b in range(1, 7)]
    + [adapter(f"bezel-flush-{b}", bays=b, front_style="bezel", filler_mode="integral",
               need=["on the bed"] if b == 6 else []) for b in (1, 3, 6)]
    + [adapter("plate-overhang-1", bays=1, fit="overhang"),
       adapter("plate-overhang-2", bays=2, fit="overhang"),
       adapter("plate-overhang-3-center", bays=3, fit="overhang", hole_pattern="center"),
       adapter("plate-overhang-6-center", bays=6, fit="overhang", hole_pattern="center", need=["on the bed"]),
       adapter("bezel-overhang-3-center", bays=3, fit="overhang", front_style="bezel", hole_pattern="center"),
       adapter("panel-only-fan80-buttons", bays=3, fit="panel", filler_mode="integral", spare_pos="split",
               spare_split=0.67, spare_fill="fan80", spare_fill_2="buttons"),
       adapter("panel-only-1-buttons", bays=1, fit="panel", front_style="bezel", filler_mode="integral",
               spare_fill="buttons", btn_count=1)]
    # spare zone: position, split, every fill
    + [adapter(f"fill-{f}", spare_fill=f, filler_mode="integral") for f in
       ("blank", "keystone", "vent", "cable", "label", "buttons")]
    + [adapter("spare-bottom", spare_pos="bottom"),
       adapter("spare-split", spare_pos="split", spare_split=0.78)]
    # rack screws and fixings
    + [adapter(f"screw-{s}", rack_screw=s) for s in ("M3", "M4", "M5", "10-32", "12-24")]
    # (nuts and channels with M5: an M6 nut leaves no wall to the bay side, see the warnings below)
    + [adapter("fixing-tap", rack_fixing="tap")]
    + [adapter(f"fixing-{f}-M5", rack_fixing=f, rack_screw="M5") for f in ("square_nut", "channel")]
    + [adapter("fixing-nut_trap-M4", rack_fixing="nut_trap", rack_screw="M4")]
    + [adapter(f"bay-{f}", bay_fixing=f) for f in ("tap", "nut", "clearance")]
    + [adapter("bay-6-32", bay_screw="6-32"), adapter("head-countersunk", rack_screw_head="countersunk")]
    # rack modules, including the 2U blades and the trays with several boxes
    + [module(k) for k in ("ms105g", "uswflex", "ux", "shelf", "patch", "fan40", "buttons", "dev1",
                           "vent", "blank", "cable", "label")]
    + [module("kvm:jet"), module("kvm:jet+nano"), module("kvm:nano+nano"), module("kvm:jet+jet"),
       module("pi:pi5"), module("pi:pi5+pi5"), module("pi:zero"), module("pi:pi4+pi3"),
       module("piblade:pi5+pi5"), module("piblade:pi5+pi5+pi5+pi5"),
       module("nkvm:side"), module("nkvm:front"),
       ("module/nkvm:front-2ks", {"part": "rack_module", "module_type": "nkvm:front", "nkvm_keystones": 2}, None),
       ("module/nkvm:front-1ks", {"part": "rack_module", "module_type": "nkvm:front", "nkvm_keystones": 1}, None),
       ("lid/nkvm:side", {"part": "rack_module_lid", "module_type": "nkvm:side"}, None),
       ("lid/nkvm:front", {"part": "rack_module_lid", "module_type": "nkvm:front"}, None),
       module("nkvm:ks"),
       ("module/nkvm:ks-2ks", {"part": "rack_module", "module_type": "nkvm:ks", "nkvm_keystones": 2}, None),
       ("lid/nkvm:ks", {"part": "rack_module_lid", "module_type": "nkvm:ks"}, None),
       ("drawer/nkvm:front", {"part": "rack_module_bay", "module_type": "nkvm:front"}, None),
       ("module/nkvm:front-1piece", {"part": "rack_module", "module_type": "nkvm:front", "nkvm_split": False, "nkvm_keystones": 1}, None),
       ("module/nkvm:side-open", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_cover": False, "nkvm_raised": False}, None),
       ("module/nkvm:side-pocket-1piece", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_raised": False, "nkvm_split": False}, None),
       ("module/nkvm:side-raised-1piece", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_split": False}, None),
       ("pocket/nkvm:side-pocket", {"part": "rack_module_bay", "module_type": "nkvm:side", "nkvm_raised": False}, None),
       ("module/nkvm:side-split-plate", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_split": True}, None),
       ("module/nkvm:side-split-open", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_split": True, "nkvm_cover": False}, None),
       ("pocket/nkvm:side-split", {"part": "rack_module_bay", "module_type": "nkvm:side", "nkvm_split": True}, None),
       ("labels/patch-names", {"part": "rack_module_labels", "module_type": "patch", "labels_multicolour": True,
                               "ks_ports_list": "rj45m,hdmi,usb,rj45m,cover,pass", "ks_names": "WAN,,,NAS"}, None),
       ("labels/filler-keystone", {"part": "filler_labels", "labels_multicolour": True}, None),
       ("labels/label-raised", {"part": "rack_module_labels", "module_type": "label", "labels_multicolour": True,
                                "label_relief": "raised", "label_text": "PROXMOX", "label_align": "left"}, None),
       ("labels/nkvm-side", {"part": "rack_module_labels", "module_type": "nkvm:side", "labels_multicolour": True}, None),
       ("module/label-raised", {"part": "rack_module", "module_type": "label", "label_relief": "raised"}, None)]
    + [(f"panel/vent-{st}", {"part": "rack_panel", "panel_fill": "vent", "vent_style": st}, None) for st in ("slots", "louvres", "hex", "dots")]
    + [(f"module/buttons-{bt}", {"part": "rack_module", "module_type": "buttons", "btn_type": bt, "btn_turbo": True}, None)
       for bt in ("mx", "metal", "retro")]
    + [("fill/buttons-retro", {"part": "filler", "spare_fill": "buttons", "btn_type": "retro"}, None),
       ("fill/buttons-metal-22", {"part": "filler", "spare_fill": "buttons", "btn_type": "metal", "btn_metal_d": 22}, None),
       ("button/cap-power", {"part": "button_cap", "btn_cap": "power"}, None),
       ("button/cap-reset", {"part": "button_cap", "btn_cap": "reset"}, None),
       ("button/carrier", {"part": "button_carrier", "btn_type": "retro", "btn_turbo": True}, None)]
    # the rest of the parts
    + [("panel/1U-patch6", {"part": "rack_panel", "panel_u": 1, "panel_fill": "keystone"}, None),
       ("panel/2U-patch12", {"part": "rack_panel", "panel_u": 2, "panel_fill": "keystone", "ks_ports": 12}, None),
       ("panel/1U-fan40", {"part": "rack_panel", "panel_u": 1, "panel_fill": "fan40"}, None),
       ("panel/2U-fan80", {"part": "rack_panel", "panel_u": 2, "panel_fill": "fan80"}, None),
       ("filler/keystone", {"part": "filler"}, None),
       ("filler/split-2", {"part": "filler_2", "spare_pos": "split"}, None),
       ("cover/blank", {"part": "keystone_cover", "cover_type": "blank"}, None),
       ("cover/pass", {"part": "keystone_cover", "cover_type": "pass"}, None),
       ("pci/lan", {"part": "pci_bracket", "pci_kind": "lan"}, None),
       ("pci/power", {"part": "pci_bracket", "pci_kind": "power"}, None)]
    + [(f"test/{t}", {"part": t}, None) for t in ("test_bay", "test_rack", "test_keystone")]
    + [(f"test/button-{bt}", {"part": "test_button", "btn_type": bt}, None) for bt in ("mx", "metal", "retro")]
    # the model must still warn when something does not fit
    + [module("kvm:jet+jet+jet", warn="do not fit"),
       adapter("fan80-in-a-1U-strip", warn="80 mm fan", spare_fill="fan80", filler_mode="integral"),
       adapter("fixing-nut_trap-M6", warn="too close to the frame edge", rack_fixing="nut_trap"),
       adapter("fixing-square_nut-M6", warn="nut pockets leave only", rack_fixing="square_nut"),
       adapter("fixing-channel-M6", warn="nut channels leave only", rack_fixing="channel"),
       ("module/nkvm:side-2ks", {"part": "rack_module", "module_type": "nkvm:side", "nkvm_keystones": 2}, None)]
    # the bill of materials: what each piece needs
    + [("bom/filler-keystones", {"part": "filler"}, None,
        ["keystones: 3 x metal / shielded RJ45 keystone", "keystones: 2 x printed keystone cover", "filler panels: 2 x"]),
       ("bom/patch-module", {"part": "rack_module", "module_type": "patch"}, None,
        ["keystones: 3 x metal", "(into the adapter's fixings"]),
       # a patch module with its own ports (not the strip's ks_ports_list), a label module with its own text
       ("bom/patch-own-ports", {"part": "rack_module", "module_type": "patch:rj45=NAS+hdmi+cover"}, None,
        ["keystones: 1 x RJ45 keystone", "keystones: 1 x HDMI keystone", "keystones: 1 x printed keystone cover"]),
       ("module/patch-bad-type", {"part": "rack_module", "module_type": "patch:rj45m+toaster"},
        "unknown keystone type 'toaster' in the patch module"),
       ("module/label-own", {"part": "rack_module", "module_type": "label:MY_LAB"}, None),
       ("labels/patch-own", {"part": "rack_module_labels", "module_type": "patch:rj45m=NAS+rj45m=MY_PC", "labels_multicolour": True}, None),
       ("labels/label-own", {"part": "rack_module_labels", "module_type": "label:RACK_2", "labels_multicolour": True}, None),
       ("bom/patch12", {"part": "rack_panel", "panel_u": 2, "panel_fill": "keystone", "ks_ports": 12, "ks_ports_list": ""}, None,
        ["keystones: 12 x metal"]),
       ("bom/nkvm-drawer", {"part": "rack_module", "module_type": "nkvm:front", "nkvm_keystones": 1}, None,
        ["NanoKVM drawer: 2 x M3 x 12 countersunk", "NanoKVM bay lid: 4 x", "keystones: 1 x metal", "devices (not included): 1 x NanoKVM"]),
       ("bom/nkvm-ks", {"part": "rack_module_lid", "module_type": "nkvm:ks"}, None,
        ["RJ45 keystone coupler (female-female)", "NanoKVM bay lid: 4 x"]),
       ("bom/nkvm-mountain", {"part": "rack_module_bay", "module_type": "nkvm:side"}, None,
        ["NanoKVM mountain to plate: 4 x M3 x 8 countersunk", "(in the mountain posts)"]),
       ("bom/carrier", {"part": "button_carrier", "btn_type": "retro"}, None, ["2 x M3 x 8 screw"]),
       ("bom/fan40-20", {"part": "rack_panel", "panel_fill": "fan40", "fan40_t": 20}, None, ["x M3 x 30 screw"])]
)


def web_examples():
    """The ready-made builds of the configurator, rendered as adapters."""
    js = (ROOT / "web" / "src" / "main.js").read_text(encoding="utf-8")
    block = js[js.index("const EXAMPLES = {"):js.index("const EXAMPLE_KEYS")]
    out = []
    for m in re.finditer(r"(\w+): \{(.*?)\},\n", block, re.S):
        d = {k: (v.strip("'") if v.startswith("'") else float(v))
             for k, v in re.findall(r"(\w+): ('[^']*'|[\d.]+)", m.group(2))}
        out.append((f"web/{m.group(1)}", {"part": "adapter", **d}, None))
    return out


# ---------------------------------------------------------------- run and check
def literal(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return f"{v:g}"
    return '"' + str(v) + '"'


def triangles(stl):
    b = stl.read_bytes()
    if b[:5] == b"solid" and b"facet" in b[:300]:
        return b.count(b"facet normal")
    return struct.unpack("<I", b[80:84])[0] if len(b) >= 84 else 0


def run(exe, case):
    name, defines, warn, *more = case
    bom_need = more[0] if more else []
    with tempfile.TemporaryDirectory() as tmp:
        stl = Path(tmp) / "out.stl"
        args = [exe, "-o", str(stl)]
        for k, v in defines.items():
            args += ["-D", f"{k}={literal(v)}"]
        r = subprocess.run(args + [str(SCAD)], capture_output=True, text=True, timeout=900)
        log = r.stdout + r.stderr
        tris = triangles(stl) if stl.exists() else 0
    problems = []
    if r.returncode != 0 or re.search(r"^ERROR", log, re.M):
        problems.append("OpenSCAD error: " + " | ".join(re.findall(r"^ERROR.*", log, re.M)[:2]))
    warnings = [a or b for a, b in re.findall(r'^ECHO: "(WARNING.*)"\s*$|^(WARNING: .*)', log, re.M)]
    if warn:
        if not any(warn in w for w in warnings):
            problems.append(f"expected a warning about '{warn}', got none")
    elif warnings:
        problems.append("; ".join(warnings[:3]))
    for need in bom_need:
        if need not in log:
            problems.append(f"BOM: no '{need}'")
    if tris == 0 and not problems:
        problems.append("empty mesh")
    if defines.get("part") == "adapter" and not warn:
        summary = re.search(r"bay2rack \| bays=\d+.*units=(\d+)U", log)
        if not summary:
            problems.append("no summary line")
        elif int(summary.group(1)) > 0 and (defines.get("hole_pattern", "auto") == "eia"
                                          or (defines.get("hole_pattern", "auto") == "auto" and defines.get("fit") != "overhang")):
            bom = re.search(r"BOM \| rack accessories: (\d+) x", log)
            want = 6 * int(summary.group(1))
            if not bom or int(bom.group(1)) != want:
                problems.append(f"BOM: {bom.group(1) if bom else 'no'} rack screws, expected {want}")
    return name, tris, problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-k", default="", help="only cases whose name contains this")
    ap.add_argument("-j", type=int, default=os.cpu_count() or 2, help="parallel renders")
    a = ap.parse_args()
    exe = openscad()
    cases = [c for c in CASES + web_examples() if a.k in c[0]]
    failed = 0
    with cf.ThreadPoolExecutor(a.j) as pool:
        for name, tris, problems in pool.map(lambda c: run(exe, c), cases):
            failed += bool(problems)
            print(f"{'FAIL' if problems else 'ok  '}  {name:40} {tris:7} triangles"
                  + ("".join(f"\n        {p}" for p in problems)), flush=True)
    print(f"\n{len(cases) - failed}/{len(cases)} passed")
    sys.exit(1 if failed else 0)


main()
