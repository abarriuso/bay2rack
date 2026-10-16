# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The adapter itself has its own generation number (adapter v1, v2), the one
on the photos and in the MakerWorld notes.

## Unreleased

- NanoKVM bay standing (`nkvm:side`): out of the case in a little mountain (`nkvm_raised`, new default) with its ports open at both sides, cables from outside or through slots into the case; three pieces (plate, mountain, lid) by default.
- LED strip fill removed.
- NanoKVM bay `nkvm:ks`: the network port comes to the front through a keystone; the NanoKVM lies flat right behind it, connected with a straight 10 cm patch cable, HDMI and USB into the case.
- `hole_pattern = auto` (new default): EIA-310 inside the bays, one centred hole per U when the units stick out, so overhang builds no longer have rack holes breaking out of the frame. A new CI check renders every example and bays x fit x front assembly.
- Port names over the patch panel (`ks_names`): your own, HDMI / USB / RCA / AUDIO / OPTICAL for those jacks, numbers in order for the rest.
- Multicolour letters (`labels_multicolour`): every panel with letters gets a `..-labels` piece to print in a second filament; the letter colour shows in the preview.
- Label: text, size, alignment, position, engraved or raised.
- Vent fill redesigned: vertical slots, louvres, honeycomb or holes (`vent_style`), with a solid rim (`vent_margin`).
- Editor: the viewer shows Mounted or one piece of the kit at a time; steps grouped (your case, what goes in, making it) with a print fits step and your own colour.
- README images rendered again from the v2 adapter, with the new trays and the NanoKVM bay.
- Fixed: a 1-bay build (no rack units) hung the 3D preview.
- Tolerances: `ks_fit` for every keystone opening (cells, cut-outs and covers follow), `nkvm_insert_d`, `mount_clear` round the NanoKVM; README and web tell you to print the test pieces first and tune them.
- Every number and size has a range (customizer and web), and the model warns about values that do not go together.
- NanoKVM bay (`nkvm:side`, `nkvm:front`) with a lid on M3 heat-set inserts: standing in a front pocket with its heatsink facing out and the plugs inside the pocket, or lying flat behind the plate with only Ethernet at the front; up to two keystones.
- The web generator moves to Cloudflare Pages: https://bay2rack.pages.dev/ (the old GitHub Pages address redirects there).
- Ready-made builds in a collapsible box before the steps; the 3D view keeps its full width on phones.

## 0.2.0 — 2026-10-15

**Adapter v2**
- Grooves for the metal tabs between the bays along the whole sleeve, with a rib inside so the wall keeps its strength.
- Stiffer side walls: inner lips on the top and bottom edges and fillets into the rack posts.
- 80 mm and 40 mm fan openings are plain round holes.

**Rack modules**
- KVM over IP trays for 1–3 boxes of your choice (JetKVM, NanoKVM, custom size).
- Raspberry Pi trays (Pi 5 / 4 / 3 / Zero, one or two boards) and 2U blades for up to four boards on edge.
- UniFi USW-Flex-Mini and UniFi Express trays, a 1U panel for three 40 mm fans, made-to-measure device trays.
- Modules of more than one unit; the rack fills from the top and a module that no longer fits becomes a blank.
- Audio keystones: RCA, 3.5 mm jack, Toslink.
- Printed brackets for two PCI slots to bring the cables in from the back.

**Configurator**
- New site, ready-made builds, a homelab scene with VLAN-coloured cables, sleeper case style.
- Spare-zone editor: split the strip in two and share its height; fills that don't fit are not offered.
- A warning on the viewer when something doesn't fit.

**Project**
- Hero film rendered in Blender from the same models (`scripts/blender/`).
- Model tests in CI (`scripts/test_models.py`): edge cases and every ready-made build.
- Compatibility list (`docs/CASES.md`) and issue templates for case reports and problems.
- MakerWorld upload kit (`scripts/makerworld.py`).

## 0.1.0 — 2026-10-13

First public release, from the adapter v1 that is printed and mounted in the photos.
- One parametric model for 1–6 bays: flush (N−1 U + a spare zone) or overhang (N U), plate or exact 5.25" bezel front.
- Keystone patch panel with metal holder cells or standard cut-outs, covers and cable pass-throughs.
- Selectable rack and bay hardware with automatic screw lengths and a bill of materials.
- Mercusys MS105G switch tray, shelf and button panel with MX switches and LEDs.
- Web generator on GitHub Pages: OpenSCAD in WebAssembly, 3D preview in a real PC case, kit download.
