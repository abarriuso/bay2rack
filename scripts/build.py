#!/usr/bin/env python3
"""Build every bay2rack variant from one table.

VARIANTS below is the single source of truth. It generates:
  src/bay2rack.json   presets for the OpenSCAD Customizer
  stl/<family>/...    ready-to-print STL files (already in print orientation)
  stl/README.md       what to print for each variant + the hardware you need
  stl/index.json      the same catalogue for the web viewer

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
import struct
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
    "modules": "Rack modules: switch and KVM trays, Raspberry Pi trays and 2U blades, 40 mm fans, patch and button panels.",
    "bezels": "Bezels for the other PCs, no rack (fit = panel): button panel, vents, 80 mm fan.",
    "rear": "Printed brackets for two PCI slots: the network cables and the power cable leave the case through them.",
    "covers": "Keystone covers for unused ports, pushed in from the front.",
    "tests": "Small test prints: check them before printing a full adapter.",
}


def variant(path, title, params, parts, flat=False):
    return {"path": path, "title": title, "params": params, "parts": parts, "flat": flat}


def plate_flush(b):
    parts = [("adapter.stl", {"part": "adapter"})]
    parts += [(name, {"part": "filler", "spare_fill": fill}) for name, fill in FILLERS]
    return variant(f"plate-flush/{b}bay-{b - 1}U", f"{b} bay{'s' if b > 1 else ''}, {b - 1}U + spare zone",
                   {"bays": b, "fit": "flush", "front_style": "plate", "filler_mode": "separate"}, parts)


def plate_overhang(b, pattern="auto"):
    return variant(f"plate-overhang/{b}bay-{b}U", f"{b} bay{'s' if b > 1 else ''}, {b}U",
                   {"bays": b, "fit": "overhang", "front_style": "plate", "hole_pattern": pattern},
                   [("adapter.stl", {"part": "adapter"})])


def bezel_flush(b):
    name = f"{b}bay-patch6" if b == 1 else f"{b}bay-{b - 1}U-patch6"
    return variant(f"bezel-flush/{name}", f"{b} bay{'s' if b > 1 else ''}, {b - 1}U + 6-port patch",
                   {"bays": b, "fit": "flush", "front_style": "bezel", "filler_mode": "integral",
                    "spare_fill": "keystone"},
                   [("adapter.stl", {"part": "adapter"})])


def bezel_overhang(b, pattern="auto"):
    return variant(f"bezel-overhang/{b}bay-{b}U", f"{b} bay{'s' if b > 1 else ''}, {b}U",
                   {"bays": b, "fit": "overhang", "front_style": "bezel", "hole_pattern": pattern},
                   [("adapter.stl", {"part": "adapter"})])


def panel(name, title, u, fill, **extra):
    return variant(f"panels/{name}", title, {"part": "rack_panel", "panel_u": u, "panel_fill": fill, **extra},
                   [("", {})], flat=True)


def module(name, title, kind):
    return variant(f"modules/{name}", title, {"part": "rack_module", "module_type": kind}, [("", {})], flat=True)


def bezel(name, title, bays, front_style="bezel", **extra):
    # no rack units: the whole bezel is the fill, cut straight into the frame
    return variant(f"bezels/{name}", title, {"bays": bays, "fit": "panel", "front_style": front_style,
                                             "filler_mode": "integral", **extra},
                   [("adapter.stl", {"part": "adapter"})])


def test(name, title, part, **extra):
    return variant(f"tests/{name}", title, {"part": part, **extra}, [("", {})], flat=True)


# hole_pattern auto: EIA holes inside the bays, one centred hole per U where the panels stick out
# (M6 inserts in the outer EIA holes would break out of the posts there).
VARIANTS = (
    [plate_flush(b) for b in (1, 2, 3, 4)]
    + [plate_overhang(1), plate_overhang(2), plate_overhang(3, "center")]
    + [bezel_flush(b) for b in (1, 2, 3)]
    + [bezel_overhang(1), bezel_overhang(2, "center"), bezel_overhang(3, "center")]
    + [bezel("1bay-buttons", "1 bay: power key (MX) + LEDs", 1, spare_fill="buttons", btn_count=1),
       bezel("1bay-vent", "1 bay with vents", 1, spare_fill="vent"),
       bezel("2bay-fan80", "2 bays: 80 mm fan", 2, spare_fill="fan80"),
       bezel("3bay-buttons-fan80", "3 bays: 80 mm fan + power / reset keys", 3, front_style="plate",
             spare_pos="split", spare_split=0.67, spare_fill="fan80", spare_fill_2="buttons")]
    + [panel("1U-patch6", "1U, 6 keystones", 1, "keystone"),
       panel("1U-vent", "1U, vented", 1, "vent"),
       panel("1U-blank", "1U, blank", 1, "blank"),
       panel("2U-patch12", "2U, 12 keystones", 2, "keystone", ks_ports=12, ks_ports_list=""),
       panel("1U-fan40", "1U, three 40 mm fans", 1, "fan40")]
    + [module("ms105g", "Mercusys MS105G switch tray (1U)", "ms105g"),
       module("uswflex", "UniFi USW-Flex-Mini tray (1U)", "uswflex"),
       module("ux", "UniFi Express tray (1U)", "ux"),
       module("kvm-jet-nano", "KVM tray: JetKVM + NanoKVM (1U)", "kvm:jet+nano"),
       module("kvm-jet-jet", "KVM tray: two JetKVM (1U)", "kvm:jet+jet"),
       module("kvm-nano-nano", "KVM tray: two NanoKVM (1U)", "kvm:nano+nano"),
       module("pi5", "Raspberry Pi 5 / 4 / 3 tray, one board (1U)", "pi:pi5"),
       module("pi-x2", "Raspberry Pi tray, two boards with PoE HATs (1U)", "pi:pi5+pi5"),
       module("pi-zero", "Raspberry Pi Zero tray (1U)", "pi:zero"),
       module("piblade-x4", "Raspberry Pi blades, four boards on edge (2U)", "piblade:pi5+pi5+pi5+pi5"),
       module("fan40", "Three 40 mm fans (1U)", "fan40"),
       module("shelf", "Shelf for small devices (1U)", "shelf"),
       module("buttons", "Button panel: MX keys + power / HDD LEDs (1U)", "buttons"),
       module("patch6", "Patch panel, 6 keystone ports (1U)", "patch"),
       variant("rear/pci-lan", "PCI-slot bracket for the network cables", {"part": "pci_bracket", "pci_kind": "lan"}, [("", {})], flat=True),
       variant("rear/pci-power", "PCI-slot bracket for the power cable", {"part": "pci_bracket", "pci_kind": "power"}, [("", {})], flat=True),
       variant("covers/keystone-blank", "Plain keystone cover", {"part": "keystone_cover", "cover_type": "blank"}, [("", {})], flat=True),
       variant("covers/keystone-pass", "Keystone cable pass-through cover", {"part": "keystone_cover", "cover_type": "pass"}, [("", {})], flat=True)]
    + [test("bay-plate", "Bay screw corner, plate front", "test_bay"),
       test("bay-bezel", "Bay screw corner, bezel front (checks flushness)", "test_bay", front_style="bezel"),
       test("rack-M6-heatset", "Rack hole spacing bar, M6 heat-set", "test_rack"),
       test("keystone-metal", "One metal keystone holder cell", "test_keystone", ks_style="metal"),
       test("keystone-standard", "One standard keystone cut-out", "test_keystone", ks_style="standard"),
       test("button-mx", "One MX key cut-out of the button panel", "test_button", btn_type="mx"),
       test("button-metal-16", "One 16 mm metal push-button hole", "test_button", btn_type="metal", btn_metal_d=16),
       test("button-retro", "One retro cap opening + carrier post", "test_button", btn_type="retro")]
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


FACET = re.compile(r"facet normal\s+(\S+)\s+(\S+)\s+(\S+)\s+outer loop\s+"
                   r"vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)")


def normalize_stl(path):
    """OpenSCAD writes the same triangles in a different order on every run. Rewrite the
    STL as binary with the triangles in a canonical order: identical geometry gives an
    identical file (no git churn) and the file is ~5x smaller."""
    tris = []
    for f in FACET.findall(path.read_text()):
        n = tuple(float(x) for x in f[:3])
        vs = [tuple(float(x) for x in f[3 + 3 * i: 6 + 3 * i]) for i in range(3)]
        k = vs.index(min(vs))                     # rotate, keeping the winding
        tris.append((tuple(vs[k:] + vs[:k]), n))
    tris.sort()
    with open(path, "wb") as out:
        out.write(b"bay2rack binary STL".ljust(80, b" "))
        out.write(struct.pack("<I", len(tris)))
        for vs, n in tris:
            out.write(struct.pack("<12fH", *n, *vs[0], *vs[1], *vs[2], 0))


def export(openscad, v, filename, extra):
    out = STL / (v["path"] + ".stl" if v["flat"] else Path(v["path"]) / filename)
    out.parent.mkdir(parents=True, exist_ok=True)
    params = {**v["params"], **extra}
    cmd = [openscad, "-o", str(out)] + [a for k, val in params.items() for a in ("-D", f"{k}={scad_value(val)}")] + [str(SCAD)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    log = r.stdout + r.stderr
    echoes = re.findall(r'ECHO: "(.*)"', log)
    ok = r.returncode == 0 and out.exists()
    if ok:
        normalize_stl(out)
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
             "Customizer and export your own.",
             "The devices, their cables and power supplies are not included; the build guide is in "
             "[docs/BUILD.md](../docs/BUILD.md).", ""]
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
                    if e.startswith("BOM | ") and e[6:] not in bom and not e.startswith("BOM | cables and power"):
                        bom.append(e[6:])
            hw = "<br>".join(b.replace("  +  ", " + ") for b in bom) or "-"
            lines.append(f"| **{v['path'].split('/', 1)[1]}**<br>{v['title']} | {files} | {hw} |")
        lines.append("")
    (STL / "README.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
    # the same catalogue as JSON, for the web viewer
    catalog = {"families": FAMILIES, "variants": []}
    for v in VARIANTS:
        rs = by_variant.get(v["path"], [])
        bom = []
        for r in rs:
            bom += [e[6:] for e in r["echoes"] if e.startswith("BOM | ") and e[6:] not in bom
                    and not e.startswith("BOM | cables and power")]
        catalog["variants"].append({
            "path": v["path"], "family": v["path"].split("/")[0], "title": v["title"], "params": v["params"],
            "files": [r["file"].relative_to(STL).as_posix() for r in rs if r["ok"]], "bom": bom})
    (STL / "index.json").write_text(json.dumps(catalog, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {(STL / 'README.md').relative_to(ROOT)} + index.json")


def remove_stale(keep):
    """Delete STL files that are no longer produced; folders in use (open in a slicer) are left alone."""
    for f in STL.rglob("*.stl"):
        if f.resolve() not in keep:
            try:
                f.unlink()
            except OSError as e:
                print(f"  keep  {f.relative_to(ROOT).as_posix()} ({e.strerror})")
    for d in sorted((p for p in STL.rglob("*") if p.is_dir()), key=lambda p: -len(p.parts)):
        try:
            d.rmdir()          # only succeeds when empty
        except OSError:
            pass


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
        remove_stale({r["file"].resolve() for r in results if r["ok"]})
        write_index(results)
    else:
        print("partial build: stl/README.md left unchanged (run without filters to refresh it)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
