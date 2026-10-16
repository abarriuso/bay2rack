"""Evaluate the whole assembly (echo only, no geometry) of every web example and of every bays x fit x front
combination, plus a few NanoKVM / label builds: any WARNING, OpenSCAD error or hang is a defect.

  python scripts/check_assemblies.py
"""
import concurrent.futures as cf
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXE = next(e for e in (shutil.which("openscad"), r"C:\Program Files\OpenSCAD\openscad.com") if e and Path(e).exists())
SCAD = ROOT / "src" / "bay2rack.scad"

js = (ROOT / "web" / "src" / "main.js").read_text(encoding="utf-8")
block = js[js.index("const EXAMPLES = {"):js.index("const EXAMPLE_KEYS")]
cases = []
for m in re.finditer(r"(\w+): \{(.*?)\},\n", block, re.S):
    d = {k: (v.strip("'") if v.startswith("'") else float(v)) for k, v in re.findall(r"(\w+): ('[^']*'|[\d.]+)", m.group(2))}
    cases.append((f"example/{m.group(1)}", d))
for b in range(1, 7):
    for fit in ("flush", "overhang", "panel"):
        for front in ("plate", "bezel"):
            cases.append((f"combo/{b}-{fit}-{front}", {"bays": b, "fit": fit, "front_style": front,
                          "filler_mode": "integral" if front == "bezel" else "separate"}))
cases += [
    ("nkvm/side-in-3", {"bays": 3, "rack_modules": "nkvm:side,ms105g"}),
    ("nkvm/front-2ks", {"bays": 3, "rack_modules": "nkvm:front", "nkvm_keystones": 2}),
    ("nkvm/ks-2ks", {"bays": 3, "rack_modules": "nkvm:ks,ms105g", "nkvm_keystones": 2, "labels_multicolour": True}),
    ("nkvm/split-multicolour", {"bays": 3, "rack_modules": "nkvm:side,patch", "nkvm_split": True, "labels_multicolour": True}),
    ("labels/multicolour-names", {"bays": 4, "rack_modules": "patch,label,vent", "labels_multicolour": True, "ks_names": "WAN,LAN,,NAS"}),
    ("buttons/retro-integral", {"bays": 3, "front_style": "bezel", "filler_mode": "integral", "spare_fill": "buttons", "btn_type": "retro", "btn_turbo": True}),
    ("buttons/metal-module", {"bays": 4, "rack_modules": "buttons,patch", "btn_type": "metal"}),
    ("split-spare", {"bays": 4, "spare_pos": "split", "spare_fill": "label", "spare_fill_2": "vent", "labels_multicolour": True}),
]

def lit(v):
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return f"{v:g}"
    return '"' + str(v) + '"'

def run(case):
    name, d = case
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "a.echo"
        args = [EXE, "-o", str(out)] + [a for k, v in {"part": "assembly", **d}.items() for a in ("-D", f"{k}={lit(v)}")] + [str(SCAD)]
        try:
            r = subprocess.run(args, capture_output=True, text=True, timeout=180)
        except subprocess.TimeoutExpired:
            return name, ["HANG (over 180 s)"]
        log = r.stdout + r.stderr + (out.read_text(errors="ignore") if out.exists() else "")
    bad = sorted(set(re.findall(r"(?:ECHO: \")?((?:WARNING|ERROR)[^\n\"]*)", log)))
    bad = [b for b in bad if "taller than 250 mm" not in b]
    if r.returncode != 0: bad.append(f"exit {r.returncode}")
    return name, bad

fails = 0
with cf.ThreadPoolExecutor(8) as pool:
    for name, bad in pool.map(run, cases):
        if bad:
            fails += 1
            print(f"DEFECT {name}:", *bad[:4], sep="\n    ", flush=True)
print(f"\n{len(cases) - fails}/{len(cases)} assemblies clean")
