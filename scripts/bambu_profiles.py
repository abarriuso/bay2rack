#!/usr/bin/env python3
"""Print profiles for MakerWorld: Bambu Studio projects (.3mf) with the pieces on named plates.

  python scripts/bambu_profiles.py            every profile
  python scripts/bambu_profiles.py kit        only the profiles whose name contains the word

Bambu Studio's own command line arranges every plate, writes the project and slices it, so a profile that comes
out of here has passed the same test MakerWorld runs on upload. Output: build/makerworld/profiles/ (not committed).
Run scripts/makerworld.py first: the STLs come from build/makerworld/stl/.
Set BAMBU_STUDIO=/path/to/bambu-studio to choose the binary.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STL = ROOT / "build" / "makerworld" / "stl"
OUT = ROOT / "build" / "makerworld" / "profiles"
TMP = OUT / "_tmp"

# the smallest Bambu bed (180 x 180): what fits here fits every other printer
MACHINE = "Bambu Lab A1 mini 0.4 nozzle"
PROCESS = "0.20mm Standard @BBL A1M"
FILAMENT = "Generic PETG @BBL A1M"
BED = "Textured PEI Plate"
BED_SIZE = 180
STRIDE = BED_SIZE * 1.2                                   # plates sit on a grid, a fifth of a bed apart

# profile -> its plates: (name of the plate, the STLs on it). No : or / in a name: Bambu Studio drops such a name
PROFILES = {
    "bay2rack-kit-3bay-2U-patch": [
        ("1 - Test pieces (print these first)", ["test-bay-plate", "test-rack-M5", "test-keystone-metal"]),
        ("2 - Adapter, 3 bays (2U + strip)", ["adapter-3bay-2U"]),
        ("3 - Patch panel for the strip + keystone covers", ["filler-keystone6", "keystone-cover", "keystone-pass-through"]),
        ("4 - Other fillers (vents or blank)", ["filler-vent", "filler-blank"]),
        ("5 - PCI brackets (cables in from the back)", ["pci-bracket-lan", "pci-bracket-power"]),
    ],
    "bay2rack-rack-modules": [
        ("Mercusys MS105G switch (1U)", ["module-ms105g"]),
        ("UniFi Flex Mini (1U)", ["module-unifi-flex-mini"]),
        ("UniFi Express (1U)", ["module-unifi-express"]),
        ("JetKVM + NanoKVM tray (1U)", ["module-kvm-jetkvm-nanokvm"]),
        ("Raspberry Pi 5 tray (1U)", ["module-raspberry-pi5"]),
        ("Raspberry Pi blades x4 (2U)", ["module-raspberry-pi-blades-2U"]),
        ("Patch panel, 6 keystones (1U)", ["module-patch6"]),
        ("Power and reset buttons (1U)", ["module-buttons"]),
        ("Fans 3 x 40 mm (1U)", ["module-fans-40mm"]),
        ("Fans 2 x 60 mm (2U)", ["module-fans-60mm-2U"]),
        ("Fan 80 mm (2U)", ["module-fan-80mm-2U"]),
        ("Fan 92 mm (3U)", ["module-fan-92mm-3U"]),
        ("Fan 120 mm (3U)", ["module-fan-120mm-3U"]),
    ],
}


def find_studio():
    for exe in (os.environ.get("BAMBU_STUDIO"), shutil.which("bambu-studio"), r"C:\Program Files\Bambu Studio\bambu-studio.exe",
                "/Applications/BambuStudio.app/Contents/MacOS/BambuStudio"):
        if exe and Path(exe).exists():
            return Path(exe)
    sys.exit("Bambu Studio not found - set BAMBU_STUDIO=/path/to/bambu-studio")


STUDIO = find_studio()
PRESETS = STUDIO.parent / "resources" / "profiles" / "BBL"
SETTINGS = ["--load-settings", f"{PRESETS / 'machine' / (MACHINE + '.json')};{PRESETS / 'process' / (PROCESS + '.json')}",
            "--load-filaments", str(PRESETS / "filament" / (FILAMENT + ".json"))]


def studio(*args):
    """Run Bambu Studio's command line in TMP; it reports in result.json."""
    result = TMP / "result.json"
    result.unlink(missing_ok=True)
    subprocess.run([str(STUDIO), "--outputdir", str(TMP), *map(str, args)], cwd=TMP, capture_output=True)
    r = json.loads(result.read_text(encoding="utf-8")) if result.exists() else {"return_code": -1, "error_string": "no result.json"}
    if r.get("return_code"):
        sys.exit(f"Bambu Studio failed ({' '.join(map(str, args))[:200]}): {r.get('error_string')}")
    return r


def items(path):
    """The pieces of a project by name (Bambu Studio sorts them by size): {name: (object id, [12 numbers of its transform])}."""
    z = zipfile.ZipFile(path)
    names = dict(re.findall(r'<object id="(\d+)">\s*<metadata key="name" value="([^"]+)\.stl"',
                            z.read("Metadata/model_settings.config").decode("utf-8")))
    return {names[i]: (int(i), [float(x) for x in t.split()])
            for i, t in re.findall(r'<item objectid="(\d+)"[^>]*transform="([^"]+)"', z.read("3D/3dmodel.model").decode("utf-8"))}


def build(name, plates):
    files = [STL / f"{f}.stl" for _, names in plates for f in names]
    for f in files:
        if not f.exists():
            sys.exit(f"{f} is missing: run scripts/makerworld.py first")
    # 1. every plate arranged on its own: where each piece goes on its bed
    local = {}
    for k, (plate, names) in enumerate(plates):
        studio(*SETTINGS, "--arrange", "1", "--orient", "0", "--export-3mf", f"plate{k}.3mf", *[STL / f"{f}.stl" for f in names])
        got = items(TMP / f"plate{k}.3mf")
        if sorted(got) != sorted(names) or any(not (0 <= t[9] <= BED_SIZE and 0 <= t[10] <= BED_SIZE) for _, t in got.values()):
            sys.exit(f"{name}: plate '{plate}' does not fit one {BED_SIZE} mm bed")
        local.update({f: t for f, (_, t) in got.items()})
    # 2. one project with every piece, then each piece moved to its plate
    studio(*SETTINGS, "--arrange", "1", "--orient", "0", "--export-3mf", "all.3mf", *files)
    src = zipfile.ZipFile(TMP / "all.3mf")
    model = src.read("3D/3dmodel.model").decode("utf-8")
    config = src.read("Metadata/model_settings.config").decode("utf-8")
    ids = {f: i for f, (i, _) in items(TMP / "all.3mf").items()}
    identify = dict(re.findall(r'<metadata key="object_id" value="(\d+)"/>\s*<metadata key="instance_id" value="0"/>\s*'
                               r'<metadata key="identify_id" value="(\d+)"/>', config))
    cols = math.ceil(math.sqrt(len(plates)))
    blocks = []
    for k, (plate, names) in enumerate(plates):
        dx, dy = (k % cols) * STRIDE, -(k // cols) * STRIDE
        inst = []
        for n in names:
            t = list(local[n])
            t[9], t[10] = t[9] + dx, t[10] + dy
            model, done = re.subn(r'(<item objectid="%d"[^>]*transform=")[^"]+"' % ids[n],
                                  lambda m: m.group(1) + " ".join(f"{x:.6g}" for x in t) + '"', model)
            assert done == 1, (name, plate, ids[n])
            inst.append(f'    <model_instance>\n      <metadata key="object_id" value="{ids[n]}"/>\n'
                        f'      <metadata key="instance_id" value="0"/>\n'
                        f'      <metadata key="identify_id" value="{identify[str(ids[n])]}"/>\n    </model_instance>\n')
        blocks.append(f'  <plate>\n    <metadata key="plater_id" value="{k + 1}"/>\n    <metadata key="plater_name" value="{plate}"/>\n'
                      f'    <metadata key="locked" value="false"/>\n    <metadata key="filament_map_mode" value="Auto For Flush"/>\n'
                      + "".join(inst) + "  </plate>\n")
    config = config[:config.index("  <plate>")] + "".join(blocks) + config[config.index("  <assemble>"):]
    settings = json.loads(src.read("Metadata/project_settings.config"))
    settings["curr_bed_type"] = BED
    merged = TMP / "merged.3mf"
    with zipfile.ZipFile(merged, "w", zipfile.ZIP_DEFLATED) as z:
        for i in src.infolist():
            if i.filename.endswith(".png"):
                continue                                  # the pictures of the plates: Bambu Studio draws them again below
            data = {"3D/3dmodel.model": model.encode("utf-8"), "Metadata/model_settings.config": config.encode("utf-8"),
                    "Metadata/project_settings.config": json.dumps(settings, indent=4).encode("utf-8")}.get(i.filename, src.read(i.filename))
            z.writestr(i, data)
    # 3. Bambu Studio opens it, writes it as its own project (with the pictures), and slices every plate
    studio("--arrange", "0", "--export-3mf", f"{name}.3mf", merged)
    final = TMP / f"{name}.3mf"
    back = zipfile.ZipFile(final).read("Metadata/model_settings.config").decode("utf-8")
    kept = [len(re.findall("<model_instance>", b)) for b in back.split("<plate>")[1:]]
    if kept != [len(names) for _, names in plates]:
        sys.exit(f"{name}: Bambu Studio moved pieces between plates: {kept}")
    if re.findall(r'plater_name" value="([^"]*)"', back) != [plate for plate, _ in plates]:
        sys.exit(f"{name}: Bambu Studio changed the name of a plate")
    studio("--arrange", "0", "--slice", "0", "--export-3mf", "sliced.3mf", final)
    info = zipfile.ZipFile(TMP / "sliced.3mf").read("Metadata/slice_info.config").decode("utf-8")
    shutil.copy2(final, OUT / f"{name}.3mf")
    print(f"{name}.3mf: {len(plates)} plates, {len(files)} pieces, every plate slices")
    for (plate, _), block in zip(plates, info.split("<plate>")[1:]):
        s = int(float(dict(re.findall(r'<metadata key="(prediction)" value="([^"]+)"', block)).get("prediction", 0)))
        print(f"    {plate:52} {s // 3600}h {s % 3600 // 60:02d}m")


def main(words):
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(exist_ok=True)
    for name, plates in PROFILES.items():
        if all(w in name for w in words):
            build(name, plates)
    shutil.rmtree(TMP, ignore_errors=True)
    print(f"{MACHINE}, {PROCESS}, {FILAMENT}, {BED} -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
