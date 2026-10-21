# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The adapter itself has its own generation number (adapter v1, v2), the one
on the photos and in the MakerWorld notes.

## Unreleased

- Web generator: a first question (a fan or buttons, sockets, or a rack for devices); a "No soldering iron" switch
  (M5 with square nuts, hex nuts in the bay); fixings that leave under 1 mm of wall to the bay side are off; the
  modules left out of the rack, the ports and the fans limited to what fits; plain warnings without parameter names;
  keyboard and screen-reader fixes; a mirror on GitHub Pages (https://abarriuso.github.io/bay2rack/).
- Model: the side-wall check covers every rack fixing (an M6 square nut or channel left 0.2 mm); hex nut pockets open
  behind the post; fans and button panels in the BOM only where they fit; metal keystone cells stay between the posts;
  PCI brackets with a keyhole an RJ45 plug passes; ports numbered by their place (covers carry no number).
- Build guide (`docs/BUILD.md`, in Spanish too): what to buy, the print order, the heat-set inserts, the assembly, the
  cables and power. The compatibility list has a five-minute case checklist and a Spanish version.
- Bill of materials: the keystones are back (a renamed list had hidden them); the hardware of every NanoKVM bay as it
  is built (drawer screws, raised-bay countersunk screws, `nkvm:ks` coupler and patch cable, the bay's keystones);
  M3 x 8 for the retro button carrier; stock screw lengths for 40 mm fans; the devices and their cables listed apart.
  Modules and panels screw into the adapter's fixings, so they no longer count a second set of inserts. CI checks BOM
  lines.
- Fit: a note when the rack inserts leave less than 2 mm of plastic to the bay's steel side (M6: 1.4 mm), and
  `test_rack` now has the real posts so it can be slid into a bay with its inserts in; the NanoKVM drawer slides out
  through its plate (clearance round the opening); keyhole cable ways and kept corner fingers on the raised NanoKVM
  bay; thicker retro carrier posts; printed buttons as thick as their panel; the frame opening lets an 80 / 40 mm fan
  through a separate filler; bolder engraved letters for a 0.4 mm nozzle.
- New test piece `test_button` (one MX key, metal push-button hole or retro cap opening); the MX cut-out is a print fit.
- Button panel: metal PC push buttons (12–22 mm) and a retro panel with printed caps on tactile switches, TURBO and
  named LEDs, besides the MX keys. Their icons and names print in the second filament with multicolour letters.
- Fan openings: round hole or hex grille (`fan_guard`).
- Web: every text in Spanish and English (Advanced form choices, warnings, bill of materials), one term for each
  thing; the steps hold up when the page is zoomed in or out; Print fits shows each test piece and real insert
  sizes; multicolour has its own step in Making it; PCI-slot brackets can be switched off.
- The 2U 12-port panel really has 12 ports, and the overhang STLs use the auto hole pattern; all STLs rebuilt.
- NanoKVM bay flat (`nkvm:front`): a drawer in three pieces - the plate with two guides, the drawer with the Ethernet port in its face (two screws), the lid; the drawer slides out of the front with the NanoKVM. The keystones keep clear of the rack post and the drawer sits centred in the rest.
- NanoKVM bay standing (`nkvm:side`): out of the case in a little mountain (`nkvm_raised`, new default) with its ports open at both sides, cables from outside or through slots into the case; three pieces (plate, mountain, lid) by default.
- LED strip fill removed.
- NanoKVM bay `nkvm:ks`: the network port comes to the front through a keystone; the NanoKVM lies flat right behind it, connected with a straight 10 cm patch cable, HDMI and USB into the case.
- `hole_pattern = auto` (new default): EIA-310 inside the bays, one centred hole per U when the units stick out, so overhang builds no longer have rack holes breaking out of the frame. A new CI check renders every example and bays x fit x front assembly.
- Port names over the patch panel (`ks_names`): your own, HDMI / USB / RCA / AUDIO / OPTICAL for those jacks, numbers in order for the rest.
- Multicolour letters (`labels_multicolour`): every panel with letters gets a `..-labels` piece to print in a second filament; the letter colour shows in the preview.
- Label: text, size, alignment, position, engraved or raised.
- Vent fill redesigned: vertical slots, louvres, honeycomb or holes (`vent_style`), with a solid rim (`vent_margin`).
- Editor: the viewer shows Mounted or one piece of the kit at a time; steps grouped (your case, what goes in, making it, the 3D view) with a print fits step and your own colour.
- README images rendered again from the v2 adapter, with the new trays and the NanoKVM bay.
- Fixed: a 1-bay build (no rack units) hung the 3D preview.
- Tolerances: `ks_fit` for every keystone opening (cells, cut-outs and covers follow), `nkvm_insert_d`, `mount_clear` round the NanoKVM; README and web tell you to print the test pieces first and tune them.
- Every number and size has a range (customizer and web), and the model warns about values that do not go together.
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
