#!/usr/bin/env python3
"""Build every bay2rack variant from one table.

VARIANTS below is the single source of truth. It generates:
  src/bay2rack.json   presets for the OpenSCAD Customizer
  stl/<family>/...    ready-to-print STL files (already in print orientation)
  stl/README.md       what to print for each variant + the hardware you need

Usage:
  python scripts/build.py               build everything
  python scripts/build.py 3bay bezel    only variants whose path contains every word
  python scripts/build.py --json        only regenerate the Customizer presets
  python scripts/build.py --list        list the variants
Set OPENSCAD=/path/to/openscad to choose the binary.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCAD = ROOT / "src" / "bay2rack.scad"
PRESETS = ROOT / "src" / "bay2rack.json"
STL = ROOT / "stl"

FILLERS = [("filler-keystone6.stl", "keystone"), ("filler-vent.stl", "vent"), ("filler-blank.stl", "blank")]

FAMILIES = {
    "plate-flush": "Plate front, flush: N-1 U inside the bay stack + a swappable filler in the spare zone.",
    "plate-overhang": "Plate front, overhang: N bays = N U, the frame and panels stick out a few mm.",
    "bezel-flush": "Exact 5.25in drive bezel, flush with the case front, patch panel cut into the bezel.",
    "bezel-overhang": "Exact 5.25in drive bezel, N U of rack panels overlapping the case front.",
    "panels": "Standalone 6in rack panels for any 6in rack.",
    "tests": "Small test prints: check them before printing a full adapter.",
}


def variant(path, title, params, parts, flat=False):
    return {"path": path, "title": title, "params": params, "parts": parts, "flat": flat}


def plate_flush(b):
    parts = [("adapter.stl", {"part": "adapter"})]
    parts += [(name, {"part": "filler", "spare_fill": fill}) for name, fill in FILLERS]
    return variant(f"plate-flush/{b}bay-{b - 1}U", f"{b} bay{'s' if b > 1 else ''}, {b - 1}U + spare zone",
                   {"bays": b, "fit": "flush", "front_style": "plate", "filler_mode": "separate"}, parts)


def plate_overhang(b, pattern="eia"):
    return variant(f"plate-overhang/{b}bay-{b}U", f"{b} bay{'s' if b > 1 else ''}, {b}U",
                   {"bays": b, "fit": "overhang", "front_style": "plate", "hole_pattern": pattern},
                   [("adapter.stl", {"part": "adapter"})])


def bezel_flush(b):
    name = f"{b}bay-patch6" if b == 1 else f"{b}bay-{b - 1}U-patch6"
    return variant(f"bezel-flush/{name}", f"{b} bay{'s' if b > 1 else ''}, {b - 1}U + 6-port patch",
                   {"bays": b, "fit": "flush", "front_style": "bezel", "filler_mode": "integral",
                    "spare_fill": "keystone"},
                   [("adapter.stl", {"part": "adapter"})])


def bezel_overhang(b, pattern="eia"):
    return variant(f"bezel-overhang/{b}bay-{b}U", f"{b} bay{'s' if b > 1 else ''}, {b}U",
                   {"bays": b, "fit": "overhang", "front_style": "bezel", "hole_pattern": pattern},
                   [("adapter.stl", {"part": "adapter"})])


def panel(name, title, u, fill, **extra):
    return variant(f"panels/{name}", title, {"part": "rack_panel", "panel_u": u, "panel_fill": fill, **extra},
                   [("", {})], flat=True)


def test(name, title, part, **extra):
    return variant(f"tests/{name}", title, {"part": part, **extra}, [("", {})], flat=True)


# M6 inserts only fit the outer EIA holes when the frame is tall enough;
# the tighter overhang variants use one centred hole per U.
VARIANTS = (
    [plate_flush(b) for b in (1, 2, 3, 4)]
    + [plate_overhang(1), plate_overhang(2), plate_overhang(3, "center")]
    + [bezel_flush(b) for b in (1, 2, 3)]
    + [bezel_overhang(1), bezel_overhang(2, "center"), bezel_overhang(3, "center")]
    + [panel("1U-patch6", "1U, 6 keystones", 1, "keystone"),
       panel("1U-vent", "1U, vented", 1, "vent"),
       panel("1U-blank", "1U, blank", 1, "blank"),
       panel("2U-patch12", "2U, 12 keystones", 2, "keystone", ks_ports=12)]
    + [test("bay-plate", "Bay screw corner, plate front", "test_bay"),
       test("bay-bezel", "Bay screw corner, bezel front (checks flushness)", "test_bay", front_style="bezel"),
       test("rack-M6-heatset", "Rack hole spacing bar, M6 heat-set", "test_rack"),
       test("keystone-metal", "One metal keystone holder cell", "test_keystone", ks_style="metal"),
       test("keystone-standard", "One standard keystone cut-out", "test_keystone", ks_style="standard")]
)


def scad_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return f'"{v}"'


def find_openscad():
    if os.environ.get("OPENSCAD"):
        return os.environ["OPENSCAD"]
    for c in ("openscad", "openscad.com",
              r"C:\Program Files\OpenSCAD\openscad.com",
              "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"):
        found = shutil.which(c) or (c if os.path.isfile(c) else None)
        if found:
            return found
    sys.exit("OpenSCAD not found - set OPENSCAD=/path/to/openscad")


def write_presets():
    sets = {v["path"]: {k: str(val).lower() if isinstance(val, bool) else str(val)
                        for k, val in v["params"].items()} for v in VARIANTS}
    PRESETS.write_text(json.dumps({"fileFormatVersion": "1", "parameterSets": sets}, indent=4) + "\n",
                       encoding="utf-8", newline="\n")
    print(f"wrote {PRESETS.relative_to(ROOT)} ({len(sets)} presets)")


def export(openscad, v, filename, extra):
    out = STL / (v["path"] + ".stl" if v["flat"] else Path(v["path"]) / filename)
    out.parent.mkdir(parents=True, exist_ok=True)
    params = {**v["params"], **extra}
    cmd = [openscad, "-o", str(out)] + [a for k, val in params.items() for a in ("-D", f"{k}={scad_value(val)}")] + [str(SCAD)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    log = r.stdout + r.stderr
    echoes = re.findall(r'ECHO: "(.*)"', log)
    ok = r.returncode == 0 and out.exists()
    return {"variant": v, "file": out, "ok": ok, "log": log, "echoes": echoes}


def write_index(results):
    by_variant = {}
    for r in results:
        by_variant.setdefault(r["variant"]["path"], []).append(r)
    lines = ["# Ready-to-print STL files", "",
             "Generated by `python scripts/build.py` from `src/bay2rack.scad` - do not edit by hand.",
             "Every file is already in print orientation (front face down, no supports).",
             "Defaults: 6in rack with 10in mini rack rules (134.925 mm hole spacing, EIA-310), M6 heat-set inserts "
             "for the rack, M3 heat-set inserts for the bay screws. Need something else? Change it in the "
             "Customizer and export your own.", ""]
    for fam, desc in FAMILIES.items():
        rows = [v for v in VARIANTS if v["path"].split("/")[0] == fam and v["path"] in by_variant]
        if not rows:
            continue
        lines += [f"## {fam}", "", desc, "", "| Variant | Files | Hardware |", "|---|---|---|"]
        for v in rows:
            rs = by_variant[v["path"]]
            files = "<br>".join(f"[`{r['file'].name}`]({r['file'].relative_to(STL).as_posix()})" for r in rs if r["ok"])
            bom = []
            for r in rs:
                for e in r["echoes"]:
                    if e.startswith("BOM | ") and e[6:] not in bom:
                        bom.append(e[6:])
            hw = "<br>".join(b.replace("  +  ", " + ") for b in bom) or "-"
            lines.append(f"| **{v['path'].split('/', 1)[1]}**<br>{v['title']} | {files} | {hw} |")
        lines.append("")
    (STL / "README.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {(STL / 'README.md').relative_to(ROOT)}")


def main(argv):
    if "--list" in argv:
        for v in VARIANTS:
            print(f"{v['path']:34s} {v['title']}")
        return
    write_presets()
    if "--json" in argv:
        return
    words = [a for a in argv if not a.startswith("--")]
    chosen = [v for v in VARIANTS if all(w in v["path"] for w in words)]
    full = not words
    if full and STL.exists():
        shutil.rmtree(STL)
    openscad = find_openscad()
    jobs = [(v, f, extra) for v in chosen for f, extra in v["parts"]]
    print(f"exporting {len(jobs)} files from {len(chosen)} variants with {openscad}")
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        results = list(pool.map(lambda j: export(openscad, *j), jobs))
    failed = 0
    for r in results:
        rel = r["file"].relative_to(ROOT).as_posix()
        if r["ok"]:
            print(f"  ok    {rel}")
        else:
            failed += 1
            print(f"  FAIL  {rel}\n{r['log'][-800:]}")
        for e in r["echoes"]:
            if e.startswith(("WARNING", "NOTE")):
                print(f"        {e}")
    if full:
        write_index(results)
    else:
        print("partial build: stl/README.md left unchanged (run without filters to refresh it)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
